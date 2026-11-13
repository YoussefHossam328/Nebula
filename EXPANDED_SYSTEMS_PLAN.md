# Nebula: seven-sol base maintenance

Status: **Approved for implementation by the user, including sun-tracking arrays.** Settings consolidation, camera interpolation, delay and optional landing shake are already implemented. This plan supersedes the earlier open-ended mechanics proposal.

## Confirmed choices

- Maintain a Mars base for **seven in-game days**, with duration adjustable. Recommend interpreting a Mars day as a sol; the remaining decisions below make that explicit.
- Accelerated day/night cycle, solar charging and manual panel cleaning by **holding interact**. Hold duration must be editable.
- Accumulated radiation reaching its configured maximum immediately ends the run in a loss. No gradual health bar is required.
- Use physical radiation units tied to traceable NASA data, separating measurements from reconstructed simulation inputs.
- Every tuning parameter, including camera controls, belongs in categorized folders in the top-right Settings panel. The HUD remains telemetry and operational controls.
- Placeholder art and existing movement controls continue; this is a plan for approval, not authorization to add every optional mechanic.

## Proposed playable loop

Begin with a charged outpost battery, oxygen reserve, solar array and accessible shelter. During daylight, generation powers equipment and charges storage. At night, stored energy carries the loads. Dust reduces panel output, requiring an EVA to clean the array. Oxygen production competes for energy. Space-weather warnings can prompt the player to postpone maintenance and enter shelter. Survive the configured number of sols with oxygen available and accumulated exposure below the limit.

Recommend a compact initial base with one array, one oxygen unit and one shelter. Additional arrays and habitat expansion can follow. Retain the original pressure-free sandbox as a separate mode.

## 1. Clock and scenario duration

Use separate real elapsed time, simulation elapsed time and archived observation timestamps. One proposed sol is approximately **88,775.244 simulation seconds**. An accelerated clock advances energy, oxygen, dust, event profiles and radiation consistently. Movement, camera and hold-to-interact responsiveness remain in real seconds.

Proposed editable preset: **180 real seconds per sol**, seven sols per run, approximately **21 real minutes** total before pauses. A scenario-start clock sets whether the first interval begins near morning or night. Display sol number, local solar-time approximation, daylight state and remaining sols.

Pause all simulation systems on manual pause, hidden tabs and focus loss. Resume explicitly. Do not apply hidden-tab catch-up depletion. Integrate transitions across sunrise, sunset, event boundaries and resource depletion rather than skipping them on large elapsed-time updates. Clamp final time to the earliest success/failure boundary; failure wins an exact tie with completion.

R, falling and teleporting reset the character position only. They do not erase dose, refill reserves, clean panels or advance the scenario. Scenario restart resets everything. Loss freezes the scenario immediately.

## 2. Solar generation and battery charging

Use an explicit power/energy balance:

`PV power (W) = irradiance (W/m²) × array area (m²) × efficiency × orientation factor × dust transmission`

`stored energy change (Wh) = accepted net power (W) × simulation seconds / 3600`, with separate charge and discharge efficiencies.

At night, generation is zero. During daylight, a documented representative Mars irradiance profile drives production. A representative profile is a simulation assumption, not a live NASA weather measurement. Support a selected site/season later without claiming a generic sine curve is a site-accurate forecast.

Account for controller rating, charge/discharge power limits, capacity and curtailed generation. Loads consume current generation before storage supplies a deficit. A full battery wastes excess generation. Storage never goes negative. Report generation, total load, charge/discharge and state of charge separately.

Proposed initial balancing assumptions, all editable and explicitly not NASA hardware specifications:

| Parameter                                      | Proposed initial value |
| ---------------------------------------------- | ---------------------- |
| Array area / conversion efficiency             | 20 m² / 22%            |
| Representative peak irradiance                 | 500 W/m²               |
| Battery capacity / initial charge              | 12,000 Wh / 80%        |
| Charge / discharge power limit                 | 2,500 W / 2,500 W      |
| Charge / discharge efficiency                  | 95% / 95%              |
| Background base load                           | 180 W                  |
| Additional oxygen production load              | 500 W                  |
| Additional occupied-shelter environmental load | 80 W                   |

This is a proposed starting point, not yet a verified seven-sol balance. Validate overnight storage and multi-sol survival with a reference control schedule before finalizing the preset. Electrical depletion should not automatically end a run if loads can be shed and oxygen remains; see pending power-policy choice below.

Existing normalized settings need an explicit versioned migration. Never reinterpret old battery units as Wh. Preserve original scenarios and exports, or clearly offer the new scenario preset instead of silently overwriting them.

## 3. Hold-to-clean maintenance

Place an accessible array with its own cleanliness state and collision-safe maintenance target. A proposed initial hold is **4 real seconds**, editable separately from simulation speed. Show a progress indicator and panel output before/after cleaning.

Cleaning advances only while E is held, the array is the selected target, the player remains in range and the scenario is active. Release, moving out of range, pause, UI focus or changing targets cancels the hold; proposed initial behavior resets progress. Cleaning still consumes simulation time and incurs the location's radiation exposure. No repeated keydown spam or instant E press may complete it.

Propose a deterministic dust-loss model: initial dust transmission 0.90; decrease by 0.04 per sol, floored at 0.30; a completed clean restores it to 1.00. These are balance assumptions, not measured Mars deposition rates. Do not infer dust from DONKI flare data. The rate, floor, initial state and cleaning effectiveness are editable. Approved update: panels track the sun automatically within adjustable tilt limits. A fixed-orientation comparison mode and tracker power draw are exposed in settings.

## 4. Oxygen and base operation

Keep reserve consumption distinct from generator production and from power consumption. Only a powered oxygen unit produces oxygen. Excess production at capacity is wasted, while a running unit continues drawing power unless automatic cutoff is explicitly enabled.

Recommend using **kg of oxygen** for the expanded scenario, with an explicitly selected production process and editable production/consumption rates. A MOXIE-style CO₂ processor and a water-electrolysis plant have different feedstock and energy assumptions; the model must identify which is represented. Do not convert current training units to kg or choose rates as if NASA measured the proposed hardware. Feedstock may remain assumed available, if approved. Numerical mass/rate defaults will be balanced with the selected process and occupancy.

Keep outpost oxygen separate from suit oxygen. Suit capacity and refill are deferred unless requested. Proposed zero-oxygen behavior is immediate scenario loss; power loss alone first disables unsupported production. A control panel should report why equipment is not running.

## 5. Solar flare and energetic-particle scenario

Represent electromagnetic flare notifications separately from a solar energetic particle (SEP) exposure profile. They may be associated historically, but a flare class is not a Mars surface dose and an Earth observation is not automatically a Mars observation. A CME is contextual unless a supported arrival/transport model is selected.

Recommend a reproducible archived case with a warning and particle event during the seven-sol run. No physical blast or automatic camera shake accompanies radiation. Keep event trigger, onset, rise, peak, decay and warning lead time editable; preserve scientific event timestamps separately from the accelerated scenario placement.

NASA/JPL documents a Curiosity RAD dose of **8,100 µGy = 8.1 mGy** in the May 20, 2024 event. That can anchor an event's integrated dose. The article does not give a continuous rate curve: if using an adjustable reconstructed curve, normalize its integral to the cited dose and label it **reconstructed from a reported event total**. Confirm whether the selected reported quantity includes background before combining it with baseline to avoid double counting. A processed RAD time series is preferable when its products, quality flags and units have been verified.

Changing event severity away from the sourced total creates a modified scenario; show the multiplier and retain the reference separately. Do not silently boost radiation to make the game harder.

## 6. Radiation dose and immediate loss

Proposed primary display: **absorbed-dose reference/proxy in mGy**, rate in mGy/hour. This matches a verified NASA/JPL event reference. Do not relabel mGy as mSv: equivalent/effective dose requires additional radiation-quality, tissue and geometry assumptions. A rover detector reference is not an individual astronaut medical assessment.

Integrate rates over simulation time: `dose increment (mGy) = dose rate (mGy/hour) × simulation seconds / 3600`. The same accelerated clock used for the seven-sol scenario must drive dose. Exposure persists after an event and while sheltered; shielding changes the rate, not accumulated history.

Use baseline plus the appropriately separated event contribution, with provenance for each. Select and document a valid baseline reference and its averaging interval before shipping the physical preset. The RAD PDS archive examined during planning contains RDR products described as Level 1A mirroring raw instrument data; finding an archive does not establish that a directly usable human-dose time series was extracted. Do not invent a quality factor or baseline to fill that gap. A documented published baseline is an acceptable alternative to raw-product processing.

When `accumulated dose >= configured dose limit`, immediately mark the run lost and stop simulation. Present this as an **operational exposure limit exceeded**, not a claim that this exact dose instantly kills a person. The NASA/JPL article explicitly describes the 8.1 mGy event as not deadly. The loss limit is a game/mission rule, editable and labeled separately from measured data.

The default limit is pending baseline/model selection and user preference. It should make shelter relevant without altering the reference dose or implying a NASA medical standard.

## 7. Shelter and loss rules

Recommend entering shelter by physically walking into a registered protected volume. Apply explicitly documented scenario transmission factors for baseline and SEP components separately. A provisional simplification may use 0.70 baseline and 0.20 event transmission, clearly labeled model assumptions rather than measured material performance. Later replace them with a defensible shielding model.

Passive shielding remains effective without power. The 80 W proposed load powers environmental support, not the shielding itself. A power deficit must not remove passive protection. Whether environmental failure creates a separate loss condition requires the selected power policy.

Proposed outcomes: success after all configured sols; immediate loss on dose limit or oxygen depletion. Battery empty causes a power deficit and load shedding rather than an unexplained instant death. The first implementation should visibly distinguish equipment off, unavailable power and missing supply.

## 8. NASA integration and documentation

Detailed research results and intended API use are in `NASA_DATA_USAGE.md`. No personal key has been used or stored during planning. The public DEMO_KEY successfully verified the DONKI SEP endpoint; the Curiosity archive and NASA/JPL reference are publicly accessible without that key.

Recommended delivery: a GitHub Actions data-refresh step fetches selected DONKI records using a GitHub Actions secret named `NASA_API_KEY`, checks response structure, and exports a sanitized attributed JSON dataset into the Pages build. The published game can run offline after loading and needs no key. Keys do not enter source, exports, request logs or the browser bundle. API fetch failures keep a known valid archived dataset and clearly show its date/status; they must not silently substitute fictional NASA data.

The supplied key would be used only after it is configured securely and the implementation is approved. Saving its name in a plan does not configure it. Do not paste it again; the GitHub Actions secret can be set in repository settings. Public NASA data and a public personal API credential are different things: exposing the key lets others consume its quota.

DONKI supplies event metadata and associations, not calibrated Mars surface radiation. RAD measurements or a documented NASA reference anchor dose. Record source URLs, IDs, observations, units, transformations, uncertainties and scenario scaling. Mark archived and reconstructed inputs individually. Provide an in-game Sources view and a short judge-facing methods document.

## 9. Settings and camera

Everything stays in the top-right panel, including:

- Scenario: sol count, start time, sol duration/simulation speed, seed and replay.
- Solar: area, efficiency, daylight profile, limits and dust transmission.
- Maintenance: interact binding, real-time hold duration, range, cancellation/progress policy and cleaning effectiveness.
- Battery/loads: capacity, initial energy, efficiencies, limits and priorities.
- Oxygen: mass capacity, consumption, production and equipment draw.
- Radiation: source preset, baseline, rate profile, dose limit and exposure warnings.
- Shelter: bounds, transmission and environmental load.
- Camera: framing, follow responsiveness, delay, look-target offset, shake enable/strength/frequency/duration and triggers. Recommend separate landing and running shake toggles, a master disable and preview. Running shake remains off initially.
- Rendering, diagnostics, source information, presets and versioned JSON import/export.

Structural/model changes apply via explicit scenario restart; safe visual settings apply live. Define numeric limits and units on every control. Technical advanced settings can be nested, but no second tuning panel is introduced.

## 10. Implementation order and acceptance

1. Versioned scenario configuration, accelerated sol clock and existing-settings compatibility.
2. Day/night rendering, energy storage, generation, dust and cancellable hold-to-clean.
3. Chosen oxygen process, physical units, equipment supply checks and power policy.
4. NASA data adapter/archived fixtures, provenance and a validated radiation reference.
5. SEP scenario, dose integration, shelter, immediate loss and seven-sol completion.
6. Unified controls, compact HUD, data/source explanation, automated checks and Pages deployment.

Required checks: daylight/night boundaries; energy conservation and efficiency losses; capacity and power limits; realistic feasible reference schedule across seven sols; hold completion/cancellation without synthetic progress while paused; source validation; dose-unit conversions; reconstructed profile integral; background/event separation; shelter factors; dose-limit crossing and ties with completion; no erasing exposure on respawn; equivalent results across frame schedules; old-settings migration; keyboard/UI and camera regressions; CI and deployed-site checks. Document actual hardware testing separately from headless browser tests.

## Remaining choices for approval

1. **Time:** interpret seven days as seven Mars sols? Is 180 real seconds per sol (21 minutes total) a suitable editable starting preset?
2. **Power policy:** automatic shedding with oxygen production below essential base loads, manual allocation, or immediate failure at empty battery? Recommendation: automatic, with visible priorities.
3. **Oxygen process:** CO₂ processing on Mars, water electrolysis, or keep the existing explicitly abstract generator temporarily? Recommendation: CO₂ processing with documented assumptions; no water inventory in this increment.
4. **Shelter:** physically walk inside as proposed? Any desire for a door/interaction instead?
5. **Radiation limit:** accept mGy-based reference exposure and an editable operational loss limit, or do you specifically need mSv and the additional model work? I recommend mGy first. The default limit will be proposed with the selected baseline; it will not be called lethal.
6. **Event delivery:** historical event reconstruction in a repeatable run as proposed, or live event context? Recommendation: archived, repeatable scenario first.
7. **Scope:** are fixed-orientation arrays and no suit/refill, repairs, or communications mechanics acceptable for this increment? These additions can follow after the seven-sol loop is stable.

Approve or amend this plan before gameplay implementation. Existing camera/settings work remains available for testing.

## Implementation balance update

The tested starting preset uses a 60 m² tracking array, 24 kWh storage and 1.5 kW oxygen plant (0.05 kg/hour) so that a seven-sol reference strategy is feasible. The earlier table was tentative; these are explicitly editable hardware assumptions. The event dose is anchored to 8.1 mGy, the primary exposure display is mGy, and the operational default limit is 5 mGy. No personal API key is embedded or used; DONKI context refresh currently uses the public DEMO_KEY unless a GitHub Actions secret is supplied.

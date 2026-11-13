# Nebula: energy, space weather and radiation

Status: **Proposed for review; new gameplay systems await approval and answers.** Settings consolidation and camera improvements were separately requested and are being delivered now.

## Direction

Build a simulation with explicit inputs, units, state transitions, limitations and reproducible tests. Keep the interface understandable without replacing engineering relationships with arbitrary bonuses. Simulated data remains labeled; physical-looking numbers are not presented as NASA measurements. Placeholder models continue to be replaceable.

## 1. One settings location — current work

Use only the top-right Settings panel for movement, collision/physics, camera framing, camera follow, camera shake, rendering, resource balance, imports/exports and presets. The resource HUD shows telemetry and operational training buttons; it contains no tuning forms. Preserve existing saved values and imports when adding camera fields. New systems must register their settings in named categories here.

## 2. Camera — current work

Interpolate visual character movement between physics ticks. Follow one smoothed target for both camera position and aim, avoiding the former instantaneous look-at response. Add follow delay in seconds independently from smoothing responsiveness. Clear history on reset/teleport. Expose camera framing, delay, smoothing and shake enable/strength/frequency/duration in separate categories. Default delay: 0.12 seconds; shake disabled. Provide a preview and an optional landing trigger. These are editable starting values, not final user preferences. Running shake awaits the user's preference.

Validate interpolation, frame-rate-independent smoothing, history reset, zero delay, settings migration and shake disabling. Camera smoothing cannot restore missing frames on a slow GPU; assess frame time separately from controller jitter.

## 3. Solar power and rechargeable battery — next recommended implementation

**Purpose:** replace the permanently dwindling battery with a genuine generation/storage/load balance.

- Track generation, oxygen production load, background load, charge/discharge power, stored energy and curtailed energy separately.
- Proposed model: `PV power = irradiance × panel area × efficiency × orientation factor × dust transmission`, capped by inverter/controller ratings. Use a solar-position/daylight profile with documented simplifications; geometric night gives zero generation.
- Proposed units: W or kW for power, Wh or kWh for stored energy. Keep conversion explicit: `energy change = net power × simulation seconds / 3600` when power is in W and energy in Wh. Apply charging/discharging efficiency and rated current/power limits; never exceed capacity or draw energy below zero.
- If using physical units, migrate old normalized energy settings explicitly rather than reinterpreting 70 arbitrary units as 70 kWh. Oxygen also needs a deliberate unit/model choice before conversion. Initially an internally consistent normalized model is possible, with honest labels.
- Visible placeholder panels show their condition and orientation. Walking to clean or reorient them provides a reason to leave shelter, if approved.
- Full batteries curtail unused generation. A deficit drains storage; no available power turns off unsupported loads according to an agreed priority policy. Do not silently create energy.
- Trade-off: produce oxygen now, reserve energy for darkness, or spend exposure/time maintaining generation.

**Settings category:** Energy / generation, storage, loads; Environment / clock, site, daylight and dust. Pending choices: fixed or adjustable panels, manual cleaning, accelerated clock, capacities and failure policy.

## 4. Space weather event pipeline

**Purpose:** a reproducible external hazard that creates a reason to plan and seek protection.

Model these as distinct event types:

- **Solar flare:** electromagnetic emission from the Sun. It can motivate a notification or a modeled communications disturbance. Do not automatically convert flare class into astronaut radiation dose or a surface explosion.
- **Solar energetic particle event:** elevated energetic particle flux, with a separate onset, rise, peak and decay. Its relationship to a flare or CME is event-dependent; there is no universal fixed delay or guaranteed association.
- **CME:** an optional associated record/context, not automatically a direct hit on Mars. An Earth-directed event is not necessarily Mars-directed.

Propose a seeded/scenario-driven event timeline first: warning, uncertain forecast, onset, peak, recovery and end. Forecast quality and warning lead time must be explicit simulation assumptions, not fictional NASA precision. Expose test controls to trigger/replay an event in Settings / Space weather. Never shake the camera merely because radiation arrives; radiation is not a physical blast wave.

For later NASA adapters, retain source event IDs, original timestamps, observation location, units, attribution and retrieval times. Historic playback retains original timestamps plus a separate simulation clock. DONKI event associations can supply context, but converting them to a Mars surface hazard needs an explicit transport/environment model. Mock and archived inputs remain available offline; stale/live/unavailable states must be distinct.

## 5. Radiation exposure and dosimetry

**Purpose:** make location, protection and time matter.

- Separate baseline background exposure from the transient particle-event contribution.
- Integrate exposure over simulation time, not rendering frames. A proposed calibrated model uses dose rate in mSv/hour and accumulated equivalent/effective dose in mSv, with the chosen quantity explicitly stated; these quantities cannot be substituted for absorbed dose in Gy without assumptions.
- If no defensible calibration is selected, use labeled simulated exposure units instead. Do not invent a physical dose by multiplying an arbitrary flare severity.
- Protection depends on whether the astronaut is outside, inside a habitat, or in a storm shelter. The initial approximation can use documented effective transmission factors. Material thickness alone is insufficient for general radiation transport: energy, composition, secondary particles and geometry matter.
- Track total exposure, current rate, location and event contribution separately. Dose accumulates and does not instantly disappear when the event ends or the astronaut enters shelter.
- Warning and operational exposure limits are scenario thresholds, not medical predictions or universal NASA astronaut limits. Health consequences, if wanted, require a separately approved abstraction.

**Settings category:** Radiation / baseline, event profile, transmission, operational limits and display units. Pending: abstract versus calibrated physical model, threshold outcome and persistence between exercises.

## 6. Shelter and competing electrical loads

**Purpose:** create a real decision instead of a cost-free safe option.

- Proposed first implementation requires walking into a defined shelter volume. Entry and exit change the exposure model; walls or a roof are not protection unless registered as a protective zone.
- Shelter environmental systems consume an explicit electrical load. Establish what is powered (fans/filtration/thermal control), instead of claiming electricity itself blocks radiation. Passive shielding remains protective during an outage.
- Oxygen supply remains linked to the outpost reserve initially. A separate suit tank/refill model is optional and must not be mixed into the outpost model implicitly.
- During low energy, the operator may choose oxygen production, shelter environmental support or nonessential equipment under an agreed policy. Basic electrical protection and minimum survival loads need defined behavior.
- A power cut does not open an oxygen leak or instantly kill the player unless that behavior is explicitly modeled and approved.

**Settings category:** Shelter / protected volumes, passive transmission and environmental loads; Power allocation / priorities and cutoffs.

## 7. Optional mechanics for a later increment

- **Suit oxygen and refill:** a distinct portable tank, refill transfer and supply limits. Adds EVA duration decisions; requires suit/outpost accounting and clear reset rules.
- **Panel dust and maintenance:** generation losses accumulate; cleaning restores measured transmission while costing time outside. Maintenance must not grant arbitrary electrical energy directly.
- **Equipment degradation and repair:** specific failure modes and repair costs; seeded failures for repeatability. Repair consumables need an inventory decision.
- **Communications disruption:** delayed or unavailable telemetry with timestamps and a last-known indicator. A flare-driven effect requires a selected radio propagation model; do not pretend to predict Mars communications from an Earth event flag.

Recommend deferring repairs, suit supplies and communications until the energy/event/shelter loop is working. These are proposals, not silently added scope.

## Proposed implementation batches

1. Current UI/camera work and regression checks.
2. Approved generation/storage model, daylight, solar panels, energy telemetry and revised training balance. Test charging before adding hazards.
3. Approved particle-event timeline, dose integration and shelter, sharing one simulation clock with energy and oxygen. Pause/hidden-tab rules apply to every subsystem.
4. A configurable 5–10 minute scenario combining sunlight, oxygen production, maintenance if approved, one hazard and a final operational summary.
5. NASA adapter only after selecting the specific dataset and defining what it can scientifically support. No API integration is implied by simulated event support.

Each batch should have tests and a working Pages build. Avoid changing movement balance while the team evaluates it.

## Verification requirements

- Energy conservation with no generation, surplus generation, full storage, efficiency loss and charge/discharge limits. Test daylight/night boundaries and parameter changes.
- Equivalent results under different rendering schedules and simulation speed multipliers; isolate wall time, simulation time and historical event time.
- No instantaneous radiation-dose jump at an event boundary; integrate profiles and transitions consistently. Dose remains monotonic with nonnegative exposure.
- Shelter reduces the selected exposure quantity and its load appears in the energy balance. Passive protection survives loss of power.
- Seeded events replay identically. No event or missing API response changes provenance labels silently.
- Resource reset, player respawn, pause/resume, exercise end and scenario reload have explicit consistent effects across all systems.
- Settings remain in the top-right panel, are validated and migrate older exports. Operational controls remain distinguishable from developer overrides.
- Browser tests cover charging, generator loads, event onset, walking into shelter, warnings and outcome. Existing keyboard and camera checks continue passing.

## Decisions requested before implementing batches 2–4

1. Energy units: retain explicitly normalized units first, or introduce calibrated W/Wh and a selected oxygen unit/model now?
2. Generation: fixed solar panels or adjustable orientation? Manual cleaning via E, automatic cleaning, or no dust yet?
3. Environment: chosen Mars site/latitude and season, or a labeled representative daylight profile? Accelerated sol/day cycle or short fixed-day scenario? Desired speed multiplier?
4. Storage: nominal capacity, initial charge, panel output and charge/discharge limits, or should I propose a balanced editable preset?
5. Power loss: automatic load shedding, player allocation, or immediate exercise failure? Which loads have priority?
6. Events: deterministic training sequence, seeded variation, or manual debug triggers only? Should forecasts be reliable or explicitly uncertain?
7. Radiation: fictional risk units initially, or a physically calibrated model supported by a selected reference dataset? What happens at the operational limit?
8. Shelter: walk inside or interact to enter? Should it have a running environmental load? How should depleted oxygen/power affect the exercise?
9. Other systems: suit tank/refill, dust maintenance, equipment repair, communications—choose what belongs now versus later.
10. Scenario: duration and success goal (survive the interval, maintain minimum reserves, complete a task, or free simulation)? Should accumulated dose persist across respawns/exercises?
11. Camera: landing shake only, running shake too, or preview only? Preferred follow delay and shake strength can be supplied later; all remain editable.
12. Detail level: engineering dashboard with numeric rates/units and charts, or compact telemetry with an expandable detailed view? Recommendation: both, with compact default HUD and detailed top-right diagnostics.

No response is treated as approval. I can recommend a coherent preset after these choices; the team need not supply every numeric value manually.

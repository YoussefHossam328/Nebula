# Nebula: main game implementation plan

Status: **Approved; implementation in progress.** Prepared for implementation at **medium effort**, in small validated milestones. Implementation details and current behavior are recorded in GAMEPLAY.md.

This plan supersedes the earlier first-playable proposal where the requirements differ. The user has selected the seven-sol mission, separate dialogue-led tutorials, the revised icon-based HUD with a transparent bottom dock, automatic crop replanting, scripted disasters, and a new audio direction. Cutscenes and story production remain deferred.

## 1. Intended experience

1. Open a simple **Nebula** title screen with one prominent **Play** button, the standing/idle astronaut, and the station or landing site in the background.
2. Play the tutorials one mechanic at a time. Each has a short explanation, a practical task, and feedback showing the result of the choice.
3. Start a fresh, configurable **seven-sol survival mission** after the final lesson.
4. Reach a clear victory or loss screen. On loss, choose **Restart tutorials**, **Restart challenge**, or **Main menu**.

Keep keyboard controls and existing movement/camera tuning. Use placeholder crops and any unfinished station parts. The current astronaut, solar model, station, and uploaded lander are sufficient to build this slice; more foundation systems are not a prerequisite.

## 2. Challenge criteria and scope

Use the challenge text supplied by the user as the requirements source. Its core is kids managing real survival trade-offs, not simply viewing a Mars-themed scene. Target plain language appropriate for the challenge's ages 7–12 and the user's wider 7–14 classroom/family audience.

| Challenge aspect | Gameplay / teaching implementation |
| --- | --- |
| Life support | Oxygen reserves and electrically powered oxygen production; decisions affect both reserves and power. |
| Power budgeting | Sunlight, tracking, dust, storage, overnight loads, and an additional greenhouse load. |
| Food production | Powered crops, nourishment, harvesting/eating, automatic replanting, and delayed regrowth. |
| Radiation and shielding | Event warnings, shelter location, physical cumulative dose, and a separately labeled recoverable game stress meter. |
| Communication delay | One concise practical lesson and a nonblocking delayed station report/reply; no story cutscene required. |
| Consequences and learning | Observable meter/rate changes, useful failure explanations, and a mission summary of choices and their costs. |
| Real NASA grounding | Retain attributed archived RAD/event references; optionally add a few curated NASA photographs with asset IDs and credits. |
| Low barrier to entry | Browser play on GitHub Pages without login, installation, or live API dependence. |

Group the player's attention around **power, life support, and protection**. Avoid overwhelming players with a dashboard of equally prominent engineering variables. Detailed rates stay accessible through the inspector and top-right debug/settings window.

## 3. Game flow and main menu

Introduce one explicit controller for `MENU`, `TUTORIAL_DIALOGUE`, `TUTORIAL_ACTION`, `MISSION`, `PAUSED`, and `RESULTS`.

- Reuse the existing scene/renderer for the title background with a deliberate camera composition and the real Idle clip. Do not run a second game simulation behind the menu.
- Disable world movement and interactions while a blocking dialogue/menu has focus. The model's idle animation may continue without advancing resources or events.
- Play starts tutorial 1 for a new run. A returning player can access the challenge directly through a small secondary route; the default title stays simple.
- Pause/resume returns to the exact previous tutorial or mission state. Hidden tabs and focus loss freeze resources, hazards, crop growth, recovery, and hold interactions.
- Tutorial progress and settings can be remembered locally. Full in-progress mission save/load is not included unless separately requested.
- Keep legacy exercises and the unrestricted sandbox accessible through the debug window for regression testing, rather than as the first player experience.
- Buttons that open settings always open the same top-right window; no duplicated tuning panels.

## 4. Separate tutorials with short dialogues

Use a data-driven lesson structure: **intro dialogue → world task → visible consequence → short recap → next lesson**. Each module is independently restartable through the debug window.

Dialogue principles: one or two short sentences per page, approximately 25–35 words maximum; plain action words; define terms on first use. No forced voiceover or story production. Provide Next/Back and keyboard navigation; prevent dialogue keys from also jumping or interacting in the world.

| Lesson | Player task | Example dialogue / point taught |
| --- | --- | --- |
| Arrival and movement | Leave the landing area, follow a marker to the station, try walking/running and a small practice jump/crouch. | “Welcome to Mars. A Mars day is called a sol. Let's learn how to move around your base.” |
| Solar power and battery | Inspect generation, consumption and charging; preview daylight and night in the practice scenario. | “Sunlight makes electricity. Your battery stores extra power for the night.” |
| Panel cleaning | Approach the marked service point and hold E until the progress ring completes. Compare output before/after. | “Dust blocks sunlight. Clean the panels to make more power. Cleaning takes time outside.” |
| Oxygen and equipment loads | Turn the plant on/off and observe oxygen production versus battery demand. | “The oxygen maker needs power. Keep enough oxygen without using all your stored energy.” |
| Food and crops | Eat a ready crop, see nourishment rise, then inspect automatic replanting and powered regrowth. | “Food keeps you going. After you eat, new seeds are planted. The growing system needs electricity.” |
| Radiation and shelter | Trigger a safe practice event, walk into shelter, compare dose rate and recovering stress. | “Shelter lowers incoming radiation. Your stress can recover here. Your dose record keeps what you already received.” |
| Communication delay | Send a short status report and do a small useful task while a reply is pending. | “Earth is far away. A reply takes time, so you must make some decisions yourself.” |
| Warnings and mission briefing | Respond to a practice warning, inspect the objective, and start a fresh mission. | “For seven sols, keep the base supplied. Watch your power, food and oxygen, and use shelter when warned.” |

- Tutorial progress is gated by actual action/results signals, not arbitrary timeouts or repeatedly clicking Next.
- Practice uses isolated fixtures and explicitly accelerated demonstrations. Survival time, damage, reserves and event counters do not carry into the mission.
- Only the system being taught advances when required. Other hazards remain paused/disabled so children do not fail while reading.
- The communication example uses an explicitly simulated delay. A proposed eight-simulation-minute one-way delay is a scenario value, not the distance-dependent delay for every Earth–Mars configuration. Fast-forwarding the demonstration must be labeled; no eight-real-minute mandatory wait.
- NASA imagery is optional supporting material, never a prerequisite to completing a lesson. Teach through the action and its consequence.

## 5. Use the selected HUD in the actual game

Integrate the revised Red Horizon direction currently available as a standalone preview. Replace its illustrative numbers, fake sliders and preview-state toolbar with real game bindings.

- SVG icons throughout; no emoji icons.
- Transparent bottom HUD with readable numbers, meter tracks, and restrained text shadows; no shared dark capsule background.
- Primary resources: battery, oxygen, nourishment, and recoverable stress. Display physical dose and remaining operational margin as a compact secondary readout with detailed rate information available on demand. Warnings about the physical loss limit remain visible.
- Top-left: current lesson/objective or sol/time/progress during the mission.
- Top-center: real event state and actionable warning. Show archived/modelled data status honestly.
- Contextual world prompt and hold progress at the selected usable target. Do not leave a generic instruction hovering over empty space.
- Top-right: pause/help/science and a **Debug** button. Debug opens the one unified window containing every modifier and event control.
- Menus, dialogue, warnings, results, source information, and keyboard focus states use the same visual language.
- Responsive layout and quality settings remain supported. Touch gameplay stays deferred; no joystick is silently added.

## 6. Solar interaction fix

Observed current implementation:

- `target()` accepts interaction only near the array's **mast center**, with a ground-height check.
- Cleaning runs only while the base scenario is active and E remains held; a tap does not clean.
- `interact()` only toggles oxygen; the panel's hold action is handled separately during the frame update.
- The panel is visible in the sandbox/legacy exercise even where cleaning has no active simulation effect.

These are concrete implementation risks, not a claim that the reported bug has already been reproduced under every saved configuration.

Planned correction:

1. Register a named **solar service point** on the accessible ground side of the real model, separate from the rotating blade and mast collision.
2. Use one shared interaction resolver for the station, array, crops and radio. Select one eligible target using distance and vertical separation; never activate two systems with one keypress.
3. Give taps useful feedback: “Hold E for 4 seconds to clean,” rather than silently doing nothing.
4. Run hold-to-clean identically in the solar lesson and mission. In a mode where it is disabled, state that clearly or expose a safe debug practice action.
5. Cancel on release, leaving range, changing target, pause, focus loss, or a blocking UI. A continued hold after completion must not repeatedly harvest cleanings.
6. Display progress, the clean/dirty artist texture, transmission and output changes. A nighttime clean still succeeds, but explain that generation returns with daylight.
7. Check the service point against the actual GLB bounds and collision so it is reachable from ordinary walking paths.

Keep hold duration, range and visual clean threshold adjustable in Debug. Test with mouse focus in the world as well as after a menu/dialogue closes.

## 7. Radiation: fix communication and verify actual recovery

Keep two clearly different concepts:

- **Physical dose (mGy):** cumulative history, based on the existing documented reference model. It does not go down when sheltered. The existing configured dose-limit loss rule remains in place unless the user explicitly changes it.
- **Exposure stress (0–100):** fictional game mechanic that rises with received exposure and can fall while sheltered. It is not NASA health data.

Planned changes:

- Make the recoverable stress bar the clearly named primary protection meter. Show “Recovering,” “Rising,” “Paused,” or “Protected” from the actual net rate.
- Explain that accumulated mGy is a record rather than a healing bar. Always show a clear warning before the physical limit can end the run.
- Verify shelter entry uses the player's feet/body against the registered volume and updates the UI and simulation together. The ordinary habitat is not silently treated as the storm shelter.
- Account for incoming stress **and** recovery: during a severe peak, recovery may not exceed new exposure. If the bar is not falling, show why instead of promising recovery that is not occurring.
- In the practice lesson use a fixture where the recovery result is obvious and guaranteed without editing settings.
- Reset only on a new scenario; character reset/respawn must not erase dose or silently refill stress. Pause stops both incoming exposure and recovery.
- Keep gain, shelter recovery, shielding and the physical limit described and adjustable in Debug.

No decontamination or medical treatment is claimed to remove historical absorbed dose. A stress recovery animation must never also decrease the recorded mGy.

## 8. Nourishment, crops and greenhouse power

Use a simple normalized **Nourishment** meter rather than pretending to model human nutrition medically.

Proposed editable defaults for balancing:

| Parameter | Starting proposal |
| --- | --- |
| Capacity / starting nourishment | 100 / 80 points |
| Consumption | 25 points per sol |
| Ready crop portion | Restores 35 points, capped at 100 |
| Crop beds | Two small placeholder beds |
| Powered regrowth | One sol per crop cycle |
| Starting crops | At least one portion ready |
| Growing-system draw | 400 W total while growing |

- E at a ready bed performs **harvest and eat**, without introducing an inventory system.
- Eating restores nourishment and automatically replants that bed. Empty/growing beds cannot be repeatedly eaten.
- If already full, give feedback and leave the ready crop available rather than wasting it accidentally.
- Growth requires supplied electrical power. When power is insufficient, pause growth and show “No power.” The first version does not add crop disease, water/fertilizer inventories or instant plant death.
- Mature crops remain available; regrowth starts only after consumption. Initial food provides a buffer for an outage or learning mistake.
- Proposed nourishment-at-zero outcome: lose the run with a clear explanation. No extra movement penalty is added initially.
- Label the one-sol crop cycle and nourishment rates as accelerated gameplay assumptions. Do not present real crops as reaching maturity in one Martian day.
- Prioritize essential base/shelter loads, then oxygen, then greenhouse growth. Expose priorities and actual supplied power; never advance a crop that is not powered.
- Rebalance the seven-sol electrical/food reference strategy after adding this load. Existing 60 m² / 24 kWh defaults are not presumed sufficient under every new event sequence.

The tutorial must demonstrate the trade-off: feeding future-you uses electricity today, while switching growing equipment off saves power but delays food.

## 9. Scripted events across seven sols

Use a local, versioned scenario schedule with reproducible event IDs and optional seed-based variation. Remove automatic live-data syncing from the normal build/game path. Retain archived NASA reference attribution and the optional manual data-research script; no API key is needed to play or judge the game.

Implement event lifecycle: scheduled → warning → active → recovery → ended. The **same event pipeline** drives simulation, visuals, audio, objectives, debug triggers and the mission summary.

Proposed default pacing:

| Sol | Event / decision |
| --- | --- |
| 1 | Orientation and the first sunset: store enough energy for the night. |
| 2 | Mild dust episode: visibly reduced clarity and panel output; plan cleaning. |
| 3 | Cold-night heating demand: temporary, explained additional electrical load. |
| 4 | The reconstructed particle event with advance warning: shelter versus outdoor maintenance. |
| 5 | Recovery and harvest: restore reserves and prepare the next crop cycle. |
| 6 | Stronger dust episode: generation and maintenance pressure before night. |
| 7 | Final overnight demand and survival to the end of the sol. |

Exact timings, severity, duration and overlap constraints are editable. Some useful events are recoveries or crop readiness, not constant catastrophes. Prevent impossible combinations and prove the default run is winnable using a documented control strategy.

Initial visual implementations:

- **Dust:** bounded low-poly particles/haze, lower sun illumination and panel transmission, plus a clear HUD warning. Respect quality settings and cap particle count.
- **Particle event:** warning beacon/suit indicator, shelter lighting and a readable sky/telemetry cue explicitly presented as an interface visualization. Radiation itself is invisible; do not invent a literal damaging radiation cloud or blast wave.
- **Cold-night demand:** frosted/cool station lighting and an electrical-load alert. Do not simulate unrelated thermal physiology in this milestone.
- Keep flare photons, particle events and dust storms conceptually distinct. A flare does not automatically create Martian dust or a surface-dose value from its class.

A matching short tutorial explains each meaningful new event and its response before the survival run.

## 10. New unified Debug window

The new HUD's Debug button opens one top-right window containing all previous settings and new categories. Keep descriptions, units, numeric input, presets and versioned import/export.

Add:

- **Tutorials:** start/restart a specific module, inspect task completion, reset practice state.
- **Events:** trigger dust/particle/thermal events, choose warning-first or immediate, adjust intensity/duration, end the selected event, clear scheduled events, restore default schedule.
- **Clock:** day/night preview, speed and sol controls with clear reset semantics.
- **Food/crops:** nourishment and growth settings, power draw, mature a test crop, and visible growth/supply status.
- **Recovery:** stress and dose settings with unmistakable labels.
- **Audio:** audition replacement cues, volumes and a mute control.

Debug activation must work outside the mission as a labeled test simulation; no need to first discover the correct legacy mode. While paused, show whether a command is queued for Resume or is a visual-only preview. Do not advance hidden time to make an event appear.

Tag debug-modified runs and record a small event/action log so testers can reproduce a bug. Restarting a clean challenge restores its schedule and state; tuning/reset behavior must be explicit. This is a single-player testing tool, not an authentication system.

## 11. Lander and landing-site blockout

The inspected `Lander.glb` is 175,772 bytes, has `body`, `Detail` and `Door` nodes, two named materials, and no animation clips. Its node scales are nonuniform, so compute world bounds before placement rather than interpreting mesh-local coordinates as metres.

- Place it beside the station on a marked landing pad with a clear walking route to the entrance.
- Proposed initial pad center: approximately (10, -8) in X/Z, adjusted after measuring world bounds so it cannot overlap the habitat, solar yard, shelter or map edge.
- Preserve the supplied file and set position, rotation, grounding and scale through the asset manifest.
- Use simple body/leg collision proxies and a safe spawn marker outside the closed door. Do not let the player spawn inside a collider or become trapped between pads and buildings.
- Use cones, a landing outline and placeholder access equipment as the requested blockout. Keep it static; no takeoff, animated door, camera cutscene or scripted story sequence yet.
- Give the modeler a stable origin/scale convention so a later revision can replace the model without moving the whole level.

## 12. Replacement audio

The current pack will stop being the default. Keep the uploaded originals archived rather than deleting user assets.

Recommended new direction: quieter, less repetitive, with soft granular ground steps, short low-impact jumps/landings, sparse suit/mechanical cues, restrained wind and clear but unobtrusive alerts. No loud continuous rumble or repeated sharp chirps.

Implementation at medium effort:

- Create original procedural sound buffers using Web Audio noise, filters, short envelopes and controlled variation; render/cache buffers where useful rather than adding a new service dependency.
- Separate master, ambience, footsteps, interface and event buses. Keep a minimum interval for repeated warnings and avoid stacked alarms.
- Tie steps to actual grounded travel; distinguish indoor/outdoor surface where practical. Keep jump/landing cues tied to real controller events.
- Fade ambience and cues between menu, tutorial, indoor/outdoor, paused and mission states. Browser audio still unlocks after Play/click.
- Provide an audition row/presets in the same Debug window so the user can compare the new direction quickly.
- These are synthesized game sounds, not NASA recordings. Any optional recorded NASA audio must be separately sourced and credited; it is not required for this milestone.

No audio-generation connector is currently available in the tool catalog. Procedural synthesis is the concrete implementation route; do not promise an unavailable generative audio service or voice cast.

## 13. NASA imagery and data documentation

If photographic images are used, source them only from NASA-controlled resources such as NASA's Image and Video Library or an appropriate NASA/JPL resource. Check the actual credit and reuse information for each selected image; do not treat an unrelated third-party image on a NASA page as automatically NASA-owned.

Bundle a small optimized set locally with source URL/asset ID, credit, caption and retrieval date. No stock-photo sites, external placeholder-photo services, runtime API requirement or fabricated “NASA” imagery. Use a simple graphic fallback if an optional photograph fails to load.

Retain the RAD-reference and reconstructed-event labels in the science view and methods file. Game stress, nourishment, crop growth and hardware balancing remain clearly identified as modeling/game assumptions. No NASA endorsement is implied.

## 14. Medium-effort execution order

| Milestone | Deliverable | Required verification |
| --- | --- | --- |
| A | Central game-flow and interaction APIs; reproducible fixes for solar focus/range/hold behavior and recovery feedback. | Input/focus, target selection, cancellation, shelter rate/stress behavior, and compatibility tests. |
| B | Nebula menu, approved icon HUD, unified pause/results/debug window, and landing-site placement. | Keyboard menu flow, no background resource advancement, layout checks, lander grounding/collision and spawn path. |
| C | Nourishment, powered crops, auto-replanting, and revised energy priorities. | Consumption, meal bounds, one harvest per ready crop, growth stops without power, repeated seven-sol balance. |
| D | Scheduled event director, visual disasters and debug activation. | Warnings/lifecycle, reproducibility, overlap limits, visual/simulation agreement, cleanup/reset. |
| E | Separate dialogue tutorials, communication example, fresh mission handoff, win/loss and both restart routes. | Complete new-player path and skip/restart paths; no practice-state leakage; concise dialogue review. |
| F | Replacement audio, optional curated NASA images, final polish and documentation. | Playback/volume/state checks, source records, performance checks, regression suite, production build and deployed Pages verification. |

Use existing Three.js/Rapier, the asset manifest, the GLB pipeline, shared settings and event data. Keep changes in reviewable commits. No backend, live API polling, new terrain engine, full inventory/crafting system, multiplayer or story/cutscene work is included.

Run meaningful tests after each affected milestone. Run the full suite and browser journey before final deployment; do not repeatedly rerun unchanged broad checks merely to fill time. Test low-quality mode and report actual device testing separately from viewport emulation.

## 15. Completion criteria

- Play starts a clear tutorial sequence, not the old developer scene UI.
- Every taught mechanic can be performed without debug controls and demonstrates a real cost/consequence.
- Solar cleaning is reachable, understandable, cancellable and visually reflected in the real GLB.
- Recoverable stress visibly falls in the intended safe fixture; physical dose remains correctly cumulative.
- Powered food regrowth, oxygen production and shelter/base loads share one energy budget without free resources.
- The seven-sol schedule is active without network access, has meaningful pacing, and is survivable with an appropriate strategy.
- Debug can visibly activate each supported disaster through the same underlying event model.
- Death and victory show the actual cause/result and offer working restart routes to training or challenge.
- The lander is placed with safe blockout collision and remains replaceable.
- All tuning stays in one top-right categorized window with descriptions; the player's HUD stays compact and background-free at the bottom.
- Replacement audio is the default, can be previewed/muted, and has documented provenance.
- CI/CD passes, and the published game is checked for actual startup and the main player journey.

## Proposed defaults requiring review, not a blocking questionnaire while the user sleeps

Approval of this plan would accept the proposed defaults for nourishment, powered crops, the event calendar, dialogue sequence, automatic power priorities and procedural audio direction. All remain editable. The user can revise individual values before or after implementation. Story/cutscenes and a full save-game system remain separate work.

This file records the approved design. See GAMEPLAY.md and the implementation checks for shipped behavior.

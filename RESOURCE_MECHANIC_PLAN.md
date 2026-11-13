# Nebula: placeholder data and first resource mechanic

Status: **Approved by the user for implementation.**

## Purpose and scope

Add one understandable engineering trade-off to the existing Mars foundation: **producing oxygen consumes limited electrical energy**. Use clearly labeled fictional training data first, with a data boundary that can later accept selected NASA observations or archived datasets.

The challenge brief supplied by the user emphasizes real survival trade-offs for ages 7–12. The broader intended audience remains ages 7–14 with adult/classroom support. This milestone introduces a small training exercise, not a complete mission campaign or an accurate life-support simulator.

The user has requested a plan for review. Everything below is a recommendation, not an unanswered requirement silently treated as settled. Approval accepts these proposed defaults; edits are welcome.

## What the player experiences

1. The existing movement sandbox remains available without resource pressure. Choose **Start resource training** to begin the optional exercise.
2. A brief explains: “Your outpost has a limited battery. The oxygen maker uses electricity to refill its oxygen tank. Keep both supplies above zero until the training timer ends.”
3. Walk to a clearly marked placeholder oxygen unit. Within the interaction range, press **E** to switch it on or off. Show the current state and the effect before the player acts.
4. Two labeled meters show **Battery** and **Oxygen reserve**, including numeric percentages, trend arrows, and plain-language explanations. A countdown shows training time remaining.
5. The player observes the trade-off: with the unit off, oxygen falls while energy drains slowly; with it on, oxygen rises but energy drains faster.
6. Finish with an explanation of the choices made, time the unit ran, and final reserves. Either resource reaching zero ends the exercise with a supportive retry message; no death sequence or punishment.

Example prompt: “E · Turn oxygen maker ON — oxygen will rise; battery will drain faster.” Once on: “E · Turn oxygen maker OFF — save battery; oxygen will fall.”

No separate confirmation dialog is needed for each toggle. The next action should always be readable before pressing E.

## Scientific framing

- The tracked reserves belong to an abstract outpost, not the astronaut's suit. Walking, running, and jumping do not change their consumption in this milestone.
- The generator is a simplified electrically powered oxygen-production system. Feedstock, storage hardware, other consumables, pressure, and temperature are assumed available and are not modeled yet.
- Use normalized training units, displayed as percentages of capacity. Do not label these values as litres, kWh, real astronaut endurance, or measured NASA performance.
- This exercise represents a short battery-limited interval without recharging. A note explains that oxygen production needs energy and other inputs in real systems.
- Display **“Simulated training data — not live NASA measurements.”** Include a readable “About this model” explanation.
- Later NASA data must have a specific supported connection to the mechanic. DONKI events do not directly measure radiation dose on Mars, and an API response cannot replace invented life-support rates without a justified model.

## Proposed adjustable starting values

These values are fictional game-balance parameters. One simulation second equals one real second while training is running; this does not represent an actual mission timeline.

| Parameter                            | Proposed value                                  |
| ------------------------------------ | ----------------------------------------------- |
| Training duration                    | 120 simulation seconds                          |
| Battery / oxygen capacity            | 100 units each                                  |
| Starting battery                     | 70 units                                        |
| Starting oxygen                      | 35 units                                        |
| Initial generator state              | Off                                             |
| Background electrical consumption    | 0.1 battery units/second                        |
| Oxygen consumption                   | 0.6 oxygen units/second                         |
| Additional generator electricity use | 1.2 battery units/second while on               |
| Generator oxygen production          | 1.2 oxygen units/second while on                |
| Warning threshold                    | 25% of each capacity                            |
| Critical threshold                   | 10% of each capacity                            |
| Interaction range                    | Reuse the existing adjustable interaction range |

For elapsed simulation time `dt`:

- `battery -= (backgroundDrain + (generatorOn ? generatorDrain : 0)) * dt`
- `oxygen += ((generatorOn ? oxygenProduction : 0) - oxygenConsumption) * dt`
- Clamp reserves to `[0, capacity]`. Production above capacity is wasted, but the running generator still consumes energy.
- Stop at the first depletion or completion boundary, not after a whole frame overshoots it. Depletion exactly at the end counts as needing another attempt: success requires both reserves to remain positive.

The defaults have an achievable trade-off:

- Always off: oxygen reaches zero after about **58.3 seconds**.
- Always on: battery reaches zero after about **53.8 seconds**.
- On for the first **40 seconds**, then off for **80 seconds**: finish with **10 battery** and **11 oxygen** units.

This example is an implementation acceptance case, not a mandatory tutorial solution. Other schedules can succeed. The first version is intentionally deterministic for balancing and classroom comparison.

## Placeholder data boundary

Separate scientific observations, scenario settings, and simulation state rather than storing them in one ambiguous NASA-like payload.

- **Scenario definition:** version, ID, display name, duration, initial reserves, capacities, rates, thresholds, and optional scripted events. For this milestone there are no environmental events; do not invent solar storms solely to fill a schema.
- **Source metadata:** `kind` (`simulated`, `archived`, or `live`), provider name, dataset identifier, attribution text, source URL when applicable, observation time when real, and retrieval time when fetched. Simulated records have no fabricated observation time or NASA attribution.
- **Provider interface:** load a validated scenario and its source metadata asynchronously. The initial provider reads a bundled local fixture and requires no API key or network request.
- **Simulation state:** elapsed time, remaining reserves, generator state, lifecycle state, and a compact choice log. Keep this deterministic and independent of Three.js, Rapier, browser rendering, and future HTTP clients.
- **Future adapters:** translate a selected NASA dataset into supported environmental inputs. Preserve units, provenance, timestamps, and model assumptions. Keep game-balance settings separate; scientific data will not magically supply the depletion rates above.

Reject nonfinite or negative rates, invalid capacities, initial values outside capacity, invalid duration, and inconsistent thresholds. A bad scenario prevents training from starting and offers the unchanged sandbox; it must not crash movement or silently substitute unlabeled invented data.

## Integration with the existing foundation

- Proposed files: `src/data/types.ts`, `src/data/mock-provider.ts`, a versioned local scenario fixture, `src/resources/config.ts`, `src/resources/simulation.ts`, and `src/resources/ui.ts`.
- Put the placeholder oxygen unit and its visual state behind the existing asset replacement convention. Keep the existing beacon as a separate sandbox test object.
- Route E to the nearest eligible interaction target, within range and with suitable vertical separation; do not activate both the beacon and oxygen unit with one keypress. Show a single contextual prompt.
- Keep all movement, collision, and camera values intact while teammates test them. No retuning as part of this milestone.
- **R** remains a player-position reset only. Training needs its own explicit **Restart training** button. Falling and respawning do not refill reserves or restart time.
- Training lifecycle: `ready → running ↔ paused → completed / needs-retry`. Pause resource time on explicit pause, tab hiding, and window focus loss. Pause while editing resource settings. Do not process hidden-tab catch-up depletion when returning.
- Use one simulation clock for resources and the timer, independent of rendering FPS. Do not tie it to the movement loop's catch-up limit, which can slow simulation time on low-FPS devices. Test equivalent resource results across different frame schedules.
- Keep temporary pauses separate from an ending. Returning to the tab does not restart or replenish training.
- Resource tuning is separate from the current movement settings schema. Export/import versioned resource settings with validation; changes apply through an explicit restart, avoiding ambiguous mid-run balance changes. Preserve existing movement imports.
- Persist resource tuning, not an unfinished training session. Reloading returns to the sandbox and requires an explicit training start.

## Interface and accessibility

- Compact resource HUD and timer, avoiding overlap with movement readouts or the tuning panel.
- Numbers, text, and symbols supplement color; no red/green-only status communication.
- Gentle threshold messages appear on crossings, rather than repeating every frame. No flashing alerts.
- Keyboard-accessible start, pause/resume, restart, and exit controls. UI focus must not trigger character movement or jump; clear held game input when entering training dialogs and menus.
- Use percentages and “rising / falling” language instead of technical rates in the main player UI. Expose precise units and rates in developer tuning and the model explanation.
- Responsive layout continues to support narrow screens. Touch gameplay remains deferred; no mobile controls are added by this milestone.
- No audio, new animation requirement, final art, backend, analytics, or additional rendering effects.

## Proposed implementation sequence after approval

1. Add the scenario types, validation, bundled simulated provider, and source labels.
2. Implement and test the standalone resource simulation and lifecycle rules.
3. Add the placeholder oxygen unit, interaction targeting, optional training entry, meters, prompts, and end feedback.
4. Add resource tuning, JSON transfer, and the model/source explanation.
5. Run existing movement regressions and the new checks, then use the existing CI/CD pipeline for delivery.

## Acceptance checks

- Initial fixture loads without internet or credentials; all player-facing data/source views identify it as simulated.
- Always-on, always-off, and the 40-second-on/80-second-off example produce the expected results above within numeric tolerance.
- A full oxygen tank does not stop electrical consumption unless the player switches the generator off.
- Reserves stay within capacity; the first terminal boundary ends the simulation consistently, including exact-zero-at-completion cases.
- Equivalent simulation time split into 30, 60, 120 FPS, or uneven frames produces equivalent outcomes. A normal visible stall is handled consistently; a deliberate pause consumes nothing.
- Pause, focus loss, hidden tabs, dialog editing, completion, and retry stop consumption appropriately. Resume does not apply paused wall-clock time.
- E activates only one eligible target, rejects out-of-range interactions, and reports the actual generator state.
- Restart resets the resource scenario; R and falling reset only the character. Exiting training restores the pressure-free sandbox.
- Valid resource settings round-trip; bad fixtures/imports fail clearly and existing movement settings remain compatible.
- Browser tests cover start, on/off interaction, meter changes, pause, restart, end feedback, and responsive layout. Existing movement/physics checks continue passing.
- GitHub CI passes type checking, tests, and build before Pages deployment. Verify the deployed application and label any deployment or device-testing limitation honestly.

## Deferred decisions and scope

No NASA endpoint, API key, live refresh interval, radiation event, solar recharge, inventory, base building, missions beyond this short training exercise, or resource-dependent movement is selected here. Those require a later proposal tied to specific gameplay and data sources.

## Approval

Approve this plan or request edits before implementation. Approval covers the proposed optional exercise, fictional defaults, data boundary, controls/UI, tests, and delivery through the existing CI/CD pipeline. It does not approve unlisted NASA integrations or additional mechanics.

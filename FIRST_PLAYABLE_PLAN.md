# Nebula: first playable game slice

Status: **Proposed next milestone.** Idle-animation and recoverable-stress integration are approved current work. UI references and the first-slice objective are being requested before implementing a visual redesign or expanding scope.

## Recommendation

The foundation is sufficient. Build a coherent, presentable seven-sol maintenance game using the systems already implemented before adding exploration, inventories, crafting, repairs or more simulation subsystems. The current scene, movement, physics, solar power, oxygen, space-weather event, shelter, sounds and player animation supply the core loop.

## Proposed objective

Maintain the outpost for a configurable seven Mars sols: keep oxygen available, keep equipment supplied through day/night, clean the tracking array when needed, and seek shelter during the particle event. Show the current goal and next useful action instead of expecting players to discover the simulation through developer controls.

This remains a recommendation until the user confirms it is the intended first slice. If exploration or another objective is preferred, revise the milestone before building it.

## Proposed flow

1. **Start screen:** Play, brief controls/help, audio/quality options, science/sources. Keep the scene visible behind the menu where appropriate. No overwhelming developer readout as the first experience.
2. **Short optional onboarding:** learn movement, interact with the oxygen plant, hold to clean the array, and locate shelter. Practice should not consume the actual survival run's supplies or exposure budget; use an isolated practice state/fixture. Let returning players skip it.
3. **Playing:** one concise objective, resource status, sol/time and contextual interaction prompts. Show actionable warnings when supplies or the event require attention. Avoid repeated alert spam.
4. **Pause:** resume, restart with confirmation, help, sound/quality, return to menu. Freeze simulation and input consistently, and suspend appropriate audio.
5. **Results:** clear success/failure, elapsed sols, remaining reserves, physical exposure, maintenance performed and a short explanation of the limiting trade-off. Offer retry and menu.
6. **Developer/testing mode:** retain sandbox, the legacy resource exercise, all tuning/import/export and detailed telemetry in the top-right panel, behind a clearly marked toggle. Do not remove tester capabilities during the redesign.

Use one explicit game-flow state controller so menus, onboarding, play, pause and results cannot unintentionally run overlapping simulations or capture movement input while typing.

## UI recommendations to refine with references

- A compact resource HUD rather than the current large scrolling training panel.
- Sol/time and mission progress remain easy to read during movement.
- Contextual E/hold-E prompts stay close to the relevant action; show hold progress clearly.
- Notifications explain an action: “Power deficit—reduce demand or check the array,” rather than a stream of raw numbers alone.
- Keep accumulated mGy and current dose rate distinguishable from the recoverable fictional stress meter. Do not label physical dose as healed when stress falls.
- Put methods/source attribution in an accessible science/info view; retain visible data-status labels and concise metric explanations.
- Keep every developer setting in the categorized top-right panel with its description and units.
- Define normal, warning, critical, paused, disabled and selected states. Use icons/text as well as color, keyboard focus styling and readable contrast.
- Plan narrow-screen layouts and quality controls. Touch gameplay remains a separate approved milestone; responsive UI is not a claim of complete mobile controls.

Layout, typography, palette, panel shapes and animation style should follow the user's references rather than an invented final visual direction. The reference request asks for 1–3 titles/links and what to borrow from each.

## Actual game versus foundation

The next work is to connect and communicate existing mechanics, not add more isolated widgets. New functionality should directly serve the seven-sol goal. Continue using placeholder station art until the modeler supplies final assets; avoid rebuilding the same flow around unfinished art.

Potential later additions, separately scoped: equipment failures, repairs, suit oxygen/refill, exploration tasks, communications, new environments and expanded outpost construction. None is silently included in this milestone.

## Recoverable radiation stress — current integration

- A fictional 0–100 meter, separate from cumulative absorbed dose.
- Proposed editable defaults: 15 stress points per mGy received, and 6 stress points removed per sheltered simulation hour.
- Integrate incoming stress and recovery using the same simulation clock as resources. Clamp to 0–100; pause freezes both recovery and incoming exposure.
- Physical dose remains monotonic; the existing dose limit still ends the run immediately. Stress at 100 is currently a warning, not a new undisclosed failure condition.
- Keep gain/recovery/enable controls in top-right Base → Recovery, with explicit descriptions that these are game-balance assumptions, not NASA health data.
- Scenario restart clears stress; character respawn/reset does not. Existing base exports receive additive defaults without losing previous settings.

## Acceptance for a first playable

- A new tester can start, understand the goal, perform each core action and reach a clear result without opening developer settings.
- The tutorial is skippable and isolated from survival state; game time cannot advance behind a blocking menu.
- Existing movement, hold-to-interact, power, oxygen, shelter, radiation, audio and source/provenance checks continue passing.
- A documented reference strategy can complete the default scenario; failure messages identify the actual limiting system.
- Keyboard navigation, focus/input release, audio unlock, pause/resume, restart and menu transitions receive browser tests.
- Reference-inspired UI is checked at desktop and narrow viewports; actual mobile controls/performance remain separately reported.
- Successful CI/CD and a functional request/browser check of the published Pages build complete delivery.

## Inputs requested

1. Confirm seven-sol base maintenance as the first slice, or identify the alternative main objective.
2. Provide reference titles/links and which aspects to borrow. Images/screenshots can also be supplied in chat.
3. Choose whether detailed physical exposure belongs in the default HUD or an expandable suit/status view; recommendation: compact default plus expandable detail.

After these choices, implement the game-flow and UI together in reviewable stages. Do not call the current developer HUD the final game interface.

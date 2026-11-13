# Nebula · Mars field lab

A keyboard-first Mars movement foundation for the Junior Astronaut Mission Trainer challenge. Three.js renders the scene; Rapier provides character collision. This sandbox contains no mission or educational resource simulation yet.

## Run

Use Node 24 and npm. Run `npm ci`, then `npm run dev`. Vite serves the application under `/Nebula/` (use the address printed by Vite plus that path). `npm run build` checks TypeScript and builds `dist`; `npm run preview` serves the production build.

- WASD/arrows: camera-relative movement
- Shift: run; Space: fixed jump with air steering
- Hold C: crouch; E: inspect the nearby field beacon
- R: reset to spawn

Touch input is deferred; mobile rendering currently requires an external keyboard for play. Click the scene to focus it. Keyboard input does not capture tuning text fields.

## Tune

Open **Field lab · tuning** at the top right. All movement, gravity, collider, camera and quality values are in `src/config.ts`. Panel edits persist locally, can be exported/imported as versioned JSON, and can be reset. Invalid imports are rejected. Heights include the capsule's rounded ends. Camera angles and slopes are in degrees, distances in metres. Camera smoothing and movement acceleration are independent of render rate. Use the low quality preset on slower devices. 60 FPS is a target, not a hardware guarantee.

Gravity starts at 3.71 m/s², a rounded Mars surface value; all other controller defaults are gameplay tuning choices. This is not a NASA-validated simulation. Challenge: https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/

## Modeler handoff

Place models in `public/models/` and set `assets.astronaut.path` in `src/assets.ts` to `models/astronaut.glb`. No leading slash: Vite's Pages base path is applied automatically. Use metre scale, Y-up, feet at origin, and forward +Z. The manifest exposes scale, yaw (radians), offset and clip names to accommodate differences. Collision remains independent of the model. Missing files keep the placeholder; missing clips leave movement working without animation.

For Mixamo animations: download the character once with skin, then each compatible animation without skin. In Blender import the character and animation FBX files using the same rig. Transfer compatible actions onto the character armature, name them `Idle`, `Walk`, `Run`, `Jump`, `Crouch`, and retain each action using NLA tracks or fake users. Remove duplicate imported rigs after preserving actions. Export the character mesh and armature as GLB with animations enabled and Actions/NLA export appropriate to your Blender version. Inspect the resulting clips before delivery. All animation files must use the same skeleton; differently named or proportioned rigs need retargeting first. The manifest maps the exported clip names to controller states. Final art and animation authoring are not included in this prototype.

## Checks

`npm test` runs settings and real Rapier controller tests. `npm run typecheck` verifies types. Install Chromium once with `npx playwright install chromium`, then run `npm run build && npm run test:browser`. Browser tests exercise initialization, keyboard movement, jumping, crouching, reset and mobile viewport rendering. Headless browser emulation is not physical-device performance testing.

## GitHub Pages CI/CD

`.github/workflows/pages.yml` installs locked dependencies, checks types, runs physics/settings tests, builds and runs a Chromium smoke test. Pull requests only validate; successful `main` builds deploy using GitHub Pages artifacts and OIDC. In repository **Settings → Pages**, select **GitHub Actions** as the build source. The expected path is `https://YoussefHossam328.github.io/Nebula/` once a deployment succeeds. Changing the repository name requires updating `vite.config.ts`.

## Limits

Static terrain collisions; decorative rocks/mountains do not collide. Camera collision and fading are deferred: scenery may occlude the character in some positions. No dynamic object pushing, touch/gamepad input, missions, accounts or backend. The renderer currently loads Rapier's bundled WASM; initial download is larger than a render-only demo. Actual phone/browser and GPU testing remains necessary before claiming broad compatibility. Future educational gameplay should implement genuine survival trade-offs and attribute any NASA datasets used, marking archived data honestly.

## Optional resource training

Choose **Start resource training**, then click the scene to focus keyboard control. Walk to the **O₂ unit** and press E to turn production on/off. Oxygen production consumes limited battery power. Pause/Resume, Restart training and Exit training are available in the training panel. Tab hiding or focus loss pauses supplies; resume explicitly. R and falling reset only your position.

The two-minute exercise uses **fictional training data**, not live NASA measurements. Percentages describe abstract outpost reserves, not suit endurance or physical litres/kWh. The model assumes feedstock is available and no recharging occurs. Open **About this model / resource settings** to edit rates and capacities, apply and restart, or import/export resource JSON. These settings are stored separately from movement settings. Session progress is not saved. All future scientific observations must retain source metadata and be translated into supported model inputs; no NASA API is connected yet.

`src/data/scenario.json` contains the fixture; `src/resources/simulation.ts` is the deterministic model. The defaults allow 40 seconds of oxygen production followed by 80 seconds off to finish with 10 battery and 11 oxygen units. Leaving it always on or always off fails. Resource tests cover rates, terminal boundaries, frame independence, pause and validation.

## Unified settings and camera

All tuning is in the **Settings** panel at the top right: Movement, Physics, Camera framing, Camera follow, Camera shake, Rendering, Resources, and Presets/files. Resource model details and import/export have moved there from the left HUD. Training operations remain with the HUD.

`followDelay` is in seconds. `smoothing` is responsiveness (higher catches up faster). The camera uses the same filtered target for position and aim, and character rendering interpolates physics steps. Reset/teleport clears the follow history. Shake starts disabled; enable it to use the landing trigger or Preview shake. Strength is in metres, frequency in Hz, duration in seconds. Existing saved movement settings automatically receive the new defaults. More ambitious energy and radiation systems are proposed in `EXPANDED_SYSTEMS_PLAN.md` and await scope decisions.

## Seven-sol base scenario

Click **Start base maintenance · 7 sols** in the training HUD, then click/focus the scene. The old two-minute exercise and pressure-free sandbox remain available. The scenario starts at morning and lasts seven Mars sols at 180 real seconds per sol (about 21 minutes before pauses).

- The array west of spawn follows the sun with an idealized dual-axis tracker, adjustable tilt limits, and explicit tracker electrical draw. Disable tracking to compare fixed orientation. Tracking is a modeled hardware choice, not a claim that all Mars arrays track.
- Hold E near the array for four real seconds to clean it. Release, leave range, change target or pause to cancel. Dust transmission and cleaning effectiveness are editable. Route around the oxygen unit rather than walking through it.
- Press E near the oxygen unit to enable/disable CO₂-processing production. A powered plant produces 0.05 kg/hour using 1.5 kW in the starting preset. Feedstock is assumed available. These hardware rates are assumptions, not MOXIE performance claims.
- Walk into the shelter northeast of spawn through its open south side when the particle-event warning arrives. Passive shielding works even without electricity. The environmental-support load is added while occupied.
- Dose reaching the operational limit or oxygen reaching zero loses the run immediately. Empty battery sheds oxygen production; remaining essential load deficits are displayed. The game does not invent a separate instant-death rule for missing power. Survive all seven sols to complete the run.
- R/falling only resets position. Pause stops all scenario systems and cancels cleaning. Hidden tabs and focus loss pause the scenario and require explicit Resume. A scenario restart resets supplies, dust and dose.

**All tuning lives in top-right Settings → Base · seven-sol scenario**, including clock, ideal tracking, dust, hold duration, geometry, shielding, power and oxygen rates. Changes pause the run; **Apply base settings and restart** commits validated changes. Base settings use their own version-2 JSON and local-storage key, preserving old movement and two-minute exercise exports. Camera shake now has independent landing and running triggers beneath the master enable. All shake is off unless the master is enabled.

The balanced starting electrical preset is a 60 m² array and a 24 kWh battery. This differs from early tentative planning numbers because the complete night/storage/oxygen balance is now tested. A reference strategy with periodic cleaning and shelter during exposure completes seven sols. No hardware is a NASA-certified life-support design. Simulation power quadrature uses bounded 30-second steps; dose profiles are integrated analytically. The site is a representative equinox/daylight profile, not a validated Gale solar ephemeris or weather forecast. The tracker has ideal instantaneous positioning within a tilt limit; actuator dynamics/backlash are not modeled.

### NASA methods and limitations

The baseline is a Curiosity RAD literature reference of 0.21 mGy/Earth-day (Hassler et al., Science 2014, DOI 10.1126/science.1244797; NASA NTRS record 20180007641). An archived NASA/JPL account of the May 20, 2024 event reports 8.1 mGy near Curiosity. We reconstruct an eight-hour triangular event at elapsed sol 3 (the start of displayed Sol 4). This is **not a measured time series or a current Mars radiation forecast**. The reported event total is treated as including background over our reconstructed window: subtract that window's modeled baseline before adding the transient curve, preventing double counting. This is an explicit reconstruction assumption; changing the window alters that separation.

Shielding factors are scenario assumptions, separately applied to baseline and transient exposure. The displayed quantity is a RAD-reference absorbed-dose proxy in mGy, not effective human dose in mSv. The default 5 mGy loss limit is a mission/game rule, not a lethal dose or a NASA astronaut standard. See in-game **Base → Sources and assumptions** and `NASA_DATA_USAGE.md`.

`npm run refresh:nasa` fetches archived DONKI context from May 10–21, 2024. It uses `NASA_API_KEY` if supplied, otherwise NASA's public DEMO_KEY. GitHub Actions calls it before production builds (not on pull requests). Store an optional personal key in repository Actions secrets; no key belongs in browser settings, source or built artifacts. The current context archive was fetched using DEMO_KEY; the personal key shared in chat was not stored or used. API errors retain the labeled, timestamped bundled cache. DONKI instrument events are context only and do not drive radiation dose. See `scripts/refresh-nasa.py` for the exact bounded request and sanitized fields.

Base assets can also be replaced through `assets.solarPanel` and `assets.shelter` in `src/assets.ts`. Put GLBs under `public/models/`; paths are relative to the Pages base. The solar model replaces the moving panel plate/grid (not the mast), with its receiving normal along local +Y and origin at the tracking pivot. Shelter models use a floor-level origin at the protection volume's center, open on the -Z side. Procedural collision/protection dimensions remain controlled in Base settings and must match the replacement model. Missing GLBs retain placeholders.

## Placeholder station and tester help

The main scene is now a compact station rather than the scattered movement course. The habitat is north of spawn, with an open south entrance, control desk, battery cabinet, bunk and supplies. The solar/oxygen utility yard and shelter remain connected by marked paths. Enter the habitat to hide its separate roof and camera-side wall meshes; collision stays active. **Settings → Station view** can hide the roof manually or disable automatic cutaway. These primitive groups are named `Habitat`, `Floor`, `Walls`, `Roof`, and `InteriorProps` to guide the later GLB handoff; final art and model-specific cutaway authoring remain a later step.

Every developer control now has a short inline explanation, units where applicable, and accessible input help. Base settings explain that changes pause the run and require Apply/restart; legacy exercise fields explicitly use fictional units. Existing saved settings receive the new station-view defaults without losing their previous values.

Facing follows the last nonzero movement input and remains fixed during braking. It no longer follows independently decelerating X/Z velocity components, which could rotate the astronaut as one component reached zero before the other. Movement acceleration and braking behavior are otherwise unchanged.

## Supplied player and audio

`public/models/player.glb` is the user-supplied astronaut. The embedded clips are `Armature|mixamo.com|Layer0` and `mixamo.com` (both approximately 1.617 seconds, closely related locomotion exports). The second supplies walking and faster running playback. Horizontal hip travel is removed at runtime so animation cannot move the mesh away from the Rapier body. The loaded model is fitted to a 1.6 m reference visual height; its physics collider stays independent.

There are no separately named authored idle/jump/crouch clips in this file. Missing states use a static pose sampled from locomotion; crouching retains the prototype visual-height adjustment. This is an explicit fallback, not a claim of a complete animation set. The asset manifest supports adding properly named clips later. Original GLB data is retained unchanged. Adjust visual scale, forward-direction correction, foot offset, crossfade time and locomotion playback in **Settings → Player model and animation**.

Turning now interpolates the shortest arc between headings while movement input is active. Release freezes the visible heading, so easing does not introduce an extra turn afterward. **turnResponsiveness** controls how quickly turns happen. Keyboard movement still requests eight directions; the visual transition between them is continuous.

The nine user-supplied WAVs live under `public/audio/`: an eight-second background loop, three walking variations, three sprint variations, jump and landing. Browser playback unlocks after a click/key press. Steps are based on actual grounded travel (not merely holding a key against a wall). Audio suspends on focus loss/hidden tabs, with independent master/ambience/effects volumes and step distances under **Settings → Audio**; **Audio · preview** tests the landing sound. If browser audio is unavailable, the game continues.

Physical dose remains cumulative. The exposure HUD now explicitly distinguishes past absorbed mGy from the incoming dose rate and shows the shelter’s modeled rate reduction. A separate recoverable game stress meter is pending the user's choice; no scientific dose-decay mechanic has been invented.

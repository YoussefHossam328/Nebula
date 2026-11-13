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

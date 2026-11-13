# Nebula: Mars game foundation

Status: **Approved for implementation** by the user in chat on 2026-11-13.

## Goal

Build a browser-playable foundation for a low-poly Mars game using Three.js and Rapier. The first prototype lets the user evaluate movement, collision, camera framing, and adjustable parameters before supplying final values and designer-created GLB assets.

This is a mechanics sandbox, not the completed hackathon entry.

## Challenge context

Challenge: https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/

The user supplied the challenge text because direct access was blocked by the environment's network policy. The brief targets ages 7–12 and emphasizes teaching genuine outpost survival trade-offs involving resources, power, radiation, and other constraints. NASA open data is encouraged, with honest attribution and clear separation of archived and live data.

The user's intended audience extends to ages 7–14, supported by adults or classroom teaching. This foundation should stay approachable and leave clear extension points for future educational gameplay. It will not yet demonstrate the challenge's required trade-off mechanic or claim to be a complete submission.

## Confirmed requirements

- Three.js rendering and Rapier physics.
- An on-foot astronaut with walk, run, jump, crouch, and interact actions.
- Fixed jump launch, gravity, and air steering.
- A following perspective camera with an isometric-style viewing angle.
- Real 3D depth, slopes, steps, cliffs, and mountains; movement is not restricted to a side-scrolling plane.
- Mars colors and low-poly placeholder assets throughout.
- Replaceable GLB assets when the modeler supplies them.
- Adjustable movement, physics, and camera settings, including numeric entry, persistence, and JSON import/export.
- Keyboard first. Touch controls are deferred, while the layout and rendering should accommodate mobile screens.
- Broad device compatibility with a 60 FPS target where supported by hardware.
- Automatic GitHub Pages delivery through a CI/CD pipeline.
- No missions in this milestone.

## Proposed implementation choices

These recommendations become implementation decisions when this plan is approved.

### Project and architecture

- Vite, TypeScript, npm, Three.js, and the browser-compatible Rapier package with explicit WASM initialization.
- Separate input, character controller, physics, camera, assets, settings, and UI modules.
- Use the existing `/workspace/Nebula` checkout. Do not create another worktree unless requested.
- Render independently from a fixed physics timestep. Bound catch-up work after a stalled frame or tab suspension.
- Use Rapier's kinematic character controller for predictable astronaut movement, collision, slope limits, and step handling. Apply gravity and jump velocity explicitly through that controller.
- Treat one world unit as one metre. Keep player collision dimensions independent of the rendered model.
- Keep placeholder obstacles static. Pushing dynamic objects is outside this milestone.

### Controls and movement

| Action       | Proposed binding or behavior                                  |
| ------------ | ------------------------------------------------------------- |
| Move         | WASD and arrow keys, relative to the camera's horizontal view |
| Run          | Hold Shift                                                    |
| Jump         | Space; jump only while grounded                               |
| Crouch       | Hold C; lower speed and collider height                       |
| Interact     | E near a marked test object                                   |
| Reset player | R returns the player to the test area's spawn point           |

- Normalize diagonal movement so it does not exceed straight-line speed.
- Turn the visual character toward travel direction.
- Give movement responsive acceleration and braking, with reduced acceleration in the air.
- Start with a fixed jump; holding Space will not increase jump height or repeatedly trigger jumps.
- Preserve the feet position while changing crouch height. Check overhead clearance before standing.
- Distinguish walkable slopes from steep surfaces and prevent climbing over the configured slope limit.
- Reset safely after falling below a configured boundary.
- Release held input on focus loss and prevent browser scrolling from game keys while the game has focus. Settings fields must remain usable without triggering character actions.
- Keep actions independent of keyboard bindings so touch can be added later.

### Starting values

All values below are tuning defaults, not final gameplay numbers. Only the gravity value represents a scientific Mars baseline; movement speeds and controller limits are gameplay choices.

| Setting                              | Proposed initial value                             |
| ------------------------------------ | -------------------------------------------------- |
| Physics timestep                     | 1/60 second                                        |
| Gravity magnitude                    | 3.71 m/s² downward                                 |
| Walk speed                           | 2.5 m/s                                            |
| Run speed                            | 4.5 m/s                                            |
| Crouch speed                         | 1.2 m/s                                            |
| Ground acceleration                  | 14 m/s²                                            |
| Ground braking                       | 20 m/s²                                            |
| Air steering acceleration            | 35% of ground acceleration                         |
| Jump rise                            | 1.2 m; derive launch speed from gravity and height |
| Maximum walkable slope               | 45°                                                |
| Maximum step height                  | 0.3 m                                              |
| Standing / crouching collider height | 1.6 / 1.0 m total height                           |
| Collider radius                      | 0.3 m                                              |
| Interaction range                    | 2 m                                                |

Validate settings and reject invalid or incompatible values. Label degrees, metres, and time units. Changing jump height or gravity updates the derived launch speed. Apply collider changes safely at a physics boundary.

### Camera

- Start with a perspective camera approximately 45° around the scene and 35° downward, with a 40° vertical field of view.
- Propose a 12 m follow distance, a target offset near the astronaut's torso, and frame-rate-independent follow smoothing.
- Expose yaw, pitch, field of view, distance, target offset, and smoothing in configuration and the tuning panel.
- No ordinary player-controlled orbit or zoom in this milestone.
- Keep tall scenery out of the initial traversal route's view. General camera collision and obstacle fading are deferred; report any remaining occlusion limitation.

### Test area and placeholders

- One compact Mars-colored test area with a spawn zone, flat ground, ramps, steps, steep surfaces, cliffs, and distant low-poly mountain silhouettes.
- Include labeled test features, a low overhead clearance for crouching, and a marked interaction object.
- Interaction gives visible feedback only; it is not a mission, inventory, or resource system.
- Use simple primitives for the astronaut and scenery. Placeholder geometry must not be required by the movement code.

### Live tuning and designer handoff

- Keep typed defaults in a central configuration, with a collapsible runtime tuning panel.
- Support sliders, exact numeric entry, reset defaults, local browser persistence, and validated JSON export/import.
- Include a settings schema version. Handle malformed imports and unavailable browser storage gracefully.
- Separate model paths, scale, orientation, visual offsets, and animation clip mapping in an asset manifest.
- Document a GLB convention: metre scale, Y-up, consistent forward direction, and a defined character origin. Account for asset-specific differences through the manifest.
- Document the Mixamo → Blender → GLB workflow for combining named animation clips. Proposed clips: idle, walk, run, jump, and crouch.
- Keep movement usable when animations or a custom model are missing. Runtime model loading is in scope; producing final art or animation is not.

### Compatibility and performance

- Target modern desktop browsers and mobile browsers that support the selected WebGL and WASM requirements.
- Mobile rendering and responsive UI are in scope. Mobile play requires an external keyboard until touch controls are added.
- Use simple materials, modest geometry, limited draw calls, restrained shadows, and a capped device pixel ratio.
- Expose low and standard quality settings, with adjustable resolution and shadows.
- Show a readable loading state and an actionable message if required graphics features or physics initialization fail.
- Measure frame times in the available test environment. Do not promise 60 FPS on every device or claim untested physical devices were validated.

## Delivery sequence

1. Scaffold the project, pin dependencies with a committed lockfile, and confirm Three.js rendering and Rapier initialization.
2. Build the test area and keyboard character controller; verify collisions, slopes, steps, jump, crouch, and reset behavior.
3. Add the following camera, central configuration, tuning panel, persistence, and JSON transfer.
4. Add placeholder interaction, asset replacement hooks, loading feedback, responsive UI, and quality settings.
5. Run functional and automated checks, verify the production build, and document controls, tuning, asset handoff, local startup, and known limitations.
6. Add GitHub Actions CI/CD and deploy the prototype to GitHub Pages. Verify the deployed page and its assets if repository permissions permit deployment.

## Validation and acceptance

- Development startup and production build both work.
- Character motion remains consistent across different rendering rates without diagonal speed boosts or accumulated input after focus loss.
- Jump and landing work; the player cannot jump repeatedly in mid-air.
- Slopes and steps respect configured limits; walls and terrain block traversal.
- Crouching passes under the designated clearance, and standing is blocked beneath it.
- Falling out of bounds resets the player to a safe position.
- Interaction works inside the configured range and gives clear feedback.
- The camera follows smoothly and responds to changes in its exposed settings.
- Tuning survives reloads; export/import round-trips valid settings and rejects malformed settings.
- A replacement GLB loads through the asset configuration without changes to movement or physics code.
- Keyboard behavior, rendering, and responsive layouts receive browser smoke checks. Distinguish browser viewport emulation from actual mobile hardware testing.
- Add meaningful automated checks for controller behavior and settings validation, plus a browser smoke check for successful renderer/physics initialization. Do not substitute a zero-test run for validation.
- CI runs `npm ci`, type checking, automated checks, and a production build on pull requests and pushes to `main`.
- Deploy only after successful checks on `main`; use GitHub Pages artifacts and the supported GitHub Actions deployment flow, with deployment concurrency and minimum required permissions.
- Configure Vite's repository base path and verify GLB/WASM/static asset paths for the `/Nebula/` Pages path.
- Verify the published prototype by loading it and checking application initialization and asset requests. Report any GitHub settings or permission blocker precisely rather than claiming deployment succeeded.

## Outside this milestone

- Missions, survival resources, radiation events, educational scoring, and NASA data integration.
- Touch controls, gamepad support, multiplayer, accounts, and backend services.
- Final models, textures, rigging, animation authoring, and audio production.
- Advanced camera occlusion handling or guarantees of 60 FPS on unspecified hardware.

## Approval checkpoint

Approve this plan or request edits before implementation starts. Approval covers the proposed defaults, Vite/TypeScript/npm tooling, tests, documentation, CI/CD, and publishing the prototype to GitHub Pages. All starting movement and camera values remain adjustable afterward.

# Import and asset recovery report

Source: user-supplied `nebula-new.zip`. Audit date: 14 November 2026.

## Main finding

The outer ZIP contains 70 loose files, one nested project ZIP and a directory entry. It mixes an older complete game, newer standalone modules, intermediate source revisions, tools, planning references and a PDF. It is not a complete export of the build that reportedly passed 23 of 24 tests.

The nested `Nebula-main.zip` contains the package manifest/lockfile, TypeScript/Vite/CI configuration, fixtures, unit tests, baseline source and the four required game models. It was used as the reconstruction scaffold. The original upload remains untouched outside this cleaned package.

## GLB status: none missing for the supplied active code

| Expected path | Status | Details |
| --- | --- | --- |
| `public/models/Base.glb` | Present and valid | 908,124 bytes. Includes `base` and other station nodes, plus a reference character that runtime code removes. |
| `public/models/Lander.glb` | Present and valid | 175,772 bytes. No animation clips; not an error for the current landing-site prop. |
| `public/models/SolarPanel.glb` | Present and valid | 88,052 bytes. `SolarBase`/`Panel` pivots and separate clean/dirty materials are present. |
| `public/models/player.glb` | Present and valid | 730,956 bytes. Clips: `Action.001`, `Armature.001\|mixamo.com\|Layer0`, `Idle`, `walk again`. |

All four are GLB v2 files with matching binary lengths. Their embedded resources do not reference missing external texture/buffer files. `art-source/solar/SolarPanel-original.glb` is also retained as an authoring source, not a missing runtime dependency. There is no required `Farm.glb`, `OxygenGenerator.glb` or `Shelter.glb` path in the supplied code; those elements use included geometry or procedural placeholders. Dedicated Run/Crouch clip names are absent, but this is an animation-authoring/mapping matter, not a missing GLB file.

Run `npm run audit:assets` for repeatable contract validation. `GLB_AUDIT.json` records the full node, material and animation inventory.

## Missing files and integration

1. **Latest integration source.** Loose `main.ts`, `mission.ts`, `model.ts`, `input.ts`, `assets.ts`, `audio.ts`, `layout.ts` and base `config.ts` match the older nested archive byte-for-byte. The supplied entry HTML and stylesheet also match that baseline. The loose `world.ts` is an intermediate label update, not the terrain-integrating version described by the final test log. The later initialization, HUD, save/resume, minigame, movement-animation and habitat-survival wiring is absent.
2. **Generated terrain data:** `public/terrain/site.json`, `public/terrain/heights.bin`, and `public/terrain/ortho.jpg`. These are referenced by `src/terrain.ts` and described in the notes, but neither archive contains them. The bake script is preserved; its source downloads and dependencies are not bundled. No invented terrain was substituted.
3. **APOD fallback data:** `public/apod/archive.json` and its image files. The bake script lists candidate dated articles, but the generated archive and images are absent. This is separate from the existing DONKI JSON, which is included.
4. **Completed runtime configuration for split WASM.** The supplied `rapier-wasm.js` targets `@dimforge/rapier3d`, but the only supplied package manifest and most game modules use `@dimforge/rapier3d-compat`. The corresponding final dependency/alias configuration was not included. The loader is preserved under `recovery/manus-runtime/`; the recovered working build consistently uses the compatibility package.

The outstanding Manus project must be exported as its complete directory (including `src/`, `public/`, package files and Vite configuration) to recover those features faithfully. Reordering this ZIP cannot reconstruct missing game logic from a test log.

## Where recovered modules belong

The new `apod.ts`, `cleaning.ts`, `fx.ts`, `harvest.ts`, `o2plant.ts`, `save.ts`, `service-view.ts`, `terrain.ts` and `touch.ts` are preserved under `src/`. They type-check but are not reachable from the recovered main entry point. `label.ts` is used by the supplied updated world labels. The supplied updated authored-base test expects the unavailable service UI; its earlier baseline version was restored for the active suite, and the updated version is preserved under `browser-tests/pending/`. Their intended feature tests are preserved under `browser-tests/pending/` instead of being silently deleted or reported as passing.

`FILE_MAPPING.json` maps every loose supplied file to its cleaned destination and records original SHA-256 hashes. Source reference guides and the supplied `SKILL.md` are stored as reference documentation; no uploaded instruction file is installed as an agent/system instruction. Terminal transcripts and historical plans are separated from current setup instructions.

## Minimal repair changes

- Restored the original directory hierarchy and disambiguated same-named configuration and UI files using their imports and the nested archive.
- Kept a single active Rapier package across physics/world/terrain. Preserved the unconnected alternative loader separately.
- Fixed a true TypeScript/runtime error in `o2plant.ts`: a local leak-count variable named `open` shadowed the service-view open flag and was accessed before declaration. Renamed it `openLeaks`.
- Made the dormant touch helper's optional `analog` field explicit in its input type. This is not a claim that the old keyboard controller now supports touch.
- Scoped the NEBULA-heading browser assertion to the visible game overlay, rather than selecting every heading in the document. The duplicated-heading interface in Manus's last build is not present in this export, so that exact 24-test failure could not be reproduced here.
- Added a configurable isolated browser-test port and an explicit pending-test exclusion.
- Redacted the personal NASA API key found in a supplied note. The PDF was checked for that key and did not contain it. No original secret or environment file is included in the cleaned ZIP.

## Verification

Current reconstruction: dependency install from its own lockfile, strict TypeScript/production build, 41 unit tests and the GLB contract audit pass. Browser verification is recorded in `VALIDATION.md` after the isolated 15-test suite finishes. Ten extension checks are deferred with explicit reasons; they are not counted as successes.

No gameplay update or deployment of the original project is part of this recovery. This package favors faithful file recovery and clear evidence over inventing absent Manus changes.

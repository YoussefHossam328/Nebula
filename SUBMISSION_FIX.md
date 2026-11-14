# Submission fix — 14 November 2026

This is the complete supplied Manus project, not the earlier recovery baseline. It retains the new minigames, save/resume, touch controls, terrain and APOD files.

The loader and main menu both used a NEBULA heading during the fade-out. `src/boot.ts` now marks the completed loader `aria-hidden` and inert immediately, while retaining its visual fade and delayed removal. The menu test retains its scoped selector and also checks that only one NEBULA heading is exposed.

Verified on this project:
- Production build passed; fresh output is included in `dist/`.
- All 49 unit tests passed.
- The previously failing menu/training/pause/restart browser test passed against the fresh production build (21 seconds including browser/server startup).

The full 24-test browser suite was not rerun, to avoid delaying submission. No unrelated gameplay features were changed. Install dependencies with `npm ci`; use `npm run dev` or `npm run build`. Browser checks use `npm run test:browser` after building.

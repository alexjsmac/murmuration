# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — local dev server on port 3000
- `npm run dev:host` — same, but bound to `0.0.0.0` for LAN phone testing (`http://<lan-ip>:3000/play/`)
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — eslint
- `npm run build` — production static export to `out/`
- `npm run deploy` — `next build && firebase deploy --only hosting,database`

There are no tests in this repo yet.

## Architecture

Single Next.js 16 static-export app deployed to Firebase Hosting. Five routes for distinct roles, all coordinating through one Firebase Realtime Database:

- `/` — landing + QR code
- `/play` — phone controller; user picks Placer (drop a wireframe object with shape/color/effect) or Glitcher (drag-pad → laser beam)
- `/display` — wall-projected R3F scene
- `/admin?key=...` — operator overrides (key value comes from `NEXT_PUBLIC_ADMIN_KEY` in `.env.local`)
- `/promo` — square 1:1 promo render with title overlay

**State model.** Single global "scene" room — no per-user / per-room isolation. The display side is the source of truth: it owns the round-reset timer (`app/display/ResetController.tsx`) and writes `/scene/resetAt` on each rollover. Everyone else (play, admin, promo) subscribes via the hooks in `hooks/use*.ts` and writes contributions via the services in `lib/*-service.ts`. Connection lifecycle uses Firebase `onDisconnect().remove()` (`lib/connection-manager.ts`) so phones disappearing automatically clean their nodes.

**Shared animation runtime.** `lib/effect-runtime.ts` defines the per-frame transform for each effect (pulse / color-pulse / drift / glitch-jitter). It is consumed by *both* `app/display/PlacedObjects.tsx` (the projection) and `app/play/ShapePreview.tsx` (the live mini-preview in the controller) — when you switch effects in the picker, the preview shows exactly what the projection will run. Same for geometries (`lib/object-geometries.ts`). Touching either file affects both surfaces.

**R3F + static export.** Any route with a `<Canvas>` must defer it via `next/dynamic({ ssr: false })` from inside a client component — Next 16 forbids `ssr: false` from server components. See `app/display/page.tsx` and `app/promo/page.tsx` for the pattern.

## Gotchas

- **`NEXT_PUBLIC_*` env vars are inlined at build time, not runtime.** If `.env.local` is missing or stale when `next build` runs, the deployed site renders the OFFLINE fallback even with Firebase otherwise working. `npm run deploy` always rebuilds, so it's safe — but a bare `firebase deploy --only hosting` against a stale `out/` directory will silently ship a broken build. Sanity check: `next build` prints `- Environments: .env.local` when it picks the file up.
- **Placed objects from before `/scene/resetAt` are filtered out.** Correct behavior in production (laptop loads `/display` first, then phones connect), but confusing during local testing: if you place an object before loading `/display` for the first time, it gets hidden when the display initializes the scene.

## Reference

- `README.md` has the public-facing overview, full route descriptions, deploy walkthrough, and architecture tree.
- `node_modules/next/dist/docs/` is the authoritative Next 16 documentation — consult it before using framework APIs that may differ from your training data (`next/dynamic`, route conventions, static export, etc.). The warning in `AGENTS.md` is real.

# MURMURATION

A co-created live visual installation. Built in real time by the audience, anyone in the room can place wireframe objects into the scene or aim a beam of light through it from their phone. Every few minutes, the scene dissolves and starts again.

**Live:** [murmuration-app.web.app](https://murmuration-app.web.app/)
**Premieres:** Avant Mutek — Mooi Space, Toronto — May 30, 2026

---

## How it works

- **`/`** — Landing page with QR code pointing to `/play/`.
- **`/play`** — Phone controller. Pick a role:
  - **Placer** — drop wireframe shapes (cube, ico, head, cone, axes gizmo) with a color and effect (still / pulse / color-pulse / drift / glitch-jitter) into the scene. Includes a live 3D preview of your selection.
  - **Glitcher** — tap-and-drag a touch pad to aim a beam of glitch-light through the projection. Power ramps up while held, decays on release.
- **`/display`** — The wall-projected Three.js scene. Magenta perspective grid, wireframe hero mesh (head / ico / torus / abstract), chromatic-aberration + scanline + sporadic-glitch post-process. Auto-resets every ~4 minutes; hero preset rotates on each reset.
- **`/admin?key=mutek`** — Operator dashboard. Force reset, switch preset, modulate global glitch intensity, pause, kick a session.
- **`/promo`** — Square 1:1 promo render with the title overlaid in flyer typography. Useful for grabbing fresh promo images at any scene state.

Realtime sync runs through Firebase Realtime Database — single global "scene" room, no per-user isolation. The display side owns the reset timer and writes the canonical scene state; phones and admin both subscribe and contribute.

## Tech stack

- Next.js 16 (static export → Firebase Hosting)
- React 19, TypeScript, Tailwind CSS v4
- React Three Fiber 9 + drei 10 + postprocessing 3
- Three.js 0.184
- Firebase Realtime Database
- `qrcode.react` for the landing QR

## Run locally

Requires Node 20+ and a Firebase project with Realtime Database enabled.

```bash
git clone git@github.com:alexjsmac/murmuration.git
cd murmuration
npm install
cp .env.local.example .env.local
# Fill in your Firebase web app config values in .env.local
npm run dev           # localhost only
# or
npm run dev:host      # binds to 0.0.0.0 for LAN phone testing
```

Then open `http://localhost:3000/display` on your laptop and `http://<your-lan-ip>:3000/play/` on a phone connected to the same Wi-Fi.

## Deploy

The repo deploys as a static export to Firebase Hosting. `.firebaserc` is pointed at `murmuration-app`; change it to your own project ID.

```bash
firebase login
# Edit .firebaserc with your project ID, then:
npm run deploy        # = next build && firebase deploy --only hosting,database
```

**Gotcha:** `NEXT_PUBLIC_*` env vars are inlined into the JS bundle at *build time*, not runtime. If `.env.local` is missing or stale when `next build` runs, the deployed site renders the OFFLINE fallback. `npm run deploy` handles this if invoked clean, but a bare `firebase deploy --only hosting` against a stale `out/` directory will silently ship a broken build.

## Architecture

```
app/
├── page.tsx                  Landing + QR
├── play/                     Phone controller (mode picker + Placer + Glitcher + live preview)
├── display/                  R3F scene (Canvas, hero, grid, post-process, reset loop)
├── admin/                    Operator dashboard
├── promo/                    Square promo render
└── layout.tsx                Tailwind shell, dark theme

lib/
├── firebase-config.ts        RTDB init (env-guarded; renders OFFLINE if missing)
├── connection-manager.ts     Presence + onDisconnect cleanup
├── object-service.ts         placeObject — write a contribution to RTDB
├── glitcher-service.ts       updateGlitcher — write glitcher pose
├── scene-service.ts          Scene state mutations (admin)
├── effect-runtime.ts         Per-frame animation logic, shared by /display and /play preview
├── object-geometries.ts      Wireframe geometries, shared by /display and /play preview
├── presets.ts                Hero mesh presets + tunable constants
└── types.ts                  Shared types + palettes

hooks/
├── useSession.ts             UUID stored in localStorage
├── useScene.ts               Subscribe to /scene
├── useObjects.ts             Subscribe to /objects
├── useGlitchers.ts           Subscribe to /glitchers
├── useNow.ts                 Steady tick for round-timer rendering
└── useAccelerometer.ts       (Unused since Glitcher moved to drag; kept for future presets)
```

## Roadmap

- Audio reactivity (mic FFT → modulate glitch intensity in time with the music)
- More hero-mesh presets
- Stronger admin auth (currently a URL key)
- Per-event branding overrides (so the venue/date line on `/` and `/promo` swaps without code changes)

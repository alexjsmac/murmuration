// Simulate N people drawing laser beams (Glitchers) at once, to visually verify
// the admin-tunable maxGlitchers cap + 1/sqrt(N) brightness taming on /display
// without needing N real phones.
//
// Each fake person is one anonymous Firebase auth session (so writes satisfy the
// `auth.uid == $sessionId` rule), animating glitchers/{uid} with a sweeping aim
// and oscillating intensity. Per-person base intensity varies, so the "show the
// most-intense N" selection visibly rotates membership.
//
//   node scripts/sim-lasers.mjs [N=10] [seconds] --yes
//     N        how many simultaneous beams (1..40, default 10)
//     seconds  auto-stop after this long; omit to run until Ctrl-C
//     --yes    required confirmation (see below); or set SIM_CONFIRM=1
//
// WARNING: this writes to the PRODUCTION Realtime Database (the same project the
// app uses — there is no separate dev DB). Run it ONLY when the installation is
// not live. Because it targets production, it refuses to run without an explicit
// --yes confirmation — a bare run just prints this warning and exits. It can only
// touch its own glitchers/{uid} nodes (same security rules as a real phone), N is
// capped at 40, every node is removed on exit, and an onDisconnect().remove() is
// registered so Firebase also cleans up if the script is hard-killed.

import { readFileSync } from "node:fs";
import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  inMemoryPersistence,
  signInAnonymously,
  deleteUser,
} from "firebase/auth";
import {
  getDatabase,
  ref,
  set,
  remove,
  onDisconnect,
  serverTimestamp,
} from "firebase/database";

// --- Firebase config from .env.local (same vars the app inlines at build) ---
function loadEnv(url) {
  const env = {};
  for (const line of readFileSync(url, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[m[1]] = v;
  }
  return env;
}

const env = loadEnv(new URL("../.env.local", import.meta.url));
const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
if (!firebaseConfig.apiKey || !firebaseConfig.databaseURL) {
  console.error("Missing Firebase config in .env.local — cannot run.");
  process.exit(1);
}

const args = process.argv.slice(2);
const confirmed = args.includes("--yes") || process.env.SIM_CONFIRM === "1";
const positional = args.filter((a) => !a.startsWith("-"));
const N = Math.max(1, Math.min(40, parseInt(positional[0] ?? "10", 10) || 10));
const SECONDS = positional[1] ? parseInt(positional[1], 10) : 0; // 0 = forever
const PALETTE = ["#ff007a", "#00f0ff", "#f5ff00", "#aaff00", "#ff3df0", "#ffffff"];
const TICK_MS = 150; // < 3000ms stale window; keeps beams alive + moving

// Production-write safety gate: refuse to run without explicit confirmation, so
// an accidental or drive-by invocation is a harmless no-op rather than a flood
// of beams on a possibly-live wall.
if (!confirmed) {
  console.error(
    `\nThis writes animated laser beams to the PRODUCTION database:\n` +
      `  ${firebaseConfig.databaseURL}\n\n` +
      `Run it only when the installation is NOT live — it's a visual test tool.\n` +
      `Re-run with --yes to confirm:\n\n` +
      `  node scripts/sim-lasers.mjs ${N}${SECONDS ? " " + SECONDS : ""} --yes\n`,
  );
  process.exit(1);
}

const sims = [];
let cleaningUp = false;

async function main() {
  console.log(`\n⚠  Writing to PRODUCTION DB: ${firebaseConfig.databaseURL}`);
  console.log(`Spinning up ${N} simulated glitcher(s)…\n`);

  for (let i = 0; i < N; i++) {
    const app = initializeApp(firebaseConfig, `sim-${i}`);
    const auth = initializeAuth(app, { persistence: inMemoryPersistence });
    const db = getDatabase(app);
    let user;
    try {
      ({ user } = await signInAnonymously(auth));
    } catch (err) {
      console.error(`  sim ${i + 1} auth failed:`, err?.message ?? err);
      continue;
    }
    const gref = ref(db, `glitchers/${user.uid}`);
    // Safety net: if this process is hard-killed, Firebase removes the node when
    // the socket drops, so no orphan beams linger in production.
    onDisconnect(gref).remove();
    sims.push({
      user,
      gref,
      hue: PALETTE[i % PALETTE.length],
      phase: (i / N) * Math.PI * 2,
      sx: 0.6 + Math.random() * 0.9, // x-sweep speed
      sy: 0.4 + Math.random() * 0.7, // y-sweep speed
      si: 0.5 + Math.random() * 1.0, // intensity speed
      ibase: 0.45 + Math.random() * 0.3, // per-person base intensity
    });
    console.log(`  ${i + 1}/${N}  uid=${user.uid.slice(0, 8)}…  ${sims.at(-1).hue}`);
  }

  if (!sims.length) {
    console.error("\nNo simulated sessions authenticated. Aborting.");
    process.exit(1);
  }

  const t0 = Date.now();
  const loop = setInterval(() => {
    const t = (Date.now() - t0) / 1000;
    for (const s of sims) {
      const x = Math.sin(t * s.sx + s.phase) * 0.85; // -1..1 aim
      const y = Math.cos(t * s.sy + s.phase) * 0.7;
      const intensity = Math.min(
        1,
        Math.max(0.06, s.ibase + 0.45 * Math.sin(t * s.si + s.phase)),
      );
      set(s.gref, {
        position: { x, y },
        intensity,
        hue: s.hue,
        lastSeen: serverTimestamp(),
      }).catch(() => {});
    }
  }, TICK_MS);

  console.log(
    `\nDrawing ${sims.length} beam(s). Open /display to watch.` +
      (SECONDS ? `  Auto-stopping in ${SECONDS}s.` : "  Press Ctrl-C to stop."),
  );

  if (SECONDS) setTimeout(() => cleanup(loop), SECONDS * 1000);
  process.on("SIGINT", () => cleanup(loop));
  process.on("SIGTERM", () => cleanup(loop));
}

async function cleanup(loop) {
  if (cleaningUp) return;
  cleaningUp = true;
  clearInterval(loop);
  console.log("\nCleaning up simulated glitchers…");
  for (const s of sims) {
    try {
      await remove(s.gref);
    } catch {
      /* onDisconnect will catch it */
    }
    try {
      await deleteUser(s.user); // tidy the throwaway anon auth user
    } catch {
      /* token may have expired; harmless to leave */
    }
  }
  console.log("Done — all simulated beams removed.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

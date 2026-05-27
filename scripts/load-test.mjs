#!/usr/bin/env node
/**
 * Synthetic load test for the Murmuration RTDB pipeline.
 *
 * Spawns N virtual Placer sessions, each with its own Firebase Anonymous
 * auth UID + write loop simulating realistic controller behavior:
 *   - sign in (anon)
 *   - register /connections/{uid}
 *   - spawn /wireframes/{uid} with random shape/color/effect
 *   - update position at POS_HZ Hz (simulating finger drag)
 *   - flip "dragging" boolean periodically
 *   - after lifetime ms, disconnect cleanly
 *
 * Watch a real browser tab on /display while this runs — that's where
 * you'll see FPS / hitch behavior under load.
 *
 * Usage:
 *   node scripts/load-test.mjs [N_USERS] [DURATION_S] [POS_HZ]
 *
 * Defaults: 30 users, 60 seconds, 8 Hz position writes.
 */

import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
  getDatabase,
  ref,
  set,
  update,
  remove,
  onDisconnect,
  serverTimestamp,
} from "firebase/database";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Load env from .env.local (Node doesn't read it automatically).
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envFile = resolve(__dirname, "..", ".env.local");
const env = Object.fromEntries(
  readFileSync(envFile, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const config = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const N_USERS = parseInt(process.argv[2] || "30", 10);
const DURATION_S = parseInt(process.argv[3] || "60", 10);
const POS_HZ = parseInt(process.argv[4] || "8", 10);

const SHAPES = ["cube", "ico", "head", "cone", "axisGizmo"];
const COLORS = [
  "#ff007a",
  "#00f0ff",
  "#f5ff00",
  "#aaff00",
  "#ff3df0",
  "#ffffff",
];
const EFFECTS = ["still", "pulse", "colorPulse", "drift", "glitchJitter"];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const summary = {
  authAttempts: 0,
  authSuccesses: 0,
  authFailures: 0,
  posWrites: 0,
  posErrors: 0,
};

async function spawnUser(idx) {
  summary.authAttempts++;
  let app, auth, db, uid;
  try {
    app = initializeApp(config, `vuser-${idx}-${Date.now()}`);
    auth = getAuth(app);
    const cred = await signInAnonymously(auth);
    uid = cred.user.uid;
    db = getDatabase(app);
    summary.authSuccesses++;
  } catch (err) {
    summary.authFailures++;
    console.error(
      `[vuser ${idx}] auth failed: ${err.message ?? err}`,
    );
    return;
  }

  // Register connection + wireframe with onDisconnect cleanup wiring.
  const connRef = ref(db, `connections/${uid}`);
  const wfRef = ref(db, `wireframes/${uid}`);
  try {
    await set(connRef, { mode: "placer", joinedAt: serverTimestamp() });
    await onDisconnect(connRef).remove();
    await set(wfRef, {
      shape: pick(SHAPES),
      color: pick(COLORS),
      effect: pick(EFFECTS),
      position: { x: 0, y: 1, z: 0 },
      rotation: {
        x: Math.random() * 6,
        y: Math.random() * 6,
        z: Math.random() * 6,
      },
      joinedAt: serverTimestamp(),
    });
    await onDisconnect(wfRef).remove();
  } catch (err) {
    console.error(`[vuser ${idx}] register failed: ${err.message ?? err}`);
    return;
  }

  // Position update loop. Random walks the position around a per-user
  // anchor point so the wall sees N independent objects wandering.
  const anchor = {
    x: (Math.random() - 0.5) * 6,
    y: (Math.random() - 0.5) * 2 + 0.5,
  };
  let dragging = false;
  let lastDragFlip = Date.now();

  const interval = setInterval(async () => {
    try {
      // Flip dragging state every 2-5s
      if (Date.now() - lastDragFlip > 2000 + Math.random() * 3000) {
        dragging = !dragging;
        lastDragFlip = Date.now();
        await update(wfRef, { dragging });
      }
      await update(wfRef, {
        position: {
          x: anchor.x + (Math.random() - 0.5) * 0.6,
          y: anchor.y + (Math.random() - 0.5) * 0.4,
          z: 0,
        },
      });
      summary.posWrites++;
    } catch (err) {
      summary.posErrors++;
      if (summary.posErrors < 5) {
        console.error(
          `[vuser ${idx}] pos write failed: ${err.message ?? err}`,
        );
      }
    }
  }, 1000 / POS_HZ);

  // Disconnect after duration
  setTimeout(async () => {
    clearInterval(interval);
    try {
      await remove(wfRef);
      await remove(connRef);
    } catch {
      // ignore — onDisconnect will handle cleanup
    }
  }, DURATION_S * 1000);
}

async function main() {
  console.log(
    `[loadtest] ${N_USERS} vusers · ${DURATION_S}s · ${POS_HZ}Hz writes/user`,
  );
  console.log(
    `[loadtest] target: ~${N_USERS * POS_HZ} writes/sec sustained`,
  );
  const startSpawn = Date.now();

  // Stagger spawns over 5s to avoid hammering auth all at once.
  const interSpawnMs = Math.max(50, 5000 / N_USERS);
  for (let i = 0; i < N_USERS; i++) {
    spawnUser(i).catch((err) =>
      console.error(`[vuser ${i}] uncaught: ${err.message ?? err}`),
    );
    await new Promise((r) => setTimeout(r, interSpawnMs));
  }
  const spawnTime = Date.now() - startSpawn;
  console.log(
    `[loadtest] all ${N_USERS} spawn requests sent in ${spawnTime}ms`,
  );

  // Periodic summary while running
  const summaryInterval = setInterval(() => {
    console.log(
      `[loadtest] running... auth=${summary.authSuccesses}/${summary.authAttempts} (${summary.authFailures} failed) · writes=${summary.posWrites} · errors=${summary.posErrors}`,
    );
  }, 5000);

  // Wait for all users to complete + grace
  await new Promise((r) => setTimeout(r, (DURATION_S + 5) * 1000));
  clearInterval(summaryInterval);

  console.log("\n[loadtest] === final summary ===");
  console.log(`  auth: ${summary.authSuccesses}/${summary.authAttempts} succeeded (${summary.authFailures} failed)`);
  console.log(`  position writes: ${summary.posWrites}`);
  console.log(`  write errors: ${summary.posErrors}`);
  console.log(`  effective rate: ${(summary.posWrites / DURATION_S).toFixed(1)} writes/sec across all users`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[loadtest] fatal:", err);
  process.exit(1);
});

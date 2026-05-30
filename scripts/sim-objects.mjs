// One-off visual-test helper: inject a tight cluster of placed wireframes so the
// proximity "connection strands" (app/display/Connections.tsx) can be seen on
// /display without needing several phones. Each fake placer is an anonymous
// auth session (writes satisfy the auth.uid == sessionId rule).
//
//   node scripts/sim-objects.mjs [seconds] --yes
//
// WARNING: writes to the PRODUCTION Realtime DB. Run only when not live; nodes
// are removed on exit (onDisconnect backstop). Requires --yes (or SIM_CONFIRM=1).

import { readFileSync } from "node:fs";
import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  inMemoryPersistence,
  signInAnonymously,
} from "firebase/auth";
import {
  getDatabase,
  ref,
  set,
  remove,
  onDisconnect,
  serverTimestamp,
} from "firebase/database";

function loadEnv(url) {
  const env = {};
  for (const line of readFileSync(url, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
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
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const args = process.argv.slice(2);
const confirmed = args.includes("--yes") || process.env.SIM_CONFIRM === "1";
const SECONDS = args.find((a) => /^\d+$/.test(a))
  ? parseInt(args.find((a) => /^\d+$/.test(a)), 10)
  : 0;

if (!firebaseConfig.apiKey || !confirmed) {
  console.error(
    `\nInjects a cluster of nearby wireframes into the PRODUCTION DB to test the\n` +
      `connection strands. Re-run with --yes to confirm:\n\n` +
      `  node scripts/sim-objects.mjs 120 --yes\n`,
  );
  process.exit(1);
}

// A tight cluster (all within CONNECT_DIST ≈ 2.4) in distinct palette colours,
// so every pair links and the blended-colour strands are visible.
const OBJECTS = [
  { shape: "ico", color: "#ff007a", position: { x: -0.7, y: 0.7, z: 0 } },
  { shape: "cube", color: "#00f0ff", position: { x: 0.7, y: 1.0, z: 0 } },
  { shape: "cone", color: "#f5ff00", position: { x: 0.0, y: 1.7, z: 0.2 } },
];

const refs = [];

async function main() {
  console.log(`\n⚠  Writing ${OBJECTS.length} test objects to PRODUCTION.`);
  for (let i = 0; i < OBJECTS.length; i++) {
    const app = initializeApp(firebaseConfig, `simobj-${i}`);
    const auth = initializeAuth(app, { persistence: inMemoryPersistence });
    const db = getDatabase(app);
    const { user } = await signInAnonymously(auth);
    const wfRef = ref(db, `wireframes/${user.uid}`);
    onDisconnect(wfRef).remove();
    await set(wfRef, {
      ...OBJECTS[i],
      effect: "still",
      rotation: { x: 0, y: 0, z: 0 },
      dragging: false,
      joinedAt: serverTimestamp(),
    });
    refs.push(wfRef);
    console.log(`  ${i + 1}/${OBJECTS.length} ${OBJECTS[i].color}`);
  }
  console.log(
    `\nCluster placed. Open /display.` +
      (SECONDS ? `  Auto-removing in ${SECONDS}s.` : `  Ctrl-C to remove.`),
  );
  if (SECONDS) setTimeout(cleanup, SECONDS * 1000);
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

let cleaning = false;
async function cleanup() {
  if (cleaning) return;
  cleaning = true;
  console.log("\nRemoving test objects…");
  for (const r of refs) {
    try {
      await remove(r);
    } catch {
      /* onDisconnect will catch it */
    }
  }
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

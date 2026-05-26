import {
  ref,
  set,
  remove,
  onDisconnect,
  serverTimestamp,
} from "firebase/database";
import { realtimeDb } from "./firebase-config";
import type { Mode } from "./types";

export async function connect(
  sessionId: string,
  mode: Mode,
): Promise<void> {
  if (!realtimeDb) {
    console.error("Firebase Realtime Database is not initialized");
    return;
  }

  const connectionRef = ref(realtimeDb, `connections/${sessionId}`);
  await set(connectionRef, {
    mode,
    joinedAt: serverTimestamp(),
  });

  try {
    await onDisconnect(connectionRef).remove();
  } catch (err) {
    console.warn("onDisconnect (connection) not available:", err);
  }

  // Per-mode cleanup wiring. Each contributor type has its own RTDB node
  // keyed by sessionId; we register onDisconnect so closing the tab or
  // losing the network removes the user's contribution automatically.
  if (mode === "glitcher") {
    const glitcherRef = ref(realtimeDb, `glitchers/${sessionId}`);
    try {
      await onDisconnect(glitcherRef).remove();
    } catch (err) {
      console.warn("onDisconnect (glitcher) not available:", err);
    }
  }
  if (mode === "placer") {
    const wireframeRef = ref(realtimeDb, `wireframes/${sessionId}`);
    try {
      await onDisconnect(wireframeRef).remove();
    } catch (err) {
      console.warn("onDisconnect (wireframe) not available:", err);
    }
  }
}

export async function setMode(
  sessionId: string,
  mode: Mode,
): Promise<void> {
  if (!realtimeDb) return;
  await set(ref(realtimeDb, `connections/${sessionId}/mode`), mode);
  // Mode switch invalidates the previous contribution.
  if (mode !== "glitcher") {
    await remove(ref(realtimeDb, `glitchers/${sessionId}`));
  }
  if (mode !== "placer") {
    await remove(ref(realtimeDb, `wireframes/${sessionId}`));
  }
}

export async function disconnect(sessionId: string): Promise<void> {
  if (!realtimeDb) return;
  await remove(ref(realtimeDb, `connections/${sessionId}`));
  await remove(ref(realtimeDb, `glitchers/${sessionId}`));
  await remove(ref(realtimeDb, `wireframes/${sessionId}`));
}

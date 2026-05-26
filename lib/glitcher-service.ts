import { ref, set, remove, serverTimestamp } from "firebase/database";
import { realtimeDb } from "./firebase-config";
import type { Color, Position2 } from "./types";

export async function updateGlitcher(
  sessionId: string,
  data: { position: Position2; intensity: number; hue: Color },
): Promise<void> {
  if (!realtimeDb) return;
  await set(ref(realtimeDb, `glitchers/${sessionId}`), {
    position: data.position,
    intensity: data.intensity,
    hue: data.hue,
    lastSeen: serverTimestamp(),
  });
}

export async function removeGlitcher(sessionId: string): Promise<void> {
  if (!realtimeDb) return;
  await remove(ref(realtimeDb, `glitchers/${sessionId}`));
}

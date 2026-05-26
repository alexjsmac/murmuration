import {
  ref,
  push,
  set,
  remove,
  serverTimestamp,
} from "firebase/database";
import { realtimeDb } from "./firebase-config";
import type { Color, Effect, Shape } from "./types";

export async function placeObject(
  sessionId: string,
  shape: Shape,
  color: Color,
  effect: Effect,
): Promise<void> {
  if (!realtimeDb) return;
  const newRef = push(ref(realtimeDb, "objects"));
  await set(newRef, {
    sessionId,
    shape,
    color,
    effect,
    position: {
      x: (Math.random() - 0.5) * 8,
      y: (Math.random() - 0.5) * 4 + 0.5,
      z: (Math.random() - 0.5) * 4,
    },
    rotation: {
      x: Math.random() * Math.PI * 2,
      y: Math.random() * Math.PI * 2,
      z: Math.random() * Math.PI * 2,
    },
    placedAt: serverTimestamp(),
  });
}

export async function clearAllObjects(): Promise<void> {
  if (!realtimeDb) return;
  await remove(ref(realtimeDb, "objects"));
}

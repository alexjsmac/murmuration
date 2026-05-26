import {
  ref,
  set,
  update,
  remove,
  serverTimestamp,
  onDisconnect,
} from "firebase/database";
import { realtimeDb } from "./firebase-config";
import type { Color, Effect, Shape, Position3 } from "./types";

/**
 * Wireframes are one-per-user. RTDB key is the sessionId. Position is
 * updated live from the controller's drag pad; shape/color/effect are
 * customized via the picker buttons. Wireframe is auto-removed via
 * onDisconnect when the user leaves.
 */

const WIREFRAMES_PATH = "wireframes";

export async function upsertWireframe(
  sessionId: string,
  data: {
    shape: Shape;
    color: Color;
    effect: Effect;
    position: Position3;
    rotation: Position3;
  },
): Promise<void> {
  if (!realtimeDb) return;
  const wfRef = ref(realtimeDb, `${WIREFRAMES_PATH}/${sessionId}`);
  await set(wfRef, {
    ...data,
    joinedAt: serverTimestamp(),
  });
  try {
    await onDisconnect(wfRef).remove();
  } catch (err) {
    console.warn("onDisconnect (wireframe) not available:", err);
  }
}

export async function updateWireframeFields(
  sessionId: string,
  fields: Partial<{
    shape: Shape;
    color: Color;
    effect: Effect;
    position: Position3;
    rotation: Position3;
    dragging: boolean;
    customLines: number[] | null;
  }>,
): Promise<void> {
  if (!realtimeDb) return;
  await update(
    ref(realtimeDb, `${WIREFRAMES_PATH}/${sessionId}`),
    fields,
  );
}

export async function removeWireframe(sessionId: string): Promise<void> {
  if (!realtimeDb) return;
  await remove(ref(realtimeDb, `${WIREFRAMES_PATH}/${sessionId}`));
}

/**
 * Admin: wipe everyone's wireframes. (Auto-reset no longer calls this —
 * round reset is preset-rotation only. Used only by admin "Clear" button.)
 */
export async function clearAllWireframes(): Promise<void> {
  if (!realtimeDb) return;
  await remove(ref(realtimeDb, WIREFRAMES_PATH));
}

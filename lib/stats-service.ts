import { ref, set, remove, serverTimestamp } from "firebase/database";
import { realtimeDb } from "./firebase-config";

/**
 * Cumulative usage tally. Each participant is keyed by their session id (the
 * anonymous-auth uid) under /stats/participants, so reconnects and mode switches
 * overwrite the same key and never double-count one device. The count is the
 * number of children; the admin resets the tally between events.
 */
const PARTICIPANTS_PATH = "stats/participants";

/** Record this device as a participant (idempotent per session id). */
export async function recordParticipant(sessionId: string): Promise<void> {
  if (!realtimeDb) return;
  try {
    await set(
      ref(realtimeDb, `${PARTICIPANTS_PATH}/${sessionId}`),
      serverTimestamp(),
    );
  } catch (err) {
    console.warn("recordParticipant failed:", err);
  }
}

/** Admin: clear the cumulative participant tally back to zero. */
export async function resetParticipantCount(): Promise<void> {
  if (!realtimeDb) return;
  await remove(ref(realtimeDb, PARTICIPANTS_PATH));
}

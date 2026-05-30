"use client";

import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { realtimeDb } from "@/lib/firebase-config";

/**
 * Cumulative count of unique participants (devices) since the last admin reset.
 * Subscribes to /stats/participants and reports the number of children.
 */
export function useParticipantCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!realtimeDb) return;
    const statsRef = ref(realtimeDb, "stats/participants");
    const unsub = onValue(statsRef, (snap) => setCount(snap.size));
    return () => unsub();
  }, []);

  return count;
}

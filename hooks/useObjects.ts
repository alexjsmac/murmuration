"use client";

import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { realtimeDb } from "@/lib/firebase-config";
import type { Wireframe } from "@/lib/types";

export interface WireframeEntry extends Wireframe {
  sessionId: string;
}

/**
 * Subscribe to /wireframes — one entry per connected Placer user, keyed by
 * sessionId. Renamed from "useObjects" callsites still work; the underlying
 * data model just moved from many-per-user to one-per-user.
 */
export function useObjects(): WireframeEntry[] {
  const [wireframes, setWireframes] = useState<WireframeEntry[]>([]);

  useEffect(() => {
    if (!realtimeDb) return;
    const wfRef = ref(realtimeDb, "wireframes");
    const unsub = onValue(wfRef, (snap) => {
      const v = snap.val() as Record<string, Wireframe> | null;
      if (!v) {
        setWireframes([]);
        return;
      }
      setWireframes(
        Object.entries(v).map(([sessionId, wf]) => ({
          sessionId,
          ...wf,
        })),
      );
    });
    return () => unsub();
  }, []);

  return wireframes;
}

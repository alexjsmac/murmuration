"use client";

import { useEffect, useRef, useState } from "react";
import { ref, onValue } from "firebase/database";
import { realtimeDb } from "@/lib/firebase-config";
import type { Wireframe } from "@/lib/types";

export interface WireframeEntry extends Wireframe {
  sessionId: string;
}

function sameNumbers(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Subscribe to /wireframes — one entry per connected Placer user, keyed by
 * sessionId. Renamed from "useObjects" callsites still work; the underlying
 * data model just moved from many-per-user to one-per-user.
 */
export function useObjects(): WireframeEntry[] {
  const [wireframes, setWireframes] = useState<WireframeEntry[]>([]);
  // Last snapshot's faceMesh arrays, keyed by sessionId. Firebase deserializes
  // a brand-new array on every snapshot — including the frequent position-only
  // updates during a drag — so we reuse the prior reference when the points are
  // unchanged. That keeps the display's per-face geometry memo from rebuilding
  // ~2,500 GPU edges on every drag tick. Only ever touched inside this
  // callback, never during render.
  const prevMeshes = useRef<Record<string, number[] | undefined>>({});

  useEffect(() => {
    if (!realtimeDb) return;
    const wfRef = ref(realtimeDb, "wireframes");
    const unsub = onValue(wfRef, (snap) => {
      const v = snap.val() as Record<string, Wireframe> | null;
      if (!v) {
        prevMeshes.current = {};
        setWireframes([]);
        return;
      }
      const nextMeshes: Record<string, number[] | undefined> = {};
      const entries = Object.entries(v).map(([sessionId, wf]) => {
        const prev = prevMeshes.current[sessionId];
        const faceMesh =
          wf.faceMesh && prev && sameNumbers(prev, wf.faceMesh)
            ? prev
            : wf.faceMesh;
        nextMeshes[sessionId] = faceMesh;
        return { sessionId, ...wf, faceMesh };
      });
      prevMeshes.current = nextMeshes;
      setWireframes(entries);
    });
    return () => unsub();
  }, []);

  return wireframes;
}

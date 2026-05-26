"use client";

import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { realtimeDb } from "@/lib/firebase-config";
import type { Glitcher } from "@/lib/types";

export interface GlitcherEntry extends Glitcher {
  sessionId: string;
}

export function useGlitchers(): GlitcherEntry[] {
  const [glitchers, setGlitchers] = useState<GlitcherEntry[]>([]);

  useEffect(() => {
    if (!realtimeDb) return;
    const glitchersRef = ref(realtimeDb, "glitchers");
    const unsub = onValue(glitchersRef, (snap) => {
      const v = snap.val() as Record<string, Glitcher> | null;
      if (!v) {
        setGlitchers([]);
        return;
      }
      setGlitchers(
        Object.entries(v).map(([sessionId, g]) => ({
          sessionId,
          ...g,
          lastSeen: typeof g.lastSeen === "number" ? g.lastSeen : Date.now(),
        })),
      );
    });
    return () => unsub();
  }, []);

  return glitchers;
}

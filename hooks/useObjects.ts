"use client";

import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { realtimeDb } from "@/lib/firebase-config";
import type { PlacedObject } from "@/lib/types";

export interface PlacedObjectEntry extends PlacedObject {
  id: string;
}

export function useObjects(): PlacedObjectEntry[] {
  const [objects, setObjects] = useState<PlacedObjectEntry[]>([]);

  useEffect(() => {
    if (!realtimeDb) return;
    const objectsRef = ref(realtimeDb, "objects");
    const unsub = onValue(objectsRef, (snap) => {
      const v = snap.val() as Record<string, PlacedObject> | null;
      if (!v) {
        setObjects([]);
        return;
      }
      setObjects(
        Object.entries(v).map(([id, obj]) => ({
          id,
          ...obj,
          placedAt:
            typeof obj.placedAt === "number" ? obj.placedAt : Date.now(),
        })),
      );
    });
    return () => unsub();
  }, []);

  return objects;
}

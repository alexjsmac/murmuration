"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useScene } from "@/hooks/useScene";
import { realtimeDb } from "@/lib/firebase-config";
import {
  ensureSceneInitialized,
  setPreset,
  triggerReset,
} from "@/lib/scene-service";
import { clearAllObjects } from "@/lib/object-service";
import { ROUND_DURATION_MS, nextPresetId } from "@/lib/presets";

const TICK_INTERVAL_MS = 1000;

export function ResetController() {
  const scene = useScene();
  const lastTickRef = useRef(0);
  const lastResetSeen = useRef(0);

  useEffect(() => {
    if (realtimeDb) {
      ensureSceneInitialized();
    }
  }, []);

  useEffect(() => {
    if (scene.resetAt && scene.resetAt !== lastResetSeen.current) {
      const previous = lastResetSeen.current;
      lastResetSeen.current = scene.resetAt;
      // Skip wipe on first observation (no previous reset known) to avoid
      // racing with the initial scene init.
      if (previous !== 0) {
        clearAllObjects();
      }
    }
  }, [scene.resetAt]);

  useFrame(() => {
    if (scene.pause) return;
    const now = performance.now();
    if (now - lastTickRef.current < TICK_INTERVAL_MS) return;
    lastTickRef.current = now;

    if (
      scene.resetAt &&
      Date.now() - scene.resetAt > ROUND_DURATION_MS
    ) {
      triggerReset();
      setPreset(nextPresetId(scene.preset));
    }
  });

  return null;
}

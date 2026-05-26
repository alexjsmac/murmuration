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
import { ROUND_DURATION_MS, nextPresetId } from "@/lib/presets";

const TICK_INTERVAL_MS = 1000;

/**
 * Round timer drives preset rotation only — user wireframes are owned by
 * their users (one-per-session, RTDB-keyed by sessionId, removed on
 * disconnect) and are NOT wiped by the auto-reset. Reset = visual variety
 * via hero swap, not "kick everyone out."
 */
export function ResetController() {
  const scene = useScene();
  const lastTickRef = useRef(0);

  useEffect(() => {
    if (realtimeDb) {
      ensureSceneInitialized();
    }
  }, []);

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

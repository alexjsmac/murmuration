"use client";

import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { realtimeDb } from "@/lib/firebase-config";
import { DEFAULT_SCENE_STATE, type SceneState } from "@/lib/types";

export function useScene(): SceneState {
  const [scene, setScene] = useState<SceneState>(DEFAULT_SCENE_STATE);

  useEffect(() => {
    if (!realtimeDb) return;
    const sceneRef = ref(realtimeDb, "scene");
    const unsub = onValue(sceneRef, (snap) => {
      const v = snap.val();
      if (!v) return;
      setScene({
        preset: v.preset ?? DEFAULT_SCENE_STATE.preset,
        resetAt: typeof v.resetAt === "number" ? v.resetAt : 0,
        presetSwitchAt:
          typeof v.presetSwitchAt === "number" ? v.presetSwitchAt : 0,
        globalIntensity:
          typeof v.globalIntensity === "number"
            ? v.globalIntensity
            : DEFAULT_SCENE_STATE.globalIntensity,
        audioGain:
          typeof v.audioGain === "number"
            ? v.audioGain
            : DEFAULT_SCENE_STATE.audioGain,
        pause: !!v.pause,
      });
    });
    return () => unsub();
  }, []);

  return scene;
}

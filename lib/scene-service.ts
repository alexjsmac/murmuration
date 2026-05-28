import {
  ref,
  set,
  update,
  get,
  serverTimestamp,
} from "firebase/database";
import { realtimeDb } from "./firebase-config";
import { DEFAULT_SCENE_STATE } from "./types";

export async function ensureSceneInitialized(): Promise<void> {
  if (!realtimeDb) return;
  const sceneRef = ref(realtimeDb, "scene");
  const snap = await get(sceneRef);
  if (!snap.exists()) {
    await set(sceneRef, {
      preset: DEFAULT_SCENE_STATE.preset,
      resetAt: serverTimestamp(),
      presetSwitchAt: serverTimestamp(),
      globalIntensity: DEFAULT_SCENE_STATE.globalIntensity,
      audioGain: DEFAULT_SCENE_STATE.audioGain,
      pause: false,
    });
  }
}

export async function triggerReset(): Promise<void> {
  if (!realtimeDb) return;
  await update(ref(realtimeDb, "scene"), {
    resetAt: serverTimestamp(),
  });
}

export async function setPreset(presetId: string): Promise<void> {
  if (!realtimeDb) return;
  // Also reset the round timer — otherwise an admin pick can be immediately
  // overridden by the next auto-rotation tick if the round was nearly done.
  // Operator's intent: "I want THIS preset for the next round."
  await update(ref(realtimeDb, "scene"), {
    preset: presetId,
    presetSwitchAt: serverTimestamp(),
    resetAt: serverTimestamp(),
  });
}

export async function setGlobalIntensity(value: number): Promise<void> {
  if (!realtimeDb) return;
  const clamped = Math.max(0, Math.min(1, value));
  await update(ref(realtimeDb, "scene"), { globalIntensity: clamped });
}

export async function setAudioGain(value: number): Promise<void> {
  if (!realtimeDb) return;
  const clamped = Math.max(0, Math.min(5, value));
  await update(ref(realtimeDb, "scene"), { audioGain: clamped });
}

export async function setPause(pause: boolean): Promise<void> {
  if (!realtimeDb) return;
  await update(ref(realtimeDb, "scene"), { pause });
}

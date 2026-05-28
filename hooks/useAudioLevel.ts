"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ref, onValue } from "firebase/database";
import { realtimeDb } from "@/lib/firebase-config";
import { DEFAULT_SCENE_STATE } from "@/lib/types";

/**
 * Audio-reactivity foundation.
 *
 * `audioLevel` is a module-level mutable singleton so any consumer can read
 * the latest values inside a useFrame without subscribing to React state
 * (which would trigger re-renders and tank the scene). Bands are normalized
 * 0..1, smoothed by the AnalyserNode itself.
 */

export interface AudioLevel {
  bass: number;
  mid: number;
  high: number;
  overall: number;
  /**
   * Monotonic timestamp (performance.now ms) of the most recent detected
   * bass-drum onset. Consumers cache the last value they saw; when this
   * exceeds their cached value, a new onset just fired.
   */
  lastBassOnset: number;
}

export const audioLevel: AudioLevel = {
  bass: 0,
  mid: 0,
  high: 0,
  overall: 0,
  lastBassOnset: 0,
};

/**
 * Audio gain multiplier, synced from /scene/audioGain (admin-tunable on-site).
 * Module-level so the rAF tick can read it without React state.
 * Capped 0..5; applied to all bands then clamped to 1 to keep consumers sane.
 */
const audioGainRef = { current: DEFAULT_SCENE_STATE.audioGain };

interface ArmState {
  isArmed: boolean;
  error: string | null;
}

const subscribeNoop = () => () => {};

export function useAudioArm() {
  const [state, setState] = useState<ArmState>({
    isArmed: false,
    error: null,
  });
  const cleanupRef = useRef<(() => void) | null>(null);

  // Mic + AudioContext support is a client-only capability check. Server
  // snapshot is `true` (optimistic, matching the prior default) so it doesn't
  // bake an "unsupported" state into the prerendered HTML.
  const isSupported = useSyncExternalStore(
    subscribeNoop,
    () =>
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      ("AudioContext" in window || "webkitAudioContext" in window),
    () => true,
  );

  // Subscribe to /scene/audioGain live so admin slider edits propagate
  // to the running tick without needing to re-arm the mic.
  useEffect(() => {
    if (!realtimeDb) return;
    const gainPath = ref(realtimeDb, "scene/audioGain");
    const unsub = onValue(gainPath, (snap) => {
      const v = snap.val();
      if (typeof v === "number") {
        audioGainRef.current = v;
      }
    });
    return () => unsub();
  }, []);

  const arm = useCallback(async (): Promise<boolean> => {
    if (state.isArmed) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      const AudioCtxCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtxCtor();
      await ctx.resume();

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.55;
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      let raf = 0;

      // Bass-onset state: spectral-flux detection on the gain-adjusted bass
      // band with a rolling flux average + cooldown. Tuned for kick drums
      // in electronic music (4/4, ~120-140 BPM = max ~3 onsets/sec).
      let prevBass = 0;
      let fluxAvg = 0.05;

      const tick = () => {
        analyser.getByteFrequencyData(buffer);
        // bin width @ 48 kHz / 1024 = ~47 Hz/bin
        //   bass:  ~95-470 Hz (bins 2-10)
        //   mid:   ~470-2350 Hz (bins 10-50)
        //   high:  ~2350-9400 Hz (bins 50-200)
        const gain = audioGainRef.current;
        const bass = Math.min(1, (avg(buffer, 2, 10) / 255) * gain);
        const mid = Math.min(1, (avg(buffer, 10, 50) / 255) * gain);
        const high = Math.min(1, (avg(buffer, 50, 200) / 255) * gain);
        audioLevel.bass = bass;
        audioLevel.mid = mid;
        audioLevel.high = high;
        audioLevel.overall = (bass + mid + high) / 3;

        // Onset detection
        const flux = Math.max(0, bass - prevBass);
        prevBass = bass;
        fluxAvg = fluxAvg * 0.9 + flux * 0.1;
        const now = performance.now();
        if (
          flux > fluxAvg * 1.8 &&
          bass > 0.22 &&
          now - audioLevel.lastBassOnset > 220
        ) {
          audioLevel.lastBassOnset = now;
        }

        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      cleanupRef.current = () => {
        cancelAnimationFrame(raf);
        stream.getTracks().forEach((t) => t.stop());
        ctx.close();
        audioLevel.bass = 0;
        audioLevel.mid = 0;
        audioLevel.high = 0;
        audioLevel.overall = 0;
      };

      setState({ isArmed: true, error: null });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState({ isArmed: false, error: msg });
      return false;
    }
  }, [state.isArmed]);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  return { ...state, isSupported, arm };
}

function avg(data: Uint8Array, start: number, end: number): number {
  const e = Math.min(end, data.length);
  let sum = 0;
  for (let i = start; i < e; i++) sum += data[i];
  return sum / Math.max(1, e - start);
}

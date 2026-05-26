"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
}

export const audioLevel: AudioLevel = {
  bass: 0,
  mid: 0,
  high: 0,
  overall: 0,
};

interface ArmState {
  isArmed: boolean;
  isSupported: boolean;
  error: string | null;
}

export function useAudioArm() {
  const [state, setState] = useState<ArmState>({
    isArmed: false,
    isSupported: true,
    error: null,
  });
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof window === "undefined" ||
      !("AudioContext" in window || "webkitAudioContext" in window)
    ) {
      setState((s) => ({ ...s, isSupported: false }));
    }
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

      const tick = () => {
        analyser.getByteFrequencyData(buffer);
        // bin width @ 48 kHz / 1024 = ~47 Hz/bin
        //   bass:  ~95-470 Hz (bins 2-10)
        //   mid:   ~470-2350 Hz (bins 10-50)
        //   high:  ~2350-9400 Hz (bins 50-200)
        const bass = avg(buffer, 2, 10) / 255;
        const mid = avg(buffer, 10, 50) / 255;
        const high = avg(buffer, 50, 200) / 255;
        audioLevel.bass = bass;
        audioLevel.mid = mid;
        audioLevel.high = high;
        audioLevel.overall = (bass + mid + high) / 3;
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

      setState({ isArmed: true, isSupported: true, error: null });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState({ isArmed: false, isSupported: true, error: msg });
      return false;
    }
  }, [state.isArmed]);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  return { ...state, arm };
}

function avg(data: Uint8Array, start: number, end: number): number {
  const e = Math.min(end, data.length);
  let sum = 0;
  for (let i = start; i < e; i++) sum += data[i];
  return sum / Math.max(1, e - start);
}

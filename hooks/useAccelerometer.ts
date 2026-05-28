"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

export interface MotionSample {
  x: number;
  y: number;
  z: number;
}

interface UseAccelerometerOptions {
  enabled: boolean;
  onSample?: (sample: MotionSample) => void;
  throttleMs?: number;
}

interface UseAccelerometerReturn {
  hasPermission: boolean;
  isSupported: boolean;
  lastSample: MotionSample | null;
  error: string | null;
  requestPermission: () => Promise<boolean>;
}

const subscribeNoop = () => () => {};

export function useAccelerometer(
  options: UseAccelerometerOptions,
): UseAccelerometerReturn {
  const { enabled, onSample, throttleMs = 60 } = options;

  const [hasPermission, setHasPermission] = useState(false);
  // Capability check is client-only; server snapshot is false.
  const isSupported = useSyncExternalStore(
    subscribeNoop,
    () => "DeviceMotionEvent" in window,
    () => false,
  );
  const [error, setError] = useState<string | null>(null);
  const [lastSample, setLastSample] = useState<MotionSample | null>(null);
  const lastSampleRef = useRef<MotionSample | null>(null);
  const onSampleRef = useRef(onSample);

  useEffect(() => {
    onSampleRef.current = onSample;
  }, [onSample]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined") {
      setError("Motion not available");
      return false;
    }
    const win = window as unknown as {
      DeviceMotionEvent?: typeof DeviceMotionEvent & {
        requestPermission?: () => Promise<"granted" | "denied">;
      };
    };
    if (!("DeviceMotionEvent" in win)) {
      setError("DeviceMotionEvent not supported");
      return false;
    }
    try {
      if (win.DeviceMotionEvent?.requestPermission) {
        const result = await win.DeviceMotionEvent.requestPermission();
        if (result !== "granted") {
          setError("Motion permission not granted");
          setHasPermission(false);
          return false;
        }
      }
      setHasPermission(true);
      setError(null);
      return true;
    } catch (err) {
      console.error("Error requesting motion permission", err);
      setError("Error requesting motion permission");
      setHasPermission(false);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !hasPermission) return;
    if (typeof window === "undefined") return;

    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;
      const sample: MotionSample = {
        x: acc.x ?? 0,
        y: acc.y ?? 0,
        z: acc.z ?? 0,
      };
      lastSampleRef.current = sample;
      setLastSample(sample);
    };

    window.addEventListener("devicemotion", handleMotion);

    const intervalId = window.setInterval(() => {
      if (lastSampleRef.current && onSampleRef.current) {
        onSampleRef.current(lastSampleRef.current);
      }
    }, throttleMs);

    return () => {
      window.removeEventListener("devicemotion", handleMotion);
      window.clearInterval(intervalId);
    };
  }, [enabled, hasPermission, throttleMs]);

  return {
    hasPermission,
    isSupported,
    lastSample,
    error,
    requestPermission,
  };
}

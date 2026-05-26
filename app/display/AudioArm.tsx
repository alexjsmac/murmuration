"use client";

import { useState } from "react";
import { audioLevel, useAudioArm } from "@/hooks/useAudioLevel";

/**
 * Tap-to-arm audio overlay on /display. Browsers block getUserMedia
 * without a user gesture, so the projection laptop needs one click
 * after page load to start the FFT pipeline. Hides once armed; shows a
 * tiny corner indicator with live level for debugging.
 */
export function AudioArm() {
  const { isArmed, isSupported, error, arm } = useAudioArm();
  const [armingNow, setArmingNow] = useState(false);

  if (isArmed) {
    return <ArmedIndicator />;
  }

  if (!isSupported) {
    return (
      <div className="fixed bottom-3 left-3 z-50 text-[10px] uppercase tracking-[0.3em] text-foreground/40">
        Audio · unsupported
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-8 pointer-events-none">
      <button
        type="button"
        onClick={async () => {
          setArmingNow(true);
          await arm();
          setArmingNow(false);
        }}
        className="pointer-events-auto bg-magenta hover:bg-hot-pink text-black font-bold uppercase tracking-[0.4em] px-8 py-4 text-xs"
      >
        {armingNow ? "[ ARMING… ]" : "[ Arm Audio ]"}
      </button>
      {error && (
        <p className="absolute bottom-2 text-[10px] uppercase tracking-[0.3em] text-magenta">
          {error}
        </p>
      )}
    </div>
  );
}

function ArmedIndicator() {
  // Tiny live readout in the corner. Updates via requestAnimationFrame
  // outside React state to avoid scene re-renders.
  return (
    <div className="fixed bottom-3 left-3 z-50 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-foreground/40">
      <span className="w-1.5 h-1.5 rounded-full bg-magenta animate-pulse" />
      Audio
      <LiveMeter />
    </div>
  );
}

function LiveMeter() {
  // Pure DOM updates via raf — no React state.
  const setRef = (el: HTMLSpanElement | null) => {
    if (!el) return;
    let raf = 0;
    const tick = () => {
      const pct = Math.round(audioLevel.bass * 100);
      el.textContent = pct.toString().padStart(2, "0");
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    el.dataset.raf = String(raf);
  };
  return <span ref={setRef} className="font-mono">00</span>;
}

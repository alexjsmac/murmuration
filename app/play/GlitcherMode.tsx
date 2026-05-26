"use client";

import { useEffect, useRef, useState } from "react";
import { updateGlitcher, removeGlitcher } from "@/lib/glitcher-service";
import { GLITCHER_THROTTLE_MS } from "@/lib/presets";
import { useIdentity } from "@/hooks/useIdentity";

export function GlitcherMode({ sessionId }: { sessionId: string }) {
  const hue = useIdentity(sessionId);
  const [held, setHeld] = useState(false);
  const [aimDisplay, setAimDisplay] = useState({ x: 0, y: 0 });
  const [intensityDisplay, setIntensityDisplay] = useState(0);

  const intensityRef = useRef(0);
  const positionRef = useRef({ x: 0, y: 0 });
  const padRef = useRef<HTMLDivElement>(null);

  // Animation tick: ramp intensity up while held, decay when released, push to RTDB
  useEffect(() => {
    if (!sessionId) return;
    let raf = 0;
    let last = performance.now();
    let lastWrite = 0;
    let prevWritten = -1;
    let lastDisplaySync = 0;

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;

      const target = held ? 1 : 0;
      const speed = held ? 5 : 2.5;
      intensityRef.current = lerp(
        intensityRef.current,
        target,
        Math.min(1, dt * speed),
      );

      if (now - lastDisplaySync > 50) {
        lastDisplaySync = now;
        setIntensityDisplay(intensityRef.current);
        setAimDisplay({
          x: positionRef.current.x,
          y: positionRef.current.y,
        });
      }

      if (now - lastWrite > GLITCHER_THROTTLE_MS) {
        lastWrite = now;
        const i = intensityRef.current;
        const shouldWrite = i > 0.02 || prevWritten > 0.02;
        if (shouldWrite) {
          updateGlitcher(sessionId, {
            position: positionRef.current,
            intensity: i,
            hue,
          });
          prevWritten = i;
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sessionId, held, hue]);

  // Cleanup glitcher node on unmount
  useEffect(() => {
    return () => {
      if (sessionId) removeGlitcher(sessionId);
    };
  }, [sessionId]);

  const updatePositionFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width; // 0..1
    const py = (e.clientY - rect.top) / rect.height; // 0..1
    // Map to -1..1, with y inverted so up = +1 (matches scene-space convention)
    positionRef.current = {
      x: clamp(px * 2 - 1, -1, 1),
      y: clamp(1 - py * 2, -1, 1),
    };
  };

  return (
    <div className="flex-1 flex flex-col select-none">
      <section className="px-4 pt-4 pb-2 text-[10px] uppercase tracking-[0.3em] text-foreground/50 grid grid-cols-2 gap-3">
        <div className="border border-foreground/10 p-2">
          <p className="text-foreground/40">Aim</p>
          <p className="text-foreground text-sm font-mono mt-1">
            {aimDisplay.x.toFixed(2)} · {aimDisplay.y.toFixed(2)}
          </p>
        </div>
        <div className="border border-foreground/10 p-2">
          <p className="text-foreground/40">Power</p>
          <div className="mt-1.5 h-2 bg-foreground/10 overflow-hidden">
            <div
              className="h-full transition-[width] duration-75"
              style={{
                width: `${Math.round(intensityDisplay * 100)}%`,
                backgroundColor: hue,
              }}
            />
          </div>
        </div>
      </section>

      <div
        ref={padRef}
        className="flex-1 mx-4 mb-4 mt-2 border-2 border-cyan/40 relative touch-none flex items-center justify-center transition-colors"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          updatePositionFromEvent(e);
          setHeld(true);
        }}
        onPointerMove={(e) => {
          if (!held) return;
          updatePositionFromEvent(e);
        }}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId);
          setHeld(false);
        }}
        onPointerCancel={() => setHeld(false)}
        style={{
          backgroundColor: held ? `${hue}22` : "transparent",
          borderColor: held ? hue : undefined,
        }}
      >
        <div className="text-center pointer-events-none">
          <p className="text-2xl font-bold tracking-[0.3em] uppercase">
            {held ? "[ FIRING ]" : "Drag to Aim"}
          </p>
          <p className="text-xs uppercase tracking-[0.3em] text-foreground/50 mt-2">
            Hold and move
          </p>
        </div>
        <CrosshairOverlay x={aimDisplay.x} y={aimDisplay.y} color={hue} />
      </div>
    </div>
  );
}

function CrosshairOverlay({
  x,
  y,
  color,
}: {
  x: number;
  y: number;
  color: string;
}) {
  // Map -1..1 → 0..100% of container
  const left = 50 + x * 50;
  const top = 50 - y * 50;
  return (
    <div
      className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-[left,top] duration-75"
      style={{ left: `${left}%`, top: `${top}%` }}
    >
      <div
        className="absolute inset-0 border-2 rounded-full"
        style={{ borderColor: color }}
      />
      <div
        className="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2"
        style={{ backgroundColor: color }}
      />
      <div
        className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

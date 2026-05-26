"use client";

import { useEffect, useRef, useState } from "react";
import {
  upsertWireframe,
  updateWireframeFields,
} from "@/lib/object-service";
import { useNow } from "@/hooks/useNow";
import { useScene } from "@/hooks/useScene";
import {
  PALETTE,
  SHAPES,
  SHAPE_LABELS,
  EFFECTS,
  EFFECT_LABELS,
  type Effect,
  type Shape,
} from "@/lib/types";
import { GLITCHER_THROTTLE_MS, ROUND_DURATION_MS } from "@/lib/presets";

const DEFAULT_SHAPE: Shape = "ico";
const DEFAULT_COLOR = PALETTE[0];
const DEFAULT_EFFECT: Effect = "still";
const DEFAULT_PAD = { x: 0, y: 0.25 };
const POSITION_THROTTLE_MS = GLITCHER_THROTTLE_MS;
const DISPLAY_SYNC_MS = 80;

function padToScene(p: { x: number; y: number }) {
  return {
    x: p.x * 3.5,
    y: p.y * 2 + 0.5,
    z: 0,
  };
}

export function PlacerMode({ sessionId }: { sessionId: string }) {
  const scene = useScene();
  const now = useNow(1000);

  const [shape, setShape] = useState<Shape>(DEFAULT_SHAPE);
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [effect, setEffect] = useState<Effect>(DEFAULT_EFFECT);

  const padRef = useRef<HTMLDivElement>(null);
  const padPosRef = useRef(DEFAULT_PAD);
  const [padDisplay, setPadDisplay] = useState(DEFAULT_PAD);
  const [held, setHeld] = useState(false);

  // Stable per-session random rotation so each wireframe has a unique pose
  // without re-randomizing on every render.
  const rotationRef = useRef({
    x: Math.random() * Math.PI * 2,
    y: Math.random() * Math.PI * 2,
    z: Math.random() * Math.PI * 2,
  });

  // Create the wireframe immediately on entry with default values. The
  // onDisconnect cleanup wiring lives inside upsertWireframe.
  useEffect(() => {
    if (!sessionId) return;
    upsertWireframe(sessionId, {
      shape: DEFAULT_SHAPE,
      color: DEFAULT_COLOR,
      effect: DEFAULT_EFFECT,
      position: padToScene(DEFAULT_PAD),
      rotation: rotationRef.current,
    });
  }, [sessionId]);

  // Picker selections immediately patch the wireframe (no throttle — these
  // events are rare and instant feedback is the point).
  useEffect(() => {
    if (!sessionId) return;
    updateWireframeFields(sessionId, { shape, color, effect });
  }, [sessionId, shape, color, effect]);

  // Position updates throttled to ~16 Hz; crosshair display throttled to ~12 Hz.
  useEffect(() => {
    if (!sessionId) return;
    let raf = 0;
    let lastWrite = 0;
    let lastDisplay = 0;
    const tick = (now: number) => {
      if (now - lastWrite > POSITION_THROTTLE_MS) {
        lastWrite = now;
        updateWireframeFields(sessionId, {
          position: padToScene(padPosRef.current),
        });
      }
      if (now - lastDisplay > DISPLAY_SYNC_MS) {
        lastDisplay = now;
        setPadDisplay({ ...padPosRef.current });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sessionId]);

  const updatePositionFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    padPosRef.current = {
      x: clamp(px * 2 - 1, -1, 1),
      y: clamp(1 - py * 2, -1, 1),
    };
  };

  const remainingMs = scene.resetAt
    ? Math.max(0, ROUND_DURATION_MS - (now - scene.resetAt))
    : 0;
  const remainingSec = Math.ceil(remainingMs / 1000);
  const mm = Math.floor(remainingSec / 60).toString().padStart(2, "0");
  const ss = (remainingSec % 60).toString().padStart(2, "0");

  return (
    <div className="flex-1 flex flex-col select-none">
      <section className="px-4 pt-3 pb-2 text-[10px] uppercase tracking-[0.3em] text-foreground/50 grid grid-cols-2 gap-3">
        <div className="border border-foreground/10 p-2">
          <p className="text-foreground/40">Round</p>
          <p className="text-foreground text-sm font-mono mt-1">
            {mm}:{ss}
          </p>
        </div>
        <div className="border border-foreground/10 p-2">
          <p className="text-foreground/40">Position</p>
          <p className="text-foreground text-sm font-mono mt-1">
            {padDisplay.x.toFixed(2)} · {padDisplay.y.toFixed(2)}
          </p>
        </div>
      </section>

      <section className="px-4 py-2">
        <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/40 mb-2">
          Shape
        </p>
        <div className="grid grid-cols-5 gap-2">
          {SHAPES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setShape(s)}
              className={`border p-2 flex flex-col items-center gap-1 transition-colors ${
                shape === s
                  ? "border-magenta bg-magenta/15"
                  : "border-foreground/15 hover:border-foreground/40"
              }`}
            >
              <ShapeGlyph shape={s} />
              <span className="text-[9px] uppercase tracking-widest">
                {SHAPE_LABELS[s]}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="px-4 py-2">
        <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/40 mb-2">
          Color
        </p>
        <div className="grid grid-cols-6 gap-2">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              className={`aspect-square border-2 transition-all ${
                color === c
                  ? "border-foreground scale-110"
                  : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </section>

      <section className="px-4 py-2">
        <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/40 mb-2">
          Effect
        </p>
        <div className="grid grid-cols-5 gap-2">
          {EFFECTS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEffect(e)}
              className={`border py-2 text-[10px] uppercase tracking-widest transition-colors ${
                effect === e
                  ? "border-magenta bg-magenta/15 text-foreground"
                  : "border-foreground/15 text-foreground/60 hover:border-foreground/40"
              }`}
            >
              {EFFECT_LABELS[e]}
            </button>
          ))}
        </div>
      </section>

      <div
        ref={padRef}
        className="flex-1 mx-4 mt-2 mb-4 border-2 border-magenta/40 relative touch-none flex items-center justify-center transition-colors"
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
          backgroundColor: held ? `${color}22` : "transparent",
          borderColor: held ? color : undefined,
        }}
      >
        <div className="text-center pointer-events-none">
          <p className="text-lg font-bold tracking-[0.3em] uppercase">
            {held ? "[ MOVING ]" : "Drag to Position"}
          </p>
          <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/40 mt-1">
            Your {SHAPE_LABELS[shape].toLowerCase()} on the wall
          </p>
        </div>
        <CrosshairOverlay x={padDisplay.x} y={padDisplay.y} color={color} />
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

function ShapeGlyph({ shape }: { shape: Shape }) {
  const stroke = "currentColor";
  switch (shape) {
    case "cube":
      return (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path
            d="M3 7 L11 3 L19 7 L11 11 Z M3 7 V15 L11 19 V11 M19 7 V15 L11 19"
            stroke={stroke}
            strokeWidth="1.2"
          />
        </svg>
      );
    case "ico":
      return (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <polygon
            points="11,2 20,8 17,18 5,18 2,8"
            stroke={stroke}
            strokeWidth="1.2"
          />
          <line
            x1="11"
            y1="2"
            x2="11"
            y2="18"
            stroke={stroke}
            strokeWidth="1"
          />
          <line
            x1="2"
            y1="8"
            x2="20"
            y2="8"
            stroke={stroke}
            strokeWidth="1"
          />
        </svg>
      );
    case "head":
      return (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <circle cx="11" cy="12" r="6" stroke={stroke} strokeWidth="1.2" />
          <line x1="11" y1="6" x2="11" y2="2" stroke={stroke} strokeWidth="1" />
          <line x1="8" y1="5" x2="6" y2="2" stroke={stroke} strokeWidth="1" />
          <line x1="14" y1="5" x2="16" y2="2" stroke={stroke} strokeWidth="1" />
        </svg>
      );
    case "cone":
      return (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <polygon
            points="11,3 18,18 4,18"
            stroke={stroke}
            strokeWidth="1.2"
          />
          <ellipse
            cx="11"
            cy="18"
            rx="7"
            ry="1.6"
            stroke={stroke}
            strokeWidth="1"
          />
        </svg>
      );
    case "axisGizmo":
      return (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <line
            x1="11"
            y1="11"
            x2="20"
            y2="11"
            stroke="#ff007a"
            strokeWidth="1.5"
          />
          <line
            x1="11"
            y1="11"
            x2="11"
            y2="2"
            stroke="#aaff00"
            strokeWidth="1.5"
          />
          <line
            x1="11"
            y1="11"
            x2="4"
            y2="18"
            stroke="#00f0ff"
            strokeWidth="1.5"
          />
        </svg>
      );
  }
}

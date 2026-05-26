"use client";

import { useEffect, useRef, useState } from "react";
import { placeObject } from "@/lib/object-service";
import { useScene } from "@/hooks/useScene";
import { useObjects } from "@/hooks/useObjects";
import { useNow } from "@/hooks/useNow";
import {
  PALETTE,
  SHAPES,
  SHAPE_LABELS,
  EFFECTS,
  EFFECT_LABELS,
  type Effect,
  type Shape,
} from "@/lib/types";
import { PLACE_THROTTLE_MS, ROUND_DURATION_MS } from "@/lib/presets";
import { ShapePreview } from "./ShapePreview";

export function PlacerMode({ sessionId }: { sessionId: string }) {
  const scene = useScene();
  const objects = useObjects();
  const now = useNow(1000);
  const [shape, setShape] = useState<Shape>("ico");
  const [color, setColor] = useState<string>(PALETTE[0]);
  const [effect, setEffect] = useState<Effect>("still");
  const [placedCount, setPlacedCount] = useState(0);
  const lastPlaceRef = useRef(0);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => {
      setCooldown((c) => Math.max(0, c - 100));
    }, 100);
    return () => window.clearInterval(id);
  }, [cooldown]);

  const remainingMs = scene.resetAt
    ? Math.max(0, ROUND_DURATION_MS - (now - scene.resetAt))
    : 0;
  const remainingSec = Math.ceil(remainingMs / 1000);
  const mm = Math.floor(remainingSec / 60).toString().padStart(2, "0");
  const ss = (remainingSec % 60).toString().padStart(2, "0");

  const objectsThisRound = objects.filter(
    (o) => !scene.resetAt || o.placedAt >= scene.resetAt - 1000,
  ).length;

  const handlePlace = async () => {
    const now = performance.now();
    if (now - lastPlaceRef.current < PLACE_THROTTLE_MS) return;
    lastPlaceRef.current = now;
    setCooldown(PLACE_THROTTLE_MS);
    setPlacedCount((c) => c + 1);
    try {
      await placeObject(sessionId, shape, color, effect);
    } catch (err) {
      console.error("placeObject failed", err);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <section className="px-4 pt-4 pb-3 grid grid-cols-2 gap-3 text-[10px] uppercase tracking-[0.3em] text-foreground/60">
        <div className="border border-foreground/10 p-2">
          <p className="text-foreground/40">Round</p>
          <p className="text-foreground text-lg font-mono mt-1">
            {mm}:{ss}
          </p>
        </div>
        <div className="border border-foreground/10 p-2">
          <p className="text-foreground/40">In Scene</p>
          <p className="text-foreground text-lg font-mono mt-1">
            {objectsThisRound}
          </p>
        </div>
      </section>

      <section className="px-4 py-3">
        <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/40 mb-2">
          Shape
        </p>
        <div className="grid grid-cols-5 gap-2">
          {SHAPES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setShape(s)}
              className={`border p-3 flex flex-col items-center gap-1 transition-colors ${
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

      <section className="px-4 py-3">
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

      <section className="px-4 py-3">
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

      <div className="flex-1 mx-4 my-2 min-h-0 border border-foreground/10 relative overflow-hidden">
        <ShapePreview shape={shape} color={color} effect={effect} />
      </div>

      <section className="px-4 pb-4 pt-3 space-y-3">
        <div className="text-[10px] uppercase tracking-[0.3em] text-foreground/40 flex justify-between">
          <span>You · {placedCount}</span>
          <span className="text-magenta">SYSTEM::READY</span>
        </div>
        <button
          type="button"
          onClick={handlePlace}
          disabled={cooldown > 0}
          className="w-full py-6 bg-magenta hover:bg-hot-pink active:bg-hot-pink text-black font-bold uppercase tracking-[0.3em] disabled:bg-magenta/30 disabled:text-black/50 transition-colors"
        >
          {cooldown > 0 ? `[ COOLDOWN ${(cooldown / 1000).toFixed(1)}s ]` : `[ PLACE ${SHAPE_LABELS[shape]} ]`}
        </button>
      </section>
    </div>
  );
}

function ShapeGlyph({ shape }: { shape: Shape }) {
  const stroke = "currentColor";
  switch (shape) {
    case "cube":
      return (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M3 7 L11 3 L19 7 L11 11 Z M3 7 V15 L11 19 V11 M19 7 V15 L11 19" stroke={stroke} strokeWidth="1.2" />
        </svg>
      );
    case "ico":
      return (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <polygon points="11,2 20,8 17,18 5,18 2,8" stroke={stroke} strokeWidth="1.2" />
          <line x1="11" y1="2" x2="11" y2="18" stroke={stroke} strokeWidth="1" />
          <line x1="2" y1="8" x2="20" y2="8" stroke={stroke} strokeWidth="1" />
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
          <polygon points="11,3 18,18 4,18" stroke={stroke} strokeWidth="1.2" />
          <ellipse cx="11" cy="18" rx="7" ry="1.6" stroke={stroke} strokeWidth="1" />
        </svg>
      );
    case "axisGizmo":
      return (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <line x1="11" y1="11" x2="20" y2="11" stroke="#ff007a" strokeWidth="1.5" />
          <line x1="11" y1="11" x2="11" y2="2" stroke="#aaff00" strokeWidth="1.5" />
          <line x1="11" y1="11" x2="4" y2="18" stroke="#00f0ff" strokeWidth="1.5" />
        </svg>
      );
  }
}

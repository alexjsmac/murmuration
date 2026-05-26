"use client";

import { useMemo } from "react";

/**
 * Deterministic per-session identity color.
 *
 * Hashes the sessionId to a hue in HSL space with fixed saturation/lightness
 * tuned to read clearly on black under bloom. Two users with different
 * sessionIds will get visually distinct hues; the same sessionId always
 * returns the same color across the app surface (controller header,
 * glitcher beam, future per-author tints).
 */
export function useIdentity(sessionId: string | null): string {
  return useMemo(() => identityColor(sessionId), [sessionId]);
}

export function identityColor(sessionId: string | null): string {
  if (!sessionId) return "#888888";
  let h = 0;
  for (let i = 0; i < sessionId.length; i++) {
    h = (h * 31 + sessionId.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(h) % 360;
  // High saturation + lightness tuned for visibility on black + bloom pass.
  return hslToHex(hue, 88, 58);
}

function hslToHex(h: number, s: number, l: number): string {
  const sFrac = s / 100;
  const lFrac = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sFrac * Math.min(lFrac, 1 - lFrac);
  const f = (n: number) => {
    const color = lFrac - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

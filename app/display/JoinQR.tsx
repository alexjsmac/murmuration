"use client";

import { useSyncExternalStore } from "react";
import { QRCodeSVG } from "qrcode.react";

const subscribeNoop = () => () => {};

/**
 * Small "join" QR pinned to the bottom-right of /display. Encodes the
 * /play URL so audience members can pull out their phone, scan, and be
 * dragging a wireframe within seconds.
 *
 * Sized so it reads from across a venue at 1080p projection. White card
 * gives the high contrast needed for camera apps to lock onto the
 * pattern; the surrounding monospace caption matches the rest of the
 * cyberpunk UI vocabulary.
 */
export function JoinQR() {
  // window.location is client-only; server snapshot is "" so SSR/CSR agree.
  const playUrl = useSyncExternalStore(
    subscribeNoop,
    () => `${window.location.origin}/play/`,
    () => "",
  );

  if (!playUrl) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-center gap-2 pointer-events-none">
      <div className="bg-white p-2">
        <QRCodeSVG
          value={playUrl}
          size={140}
          fgColor="#000000"
          bgColor="#ffffff"
          level="M"
        />
      </div>
      <p className="text-[10px] uppercase tracking-[0.4em] text-foreground/80 bg-black/60 px-2 py-1">
        Scan to Join
      </p>
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { Mode } from "@/lib/types";

// ActiveSession pulls in Firebase + PlacerMode + GlitcherMode.
// Lazy-loading keeps ~246KB of Firebase Auth JS off the initial /play
// paint — the QR-scanner sees the mode picker instantly while Firebase
// loads in the background after their first tap.
const ActiveSession = dynamic(
  () => import("./ActiveSession").then((m) => m.ActiveSession),
  {
    ssr: false,
    loading: () => <FullStatus label="LOADING" />,
  },
);

export default function PlayPage() {
  const [mode, setMode] = useState<Mode | null>(null);

  return (
    <>
      <PullToRefresh />
      {!mode ? (
        <ModePicker onPick={setMode} />
      ) : (
        <ActiveSession mode={mode} onChangeMode={() => setMode(null)} />
      )}
    </>
  );
}

/**
 * Custom pull-to-refresh for /play. Native pull-to-refresh is disabled globally
 * (overscroll-behavior: none) and the drag pads swallow touches, so this listens
 * for a deliberate downward pull that STARTS near the top of the screen (clear
 * of the pads) and reloads — re-running auth + connect to re-join a session that
 * went stale (e.g. after the phone backgrounded and dropped its connection).
 * Self-contained so its per-touch state never re-renders the session below.
 */
function PullToRefresh() {
  const [pull, setPull] = useState(0);

  useEffect(() => {
    const THRESHOLD = 70; // px of pull to trigger a reload
    const TOP_ZONE = 140; // only begin a pull near the top (above the pads)
    let startY = 0;
    let dy = 0;
    let pulling = false;

    const onStart = (e: TouchEvent) => {
      if (window.scrollY > 0 || e.touches.length !== 1) return;
      const y = e.touches[0].clientY;
      if (y > TOP_ZONE) return;
      startY = y;
      dy = 0;
      pulling = true;
    };
    const onMove = (e: TouchEvent) => {
      if (!pulling) return;
      dy = e.touches[0].clientY - startY;
      if (dy <= 0) {
        setPull(0);
        return;
      }
      e.preventDefault(); // suppress any native scroll while pulling
      setPull(Math.min(dy / THRESHOLD, 1.5));
    };
    const onEnd = () => {
      if (pulling && dy >= THRESHOLD) {
        window.location.reload();
        return;
      }
      pulling = false;
      dy = 0;
      setPull(0);
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  if (pull <= 0) return null;
  return (
    <div
      className="fixed top-0 inset-x-0 z-50 flex items-end justify-center pb-1 pointer-events-none"
      style={{
        height: `${Math.min(pull, 1.5) * 52}px`,
        opacity: Math.min(pull, 1),
      }}
    >
      <p className="text-[10px] uppercase tracking-[0.4em] text-magenta">
        {pull >= 1 ? "Release to re-join" : "Pull to refresh"}
      </p>
    </div>
  );
}

function FullStatus({ label }: { label: string }) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-2">
      <p className="text-magenta text-xs uppercase tracking-[0.4em]">
        {label}
      </p>
    </main>
  );
}

function ModePicker({ onPick }: { onPick: (m: Mode) => void }) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 gap-7">
      <div className="text-center space-y-2">
        <p className="text-[10px] uppercase tracking-[0.5em] text-magenta">
          A Co-Creation
        </p>
        <h1 className="leading-none">
          <span className="bg-yellow text-black inline-block font-bold tracking-tight text-3xl px-2 py-1">
            MURMURATION
          </span>
        </h1>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.4em] text-foreground/40 text-center">
          Choose Role
        </p>
        <button
          type="button"
          onClick={() => onPick("placer")}
          className="border border-magenta bg-magenta/10 hover:bg-magenta/25 active:bg-magenta/40 transition-colors p-5 text-left"
        >
          <p className="text-magenta text-xs uppercase tracking-[0.3em]">
            [ Placer ]
          </p>
          <p className="text-lg font-bold mt-1">Drop Wireframes</p>
          <p className="text-xs text-foreground/60 mt-1">
            Build the scene. Place shapes that stay until the round resets.
          </p>
        </button>
        <button
          type="button"
          onClick={() => onPick("glitcher")}
          className="border border-cyan bg-cyan/10 hover:bg-cyan/20 active:bg-cyan/30 transition-colors p-5 text-left"
        >
          <p className="text-cyan text-xs uppercase tracking-[0.3em]">
            [ Glitcher ]
          </p>
          <p className="text-lg font-bold mt-1">Laser Through</p>
          <p className="text-xs text-foreground/60 mt-1">
            Drag the target across the pad to aim and fire a glitch beam
            through the scene.
          </p>
        </button>
      </div>

      <footer className="text-center space-y-2">
        <p className="text-[10px] uppercase tracking-[0.2em] text-foreground/45 leading-relaxed">
          A project by Alex MacLean of BluHeron Interactive
        </p>
        <div className="flex items-center justify-center gap-4 text-[10px] uppercase tracking-[0.3em]">
          <a
            href="https://www.instagram.com/alexjsmac/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-magenta hover:text-hot-pink transition-colors"
          >
            Instagram
          </a>
          <span className="text-foreground/20">·</span>
          <a
            href="mailto:alex@bluheroninteractive.com"
            className="text-magenta hover:text-hot-pink transition-colors"
          >
            Email
          </a>
        </div>
      </footer>
    </main>
  );
}

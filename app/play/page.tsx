"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
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

  if (!mode) {
    return <ModePicker onPick={setMode} />;
  }
  return (
    <ActiveSession mode={mode} onChangeMode={() => setMode(null)} />
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
    <main className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
      <div className="text-center space-y-1">
        <p className="text-xs uppercase tracking-[0.4em] text-foreground/40">
          Choose Role
        </p>
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="bg-yellow text-black px-2 py-0.5">SELECT MODE</span>
        </h1>
      </div>
      <div className="w-full max-w-sm flex flex-col gap-3">
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
      <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/30">
        SYSTEM::ONLINE
      </p>
    </main>
  );
}

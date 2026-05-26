"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/hooks/useSession";
import { useIdentity } from "@/hooks/useIdentity";
import { connect, setMode, disconnect } from "@/lib/connection-manager";
import type { Mode } from "@/lib/types";
import { PlacerMode } from "./PlacerMode";
import { GlitcherMode } from "./GlitcherMode";
import { realtimeDb } from "@/lib/firebase-config";

export default function PlayPage() {
  const sessionId = useSession();
  const [mode, setLocalMode] = useState<Mode | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!sessionId || !mode) return;
    if (!realtimeDb) {
      console.warn("Firebase not configured");
      return;
    }
    let cancelled = false;
    (async () => {
      if (!connected) {
        await connect(sessionId, mode);
        if (!cancelled) setConnected(true);
      } else {
        await setMode(sessionId, mode);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, mode, connected]);

  useEffect(() => {
    if (!sessionId) return;
    const handleUnload = () => {
      disconnect(sessionId);
    };
    window.addEventListener("pagehide", handleUnload);
    return () => window.removeEventListener("pagehide", handleUnload);
  }, [sessionId]);

  if (!sessionId) {
    return <FullStatus label="INITIALIZING" />;
  }

  if (!realtimeDb) {
    return (
      <FullStatus
        label="OFFLINE"
        sublabel="Firebase env not configured. See .env.local.example."
      />
    );
  }

  if (!mode) {
    return <ModePicker onPick={setLocalMode} />;
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header
        mode={mode}
        sessionId={sessionId}
        onChangeMode={() => setLocalMode(null)}
      />
      {mode === "placer" ? (
        <PlacerMode sessionId={sessionId} />
      ) : (
        <GlitcherMode sessionId={sessionId} />
      )}
    </div>
  );
}

function FullStatus({
  label,
  sublabel,
}: {
  label: string;
  sublabel?: string;
}) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-2">
      <p className="text-magenta text-xs uppercase tracking-[0.4em]">
        {label}
      </p>
      {sublabel && (
        <p className="text-foreground/50 text-xs max-w-xs">{sublabel}</p>
      )}
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

function Header({
  mode,
  sessionId,
  onChangeMode,
}: {
  mode: Mode;
  sessionId: string;
  onChangeMode: () => void;
}) {
  const isPlacer = mode === "placer";
  const identity = useIdentity(sessionId);
  return (
    <header className="flex items-center justify-between p-4 border-b border-foreground/10 gap-3">
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${isPlacer ? "bg-magenta" : "bg-cyan"} animate-pulse`}
        />
        <p className="text-xs uppercase tracking-[0.3em]">
          [ {isPlacer ? "PLACER" : "GLITCHER"} ]
        </p>
      </div>
      <div className="flex items-center gap-2">
        <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/40">
          You
        </p>
        <span
          className="w-4 h-4 border border-foreground/30"
          style={{ backgroundColor: identity }}
          aria-label={`Your identity color: ${identity}`}
        />
      </div>
      <button
        type="button"
        onClick={onChangeMode}
        className="text-[10px] uppercase tracking-[0.3em] text-foreground/50 hover:text-foreground"
      >
        Change
      </button>
    </header>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/hooks/useSession";
import { useIdentity } from "@/hooks/useIdentity";
import {
  connect,
  setMode as setModeRtdb,
  disconnect,
} from "@/lib/connection-manager";
import { realtimeDb } from "@/lib/firebase-config";
import type { Mode } from "@/lib/types";
import { PlacerMode } from "./PlacerMode";
import { GlitcherMode } from "./GlitcherMode";

/**
 * Lazy-loaded once the user picks a mode. Owns Firebase auth, connection
 * lifecycle, mode-specific UI mount. Keeping this isolated from the
 * /play page shell means the QR-scanner sees the mode picker before
 * ~246KB of Firebase Auth JS finishes downloading.
 */
export function ActiveSession({
  mode,
  onChangeMode,
}: {
  mode: Mode;
  onChangeMode: () => void;
}) {
  const sessionId = useSession();
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
        await setModeRtdb(sessionId, mode);
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
    return <FullStatus label="SIGNING IN" />;
  }
  if (!realtimeDb) {
    return (
      <FullStatus
        label="OFFLINE"
        sublabel="Firebase env not configured. See .env.local.example."
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header
        mode={mode}
        sessionId={sessionId}
        onChangeMode={onChangeMode}
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

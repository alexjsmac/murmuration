"use client";

import { useEffect, useMemo, useState } from "react";
import { useScene } from "@/hooks/useScene";
import { useGlitchers } from "@/hooks/useGlitchers";
import { useObjects } from "@/hooks/useObjects";
import { useNow } from "@/hooks/useNow";
import {
  setAudioGain,
  setGlobalIntensity,
  setPause,
  setPreset,
  triggerReset,
} from "@/lib/scene-service";
import { clearAllObjects } from "@/lib/object-service";
import { PRESETS, ROUND_DURATION_MS } from "@/lib/presets";
import { ref, onValue, remove } from "firebase/database";
import { realtimeDb } from "@/lib/firebase-config";
import type { Connection, Mode } from "@/lib/types";

const ADMIN_KEY_PARAM = "key";
const ADMIN_KEY_VALUE = process.env.NEXT_PUBLIC_ADMIN_KEY ?? "";
const ADMIN_STORAGE = "murmuration-admin";

export default function AdminPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const key = url.searchParams.get(ADMIN_KEY_PARAM);
    if (ADMIN_KEY_VALUE && key === ADMIN_KEY_VALUE) {
      localStorage.setItem(ADMIN_STORAGE, "1");
      setAuthorized(true);
      return;
    }
    setAuthorized(localStorage.getItem(ADMIN_STORAGE) === "1");
  }, []);

  if (authorized === null) {
    return <Status label="CHECKING" />;
  }
  if (!authorized) {
    return <Status label="LOCKED" />;
  }
  if (!realtimeDb) {
    return <Status label="OFFLINE" sub="Firebase env not configured." />;
  }
  return <Dashboard />;
}

function Dashboard() {
  const scene = useScene();
  const glitchers = useGlitchers();
  const objects = useObjects();
  const now = useNow(1000);
  const [connections, setConnections] = useState<
    Record<string, Connection>
  >({});

  useEffect(() => {
    if (!realtimeDb) return;
    const unsub = onValue(ref(realtimeDb, "connections"), (snap) => {
      setConnections(
        (snap.val() as Record<string, Connection> | null) ?? {},
      );
    });
    return () => unsub();
  }, []);

  const counts = useMemo(() => {
    const entries = Object.values(connections);
    const placers = entries.filter((c) => c.mode === "placer").length;
    const glitcherConns = entries.filter(
      (c) => c.mode === "glitcher",
    ).length;
    return { placers, glitchers: glitcherConns, total: entries.length };
  }, [connections]);

  const objectsThisRound = useMemo(
    () =>
      objects.filter(
        (o) => !scene.resetAt || o.placedAt >= scene.resetAt - 1000,
      ).length,
    [objects, scene.resetAt],
  );

  const remainingMs = scene.resetAt
    ? Math.max(0, ROUND_DURATION_MS - (now - scene.resetAt))
    : 0;
  const remainingSec = Math.ceil(remainingMs / 1000);

  return (
    <main className="flex-1 p-6 max-w-3xl mx-auto w-full">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-xl font-bold tracking-tight">
          <span className="bg-yellow text-black px-2 py-0.5">ADMIN</span>
        </h1>
        <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/50">
          [ {scene.pause ? "PAUSED" : "LIVE"} ]
        </p>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        <Stat label="Placers" value={counts.placers} />
        <Stat label="Glitchers" value={counts.glitchers} />
        <Stat label="Objects" value={objectsThisRound} />
        <Stat label="Round" value={`${remainingSec}s`} />
      </section>

      <section className="space-y-2 mb-6">
        <Row>
          <button
            type="button"
            onClick={() => triggerReset()}
            className="flex-1 border border-magenta bg-magenta/10 hover:bg-magenta/25 px-4 py-3 uppercase tracking-[0.3em] text-xs text-magenta"
          >
            [ Force Reset ]
          </button>
          <button
            type="button"
            onClick={() => clearAllObjects()}
            className="flex-1 border border-foreground/20 hover:border-foreground/50 px-4 py-3 uppercase tracking-[0.3em] text-xs"
          >
            [ Clear Objects ]
          </button>
        </Row>
        <Row>
          <button
            type="button"
            onClick={() => setPause(!scene.pause)}
            className={`flex-1 border px-4 py-3 uppercase tracking-[0.3em] text-xs ${
              scene.pause
                ? "border-cyan bg-cyan/15 text-cyan"
                : "border-foreground/20 hover:border-foreground/50"
            }`}
          >
            [ {scene.pause ? "Resume" : "Pause"} ]
          </button>
        </Row>
      </section>

      <section className="mb-6">
        <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/40 mb-2">
          Preset
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              className={`border px-3 py-2 uppercase tracking-[0.3em] text-xs ${
                scene.preset === p.id
                  ? "border-yellow bg-yellow/15 text-yellow"
                  : "border-foreground/20 hover:border-foreground/50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <div className="flex justify-between items-baseline mb-1">
          <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/40">
            Global Intensity
          </p>
          <p className="text-xs font-mono">
            {(scene.globalIntensity * 100).toFixed(0)}%
          </p>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={scene.globalIntensity}
          onChange={(e) =>
            setGlobalIntensity(parseFloat(e.target.value))
          }
          className="w-full accent-magenta"
        />
      </section>

      <section className="mb-6">
        <div className="flex justify-between items-baseline mb-1">
          <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/40">
            Audio Gain
          </p>
          <p className="text-xs font-mono">
            {scene.audioGain.toFixed(2)}&times;
          </p>
        </div>
        <input
          type="range"
          min={0}
          max={5}
          step={0.05}
          value={scene.audioGain}
          onChange={(e) => setAudioGain(parseFloat(e.target.value))}
          className="w-full accent-cyan"
        />
        <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/40 mt-1">
          1.00&times; = raw mic. Crank up if mic is quiet or the room is dead.
        </p>
      </section>

      <section className="mb-6">
        <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/40 mb-2">
          Glitcher Activity
        </p>
        <div className="border border-foreground/10 p-3 max-h-40 overflow-y-auto text-xs font-mono space-y-1">
          {glitchers.length === 0 && (
            <p className="text-foreground/30">— none —</p>
          )}
          {glitchers.map((g) => (
            <div key={g.sessionId} className="flex justify-between">
              <span className="text-foreground/60 truncate max-w-[60%]">
                {g.sessionId.slice(0, 8)}
              </span>
              <span style={{ color: g.hue }}>
                {(g.intensity * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/40 mb-2">
          Connections
        </p>
        <div className="border border-foreground/10 p-3 max-h-48 overflow-y-auto text-xs font-mono space-y-1">
          {Object.keys(connections).length === 0 && (
            <p className="text-foreground/30">— none —</p>
          )}
          {Object.entries(connections).map(([id, c]) => (
            <div key={id} className="flex justify-between items-center gap-2">
              <span className="text-foreground/60 truncate flex-1">
                {id.slice(0, 8)} · {c.mode as Mode}
              </span>
              <button
                type="button"
                onClick={() => kickSession(id)}
                className="text-magenta/70 hover:text-magenta uppercase tracking-widest"
              >
                kick
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function kickSession(sessionId: string) {
  if (!realtimeDb) return;
  remove(ref(realtimeDb, `connections/${sessionId}`));
  remove(ref(realtimeDb, `glitchers/${sessionId}`));
}

function Status({ label, sub }: { label: string; sub?: string }) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-2">
      <p className="text-magenta text-xs uppercase tracking-[0.4em]">
        {label}
      </p>
      {sub && <p className="text-foreground/50 text-xs max-w-xs">{sub}</p>}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-foreground/10 p-3">
      <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/40">
        {label}
      </p>
      <p className="text-2xl font-mono mt-1">{value}</p>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2">{children}</div>;
}

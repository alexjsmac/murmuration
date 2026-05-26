"use client";

import dynamic from "next/dynamic";
import { AudioArm } from "./AudioArm";

const Scene = dynamic(() => import("./Scene").then((m) => m.Scene), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-black text-magenta text-xs uppercase tracking-[0.4em]">
      INITIALIZING
    </div>
  ),
});

export default function DisplayPage() {
  return (
    <main className="fixed inset-0 bg-black overflow-hidden">
      <Scene />
      <AudioArm />
    </main>
  );
}

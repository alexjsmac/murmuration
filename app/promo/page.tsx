"use client";

import dynamic from "next/dynamic";

const PromoScene = dynamic(
  () => import("./PromoScene").then((m) => m.PromoScene),
  {
    ssr: false,
    loading: () => <div className="absolute inset-0 bg-black" />,
  },
);

export default function PromoPage() {
  return (
    <main className="fixed inset-0 bg-black overflow-hidden flex items-center justify-center">
      <div
        className="relative"
        style={{
          width: "min(100vw, 100vh)",
          height: "min(100vw, 100vh)",
        }}
      >
        <div className="absolute inset-0">
          <PromoScene />
        </div>
        <Overlay />
      </div>
    </main>
  );
}

function Overlay() {
  return (
    <div className="absolute inset-0 pointer-events-none p-[5%] flex flex-col justify-between">
      <div className="space-y-2">
        <p className="text-[clamp(8px,1.4vmin,14px)] uppercase tracking-[0.5em] text-magenta">
          A Co-Creation
        </p>
        <h1 className="leading-none">
          <span
            className="bg-yellow text-black inline-block font-bold tracking-tight"
            style={{
              fontSize: "clamp(24px,9vmin,96px)",
              padding: "0.05em 0.18em",
            }}
          >
            MURMURATION
          </span>
        </h1>
      </div>

      <div className="flex items-end justify-between gap-4">
        <p className="text-[clamp(7px,1.2vmin,12px)] uppercase tracking-[0.4em] text-foreground/55 max-w-[55%]">
          A live visual installation, co-created by everyone in the room.
        </p>
        <div className="text-right">
          <p className="text-[clamp(8px,1.4vmin,14px)] uppercase tracking-[0.45em] text-foreground/85">
            at Avant Mutek
          </p>
          <p className="text-[clamp(7px,1.2vmin,12px)] uppercase tracking-[0.4em] text-foreground/45 mt-1">
            Mooi Space · Toronto · 30.05
          </p>
        </div>
      </div>
    </div>
  );
}

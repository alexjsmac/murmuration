"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";

export default function LandingPage() {
  const [origin, setOrigin] = useState<string>("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const playUrl = origin ? `${origin}/play/` : "";

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-8 gap-10">
      <div className="text-center space-y-2">
        <p className="text-xs uppercase tracking-[0.5em] text-magenta">
          A co-creation
        </p>
        <h1 className="text-5xl font-bold tracking-tight inline-block">
          <span className="bg-yellow text-black px-3 py-1">MURMURATION</span>
        </h1>
        <p className="text-[10px] uppercase tracking-[0.4em] text-foreground/50 mt-3">
          at Avant Mutek · Mooi Space · 30.05
        </p>
      </div>

      {playUrl ? (
        <div className="flex flex-col items-center gap-4">
          <div className="bg-white p-4">
            <QRCodeSVG
              value={playUrl}
              size={220}
              fgColor="#000000"
              bgColor="#ffffff"
              level="M"
            />
          </div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/50">
            Scan to join · {playUrl.replace(/^https?:\/\//, "")}
          </p>
        </div>
      ) : null}

      <div className="flex flex-col items-center gap-3 w-full max-w-sm">
        <Link
          href="/play/"
          className="w-full text-center bg-magenta hover:bg-hot-pink text-black font-bold uppercase tracking-[0.3em] py-4 transition-colors"
        >
          [ Join from this device ]
        </Link>
        <Link
          href="/display/"
          className="text-[10px] uppercase tracking-[0.3em] text-foreground/40 hover:text-foreground/80"
        >
          → Display view
        </Link>
      </div>

      <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/30">
        SYSTEM::ONLINE
      </p>
    </main>
  );
}

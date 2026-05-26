"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useGlitchers, type GlitcherEntry } from "@/hooks/useGlitchers";
import { MAX_GLITCHERS_RENDERED } from "@/lib/presets";

const STALE_MS = 3000;

export function Glitchers() {
  const glitchers = useGlitchers();

  const visible = useMemo(() => {
    const now = Date.now();
    return glitchers
      .filter((g) => g.intensity > 0.05 && now - g.lastSeen < STALE_MS)
      .slice(0, MAX_GLITCHERS_RENDERED);
  }, [glitchers]);

  return (
    <>
      {visible.map((g) => (
        <Beam key={g.sessionId} g={g} />
      ))}
    </>
  );
}

function Beam({ g }: { g: GlitcherEntry }) {
  const x = g.position.x * 6;
  const y = g.position.y * 3;
  const length = 5 + g.intensity * 3;
  const radius = 0.15 + g.intensity * 0.5;

  return (
    <group position={[x, y, 3]}>
      <mesh rotation={[Math.PI, 0, 0]} position={[0, 0, -length / 2]}>
        <coneGeometry args={[radius, length, 24, 1, true]} />
        <meshBasicMaterial
          color={g.hue}
          transparent
          opacity={0.18 + g.intensity * 0.45}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useGlitchers, type GlitcherEntry } from "@/hooks/useGlitchers";
import { useNow } from "@/hooks/useNow";
import { MAX_GLITCHERS_RENDERED } from "@/lib/presets";

const STALE_MS = 3000;

export function Glitchers() {
  const glitchers = useGlitchers();
  // Ticking clock from state drives the staleness filter, so we don't read
  // Date.now() during render; it also re-evaluates ~1x/s without new data.
  const now = useNow(1000);

  const visible = useMemo(() => {
    return glitchers
      .filter((g) => g.intensity > 0.05 && now - g.lastSeen < STALE_MS)
      .slice(0, MAX_GLITCHERS_RENDERED);
  }, [glitchers, now]);

  return (
    <>
      {visible.map((g) => (
        <Beam key={g.sessionId} g={g} />
      ))}
    </>
  );
}

function Beam({ g }: { g: GlitcherEntry }) {
  // All beams anchored at scene origin. Phone pad x/y becomes yaw/pitch
  // (the user "aims" outward from center). Hold strength → length + thickness.
  const yaw = g.position.x * (Math.PI / 3); // ~±60° horizontal sweep
  const pitch = g.position.y * (Math.PI / 4); // ~±45° vertical sweep
  const length = 1.5 + g.intensity * 11;
  const radius = 0.15 + g.intensity * 0.6;

  return (
    <group rotation={[pitch, yaw, 0]}>
      {/* ConeGeometry tip at +y, base at -y. Rotate -π/2 around X so the
          tip points to -z and the base to +z, then translate forward by
          length/2 so the tip ends up at origin and the base at +z*length. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, length / 2]}>
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

"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useGlitchers, type GlitcherEntry } from "@/hooks/useGlitchers";
import { useNow } from "@/hooks/useNow";
import { useScene } from "@/hooks/useScene";

const STALE_MS = 3000;

export function Glitchers() {
  const glitchers = useGlitchers();
  const scene = useScene();
  // Ticking clock from state drives the staleness filter, so we don't read
  // Date.now() during render; it also re-evaluates ~1x/s without new data.
  const now = useNow(1000);

  // Beams use additive blending, so many overlapping ones sum to a white blob
  // through the bloom. Show only the most-intense `maxGlitchers` (admin-tunable)
  // — everyone can still fire, capped-out beams just aren't drawn this instant.
  const cap = scene.maxGlitchers;
  const visible = useMemo(() => {
    return glitchers
      .filter((g) => g.intensity > 0.05 && now - g.lastSeen < STALE_MS)
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, cap);
  }, [glitchers, now, cap]);

  // Dim the group by 1/sqrt(count) so the additive total stays bounded as
  // beams stack (1 → unchanged, 4 → 0.5, 9 → 0.33).
  const dim = 1 / Math.sqrt(visible.length || 1);

  return (
    <>
      {visible.map((g) => (
        <Beam key={g.sessionId} g={g} dim={dim} />
      ))}
    </>
  );
}

function Beam({ g, dim }: { g: GlitcherEntry; dim: number }) {
  // All beams anchored at scene origin. Phone pad x/y becomes yaw/pitch
  // (the user "aims" outward from center). Hold strength → length + thickness.
  const yaw = g.position.x * (Math.PI / 3); // ~±60° horizontal sweep
  // Negated: rotating the +z beam about X by +θ tilts it toward −y (down), so
  // aim-up (position.y > 0) needs a negative pitch to tilt the beam up.
  const pitch = -g.position.y * (Math.PI / 4); // ~±45° vertical sweep
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
          opacity={(0.18 + g.intensity * 0.45) * dim}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

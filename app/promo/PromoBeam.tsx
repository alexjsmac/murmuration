"use client";

import { AdditiveBlending, DoubleSide } from "three";

/**
 * Static decorative beam for /promo, matching the live beam geometry —
 * tip anchored at scene origin, fans outward in a fixed direction.
 */
export function PromoBeam() {
  const yaw = 0.7; // ~40° right
  const pitch = -0.18; // slight downward
  const length = 8;
  const radius = 0.5;

  return (
    <group rotation={[pitch, yaw, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, length / 2]}>
        <coneGeometry args={[radius, length, 24, 1, true]} />
        <meshBasicMaterial
          color="#00f0ff"
          transparent
          opacity={0.4}
          depthWrite={false}
          blending={AdditiveBlending}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}

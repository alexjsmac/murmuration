"use client";

import { AdditiveBlending, DoubleSide } from "three";

export function PromoBeam() {
  return (
    <group position={[2.6, 1.0, 1.5]}>
      <mesh rotation={[Math.PI, 0.15, 0]} position={[0, 0, -2.5]}>
        <coneGeometry args={[0.45, 5, 24, 1, true]} />
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

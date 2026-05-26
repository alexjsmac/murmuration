"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  Color as ThreeColor,
  type Group,
  type LineBasicMaterial,
} from "three";
import { edgesByShape } from "@/lib/object-geometries";
import { applyEffect } from "@/lib/effect-runtime";
import type { Effect, Shape } from "@/lib/types";

// Promo decor uses only geometric shapes — selfies are runtime-only and
// have no place in a static promo render.
type GeometricShape = Exclude<Shape, "selfie">;

interface DecorEntry {
  id: string;
  shape: GeometricShape;
  color: string;
  effect: Effect;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
}

const DECOR: DecorEntry[] = [
  {
    id: "decor-cube",
    shape: "cube",
    color: "#aaff00",
    effect: "drift",
    position: { x: 1.6, y: 1.9, z: -0.4 },
    rotation: { x: 0.6, y: 0.4, z: 0.2 },
  },
  {
    id: "decor-ico-1",
    shape: "ico",
    color: "#00f0ff",
    effect: "pulse",
    position: { x: 2.4, y: 0.3, z: 0.6 },
    rotation: { x: 0.0, y: 0.0, z: 0.0 },
  },
  {
    id: "decor-ico-2",
    shape: "ico",
    color: "#ff007a",
    effect: "drift",
    position: { x: -2.6, y: 0.5, z: -0.6 },
    rotation: { x: 0.5, y: 0.2, z: 0.0 },
  },
  {
    id: "decor-cone",
    shape: "cone",
    color: "#f5ff00",
    effect: "colorPulse",
    position: { x: -1.4, y: -0.6, z: 1.1 },
    rotation: { x: -0.4, y: 0.6, z: -0.2 },
  },
  {
    id: "decor-axis",
    shape: "axisGizmo",
    color: "#ffffff",
    effect: "still",
    position: { x: -2.0, y: 1.6, z: 0.8 },
    rotation: { x: 0.3, y: 0.7, z: 0.1 },
  },
];

export function PromoDecor() {
  return (
    <>
      {DECOR.map((d) => (
        <DecorMesh key={d.id} entry={d} />
      ))}
    </>
  );
}

function DecorMesh({ entry }: { entry: DecorEntry }) {
  const groupRef = useRef<Group>(null);
  const matRef = useRef<LineBasicMaterial>(null);
  const baseColor = useMemo(
    () => new ThreeColor(entry.color),
    [entry.color],
  );
  const seed = useMemo(() => hashStringToFloat(entry.id), [entry.id]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    applyEffect({
      group: groupRef.current,
      material: matRef.current ?? null,
      baseColor,
      basePosition: entry.position,
      effect: entry.effect,
      seed,
      t: clock.elapsedTime,
    });
  });

  if (entry.shape === "axisGizmo") {
    return (
      <group
        ref={groupRef}
        position={[entry.position.x, entry.position.y, entry.position.z]}
        rotation={[entry.rotation.x, entry.rotation.y, entry.rotation.z]}
        scale={0.7}
      >
        <axesHelper args={[0.7]} />
      </group>
    );
  }

  return (
    <group
      ref={groupRef}
      position={[entry.position.x, entry.position.y, entry.position.z]}
      rotation={[entry.rotation.x, entry.rotation.y, entry.rotation.z]}
    >
      <lineSegments geometry={edgesByShape[entry.shape]}>
        <lineBasicMaterial
          ref={matRef}
          color={entry.color}
          transparent
          opacity={0.95}
        />
      </lineSegments>
    </group>
  );
}

function hashStringToFloat(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 1000) / 159;
}

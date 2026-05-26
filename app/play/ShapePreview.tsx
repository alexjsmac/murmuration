"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color as ThreeColor, type Group, type LineBasicMaterial } from "three";
import { edgesByShape } from "@/lib/object-geometries";
import { applyEffect } from "@/lib/effect-runtime";
import type { Effect, Shape } from "@/lib/types";

interface ShapePreviewProps {
  shape: Shape;
  color: string;
  effect: Effect;
}

export function ShapePreview({ shape, color, effect }: ShapePreviewProps) {
  return (
    <Canvas
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0, 1.6], fov: 35 }}
      dpr={[1, 1.5]}
      style={{ background: "transparent" }}
    >
      <PreviewMesh shape={shape} color={color} effect={effect} />
    </Canvas>
  );
}

function PreviewMesh({ shape, color, effect }: ShapePreviewProps) {
  const ref = useRef<Group>(null);
  const matRef = useRef<LineBasicMaterial>(null);
  const baseColor = useMemo(() => new ThreeColor(color), [color]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    // No randomness — deterministic preview
    ref.current.rotation.y = t * 0.6;
    ref.current.rotation.x = Math.sin(t * 0.4) * 0.25;
    applyEffect({
      group: ref.current,
      material: matRef.current ?? null,
      baseColor,
      effect,
      basePosition: { x: 0, y: 0, z: 0 },
      seed: 0,
      t,
    });
  });

  if (shape === "axisGizmo") {
    return (
      <group ref={ref} scale={1.4}>
        <axesHelper args={[0.6]} />
      </group>
    );
  }

  return (
    <group ref={ref}>
      <lineSegments geometry={edgesByShape[shape]}>
        <lineBasicMaterial
          ref={matRef}
          color={color}
          transparent
          opacity={0.95}
        />
      </lineSegments>
    </group>
  );
}

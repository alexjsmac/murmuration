"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  Color as ThreeColor,
  type Group,
  type LineBasicMaterial,
} from "three";
import { useObjects, type WireframeEntry } from "@/hooks/useObjects";
import { MAX_OBJECTS_RENDERED } from "@/lib/presets";
import { edgesByShape } from "@/lib/object-geometries";
import { applyEffect } from "@/lib/effect-runtime";

export function PlacedObjects() {
  const wireframes = useObjects();

  // One per connected Placer; cap render count defensively.
  const visible = useMemo(
    () => wireframes.slice(0, MAX_OBJECTS_RENDERED),
    [wireframes],
  );

  return (
    <>
      {visible.map((w) => (
        <PlacedMesh key={w.sessionId} obj={w} />
      ))}
    </>
  );
}

function PlacedMesh({ obj }: { obj: WireframeEntry }) {
  const groupRef = useRef<Group>(null);
  const matRef = useRef<LineBasicMaterial>(null);
  const baseColor = useMemo(() => new ThreeColor(obj.color), [obj.color]);
  const seed = useMemo(
    () => hashStringToFloat(obj.sessionId),
    [obj.sessionId],
  );

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    // basePosition is the live user-controlled position. Effects oscillate
    // around it (drift offsets sin/cos around base; glitchJitter snaps to
    // small random offsets from base, etc.) — same code, just basePosition
    // updates continuously now instead of being a one-time random value.
    applyEffect({
      group: groupRef.current,
      material: matRef.current ?? null,
      baseColor,
      basePosition: obj.position,
      effect: obj.effect,
      seed,
      t,
    });

    // When the user is NOT actively dragging, add a gentle floating drift
    // around the last drag position. Per-seed phase so objects don't all
    // wander in unison. Disabled while dragging so the object tracks the
    // finger precisely.
    if (!obj.dragging) {
      const dx = Math.sin(t * 0.42 + seed * 1.7) * 0.28;
      const dy = Math.cos(t * 0.37 + seed * 2.3) * 0.18;
      const dz = Math.sin(t * 0.49 + seed * 3.1) * 0.22;
      groupRef.current.position.x += dx;
      groupRef.current.position.y += dy;
      groupRef.current.position.z += dz;
    }
  });

  if (obj.shape === "axisGizmo") {
    return (
      <group
        ref={groupRef}
        position={[obj.position.x, obj.position.y, obj.position.z]}
        rotation={[obj.rotation.x, obj.rotation.y, obj.rotation.z]}
        scale={0.6}
      >
        <axesHelper args={[0.6]} />
      </group>
    );
  }

  return (
    <group
      ref={groupRef}
      position={[obj.position.x, obj.position.y, obj.position.z]}
      rotation={[obj.rotation.x, obj.rotation.y, obj.rotation.z]}
    >
      <lineSegments geometry={edgesByShape[obj.shape]}>
        <lineBasicMaterial
          ref={matRef}
          color={obj.color}
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
  return (Math.abs(h) % 1000) / 159; // pseudo-uniform seed in roughly 0..6
}

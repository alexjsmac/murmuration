"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  Color as ThreeColor,
  type Group,
  type LineBasicMaterial,
} from "three";
import { useObjects, type PlacedObjectEntry } from "@/hooks/useObjects";
import { useScene } from "@/hooks/useScene";
import { MAX_OBJECTS_RENDERED } from "@/lib/presets";
import { edgesByShape } from "@/lib/object-geometries";
import { applyEffect } from "@/lib/effect-runtime";
import { audioLevel } from "@/hooks/useAudioLevel";

export function PlacedObjects() {
  const objects = useObjects();
  const scene = useScene();

  const visible = useMemo(() => {
    return objects
      .filter((o) => !scene.resetAt || o.placedAt >= scene.resetAt - 1000)
      .slice(-MAX_OBJECTS_RENDERED);
  }, [objects, scene.resetAt]);

  return (
    <>
      {visible.map((o) => (
        <PlacedMesh key={o.id} obj={o} />
      ))}
    </>
  );
}

function PlacedMesh({ obj }: { obj: PlacedObjectEntry }) {
  const groupRef = useRef<Group>(null);
  const matRef = useRef<LineBasicMaterial>(null);
  const baseColor = useMemo(() => new ThreeColor(obj.color), [obj.color]);
  const seed = useMemo(() => hashStringToFloat(obj.id), [obj.id]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    applyEffect({
      group: groupRef.current,
      material: matRef.current ?? null,
      baseColor,
      basePosition: obj.position,
      effect: obj.effect,
      seed,
      t,
    });

    // Audio-reactive layer: scale pulse + 3D position jitter from bass.
    // Per-seed phase so objects don't move in unison.
    const bass = audioLevel.bass;
    if (bass > 0.02) {
      const pulse = 1 + bass * 0.55 * (0.6 + 0.4 * Math.sin(t * 6 + seed * 3.1));
      groupRef.current.scale.multiplyScalar(pulse);

      const jitter = bass * 0.32;
      groupRef.current.position.x += Math.sin(seed * 7.7 + t * 9) * jitter;
      groupRef.current.position.y += Math.cos(seed * 11.3 + t * 7) * jitter * 0.7;
      groupRef.current.position.z += Math.sin(seed * 13.1 + t * 8) * jitter;
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

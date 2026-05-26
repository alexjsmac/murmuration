"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { HeroKind } from "@/lib/presets";
import { audioLevel } from "@/hooks/useAudioLevel";

export function HeroMesh({ kind }: { kind: HeroKind }) {
  const groupRef = useRef<THREE.Group>(null);

  const geometry = useMemo(() => {
    switch (kind) {
      case "ico":
        return new THREE.IcosahedronGeometry(1.5, 1);
      case "torus":
        return new THREE.TorusKnotGeometry(1.1, 0.35, 128, 16);
      case "abstract":
        return new THREE.OctahedronGeometry(1.6, 2);
      case "head":
      default:
        return makeSpikyHead();
    }
  }, [kind]);

  const edges = useMemo(
    () => new THREE.EdgesGeometry(geometry, 1),
    [geometry],
  );

  const spinRef = useRef(0);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    const bass = audioLevel.bass;
    const overall = audioLevel.overall;

    // Spin speed accelerates with overall energy
    spinRef.current += 0.18 * (1 + overall * 1.5) * (1 / 60);
    groupRef.current.rotation.y = spinRef.current;
    groupRef.current.rotation.x = Math.sin(t * 0.1) * 0.2;

    // Bass pulses the whole hero in/out around base scale
    const pulse = 1 + bass * 0.35;
    groupRef.current.scale.setScalar(pulse);
  });

  return (
    <group ref={groupRef}>
      <lineSegments geometry={edges}>
        <lineBasicMaterial
          color="#ff007a"
          transparent
          opacity={0.95}
          depthTest
        />
      </lineSegments>
      <mesh geometry={geometry}>
        <meshBasicMaterial
          color="#ff007a"
          wireframe
          transparent
          opacity={0.12}
        />
      </mesh>
    </group>
  );
}

function makeSpikyHead(): THREE.BufferGeometry {
  const geom = new THREE.IcosahedronGeometry(1.4, 3);
  const pos = geom.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const isTopSpike = v.y > 0.2 && Math.random() > 0.7;
    const spike = isTopSpike ? 0.4 + Math.random() * 1.2 : 0;
    const base = v.length();
    v.normalize().multiplyScalar(base + spike);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geom.computeVertexNormals();
  return geom;
}

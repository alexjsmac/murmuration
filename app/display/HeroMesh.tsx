"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { HeroKind } from "@/lib/presets";
import { audioLevel } from "@/hooks/useAudioLevel";
import {
  attachWhiteColors,
  decayLineColors,
  flashLineColors,
} from "@/lib/line-color";
import { makeFlashable } from "@/lib/flashable-material";

const MORPH_AMP = 0.13;

export function HeroMesh({ kind }: { kind: HeroKind }) {
  const groupRef = useRef<THREE.Group>(null);
  const edgesMatRef = useRef<THREE.LineBasicMaterial>(null);
  const meshMatRef = useRef<THREE.MeshBasicMaterial>(null);

  useEffect(() => {
    if (edgesMatRef.current) makeFlashable(edgesMatRef.current);
    if (meshMatRef.current) makeFlashable(meshMatRef.current);
  }, []);

  const geometry = useMemo(() => {
    let g: THREE.BufferGeometry;
    switch (kind) {
      case "ico":
        g = new THREE.IcosahedronGeometry(1.5, 1);
        break;
      case "torus":
        g = new THREE.TorusKnotGeometry(1.1, 0.35, 128, 16);
        break;
      case "abstract":
        g = new THREE.OctahedronGeometry(1.6, 2);
        break;
      case "spiral":
        g = makeSpiral();
        break;
      case "lattice":
        g = makeLattice();
        break;
      case "head":
      default:
        g = makeSpikyHead();
        break;
    }
    attachWhiteColors(g);
    return g;
  }, [kind]);

  const edges = useMemo(() => {
    const e = new THREE.EdgesGeometry(geometry, 1);
    attachWhiteColors(e);
    return e;
  }, [geometry]);

  // Snapshot positions to morph against; per-vertex random unit direction
  // gives each point its own wander axis. Recomputed when geometry changes.
  const morphRefs = useMemo(() => {
    const posAttr = geometry.attributes.position;
    const count = posAttr.count;
    const basePositions = new Float32Array(posAttr.array as Float32Array);
    const randDirs = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const dx = Math.sin(i * 12.9898 + 0.5) * 2 - 1;
      const dy = Math.sin(i * 78.233 + 1.3) * 2 - 1;
      const dz = Math.sin(i * 43.5453 + 2.1) * 2 - 1;
      const len = Math.hypot(dx, dy, dz) || 1;
      randDirs[i * 3 + 0] = dx / len;
      randDirs[i * 3 + 1] = dy / len;
      randDirs[i * 3 + 2] = dz / len;
    }
    return { basePositions, randDirs };
  }, [geometry]);

  const spinRef = useRef(0);
  const lastSeenOnsetRef = useRef(0);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    const bass = audioLevel.bass;
    const overall = audioLevel.overall;

    // Vertex morph — wander each point along its own random axis.
    const posAttr = geometry.attributes.position;
    const arr = posAttr.array as Float32Array;
    const { basePositions, randDirs } = morphRefs;
    for (let i = 0; i < posAttr.count; i++) {
      const phase = i * 0.731;
      const wobble = Math.sin(t * 1.4 + phase) * MORPH_AMP;
      const o = i * 3;
      arr[o + 0] = basePositions[o + 0] + randDirs[o + 0] * wobble;
      arr[o + 1] = basePositions[o + 1] + randDirs[o + 1] * wobble;
      arr[o + 2] = basePositions[o + 2] + randDirs[o + 2] * wobble;
    }
    posAttr.needsUpdate = true;

    // Spin accelerates with overall energy
    spinRef.current += 0.18 * (1 + overall * 1.5) * (1 / 60);
    groupRef.current.rotation.y = spinRef.current;
    groupRef.current.rotation.x = Math.sin(t * 0.1) * 0.2;

    // Bass pulses the whole hero in/out
    const pulse = 1 + bass * 0.35;
    groupRef.current.scale.setScalar(pulse);

    // Color flash on bass onset (both outer edges + inner wireframe).
    // Hero owns its own edges + geometry color buffers (not shared), so
    // we drive flash/decay here.
    if (audioLevel.lastBassOnset > lastSeenOnsetRef.current) {
      lastSeenOnsetRef.current = audioLevel.lastBassOnset;
      flashLineColors(edges);
      flashLineColors(geometry);
    } else {
      decayLineColors(edges, 0.07);
      decayLineColors(geometry, 0.07);
    }
  });

  return (
    <group ref={groupRef}>
      <lineSegments geometry={edges}>
        <lineBasicMaterial
          ref={edgesMatRef}
          color="#ff007a"
          vertexColors
          transparent
          opacity={0.95}
          depthTest
        />
      </lineSegments>
      <mesh geometry={geometry}>
        <meshBasicMaterial
          ref={meshMatRef}
          color="#ff007a"
          wireframe
          vertexColors
          transparent
          opacity={0.16}
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

/** Helical coil — radius pulses outward at top + bottom. */
function makeSpiral(): THREE.BufferGeometry {
  // Two-tube torus knot variant tuned to read as a vertical spiral.
  const geom = new THREE.TorusKnotGeometry(1.0, 0.18, 220, 12, 5, 1);
  return geom;
}

/** Subdivided box — wireframe naturally reads as a 3D lattice/grid. */
function makeLattice(): THREE.BufferGeometry {
  return new THREE.BoxGeometry(2.6, 2.6, 2.6, 4, 4, 4);
}

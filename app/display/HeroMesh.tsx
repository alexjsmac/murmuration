"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { DECONSTRUCT_MS, ROUND_DURATION_MS, type HeroKind } from "@/lib/presets";
import { audioLevel } from "@/hooks/useAudioLevel";
import {
  attachWhiteColors,
  decayLineColors,
  flashLineColors,
} from "@/lib/line-color";
import { makeFlashable } from "@/lib/flashable-material";

/* eslint-disable react-hooks/immutability --
   This component morphs the three.js geometry position buffer and mutates the
   group transform every frame inside useFrame — the intended R3F pattern,
   which the React Compiler immutability rule doesn't model. */

const MAX_FLING = 12; // how far deconstruction pieces fly (world units)

export function HeroMesh({
  kind,
  color,
  morphAmp,
  spinSpeed,
  resetAt,
}: {
  kind: HeroKind;
  color: string;
  morphAmp: number;
  spinSpeed: number;
  resetAt: number;
}) {
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

  // Per-segment outward "explosion" velocities for the deconstruction finale.
  // `edges` is an EdgesGeometry: its position buffer is consecutive vertex PAIRS
  // (each pair = one line segment = one "piece"). We fling each segment outward
  // as a rigid unit (both its vertices share one velocity).
  const shatterRefs = useMemo(() => {
    const pos = edges.attributes.position;
    const base = new Float32Array(pos.array as Float32Array);
    const segCount = Math.floor(pos.count / 2);
    const vel = new Float32Array(segCount * 3);
    for (let k = 0; k < segCount; k++) {
      const a = k * 6; // 2 verts * 3 coords per segment
      let dx = (base[a] + base[a + 3]) * 0.5; // segment midpoint = outward dir
      let dy = (base[a + 1] + base[a + 4]) * 0.5;
      let dz = (base[a + 2] + base[a + 5]) * 0.5;
      let len = Math.hypot(dx, dy, dz);
      if (len < 1e-3) {
        // Segment sits near the origin — pick a deterministic pseudo-random dir.
        dx = Math.sin(k * 12.9898);
        dy = Math.sin(k * 78.233);
        dz = Math.sin(k * 43.5453);
        len = Math.hypot(dx, dy, dz) || 1;
      }
      const speed = 0.7 + (Math.sin(k * 7.13) * 0.5 + 0.5) * 0.7; // ~0.7..1.4
      vel[k * 3 + 0] = (dx / len + Math.sin(k * 1.7) * 0.25) * speed;
      vel[k * 3 + 1] = (dy / len + Math.sin(k * 2.3) * 0.25) * speed;
      vel[k * 3 + 2] = (dz / len + Math.sin(k * 3.1) * 0.25) * speed;
    }
    return { base, vel, segCount };
  }, [edges]);

  // True while the edges are flung apart, so we can restore them to base once
  // when the round resets (covers the rare same-preset-repeat case where the
  // edges geometry isn't rebuilt).
  const displacedRef = useRef(false);

  const spinRef = useRef(0);
  const lastSeenOnsetRef = useRef(0);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    const bass = audioLevel.bass;
    const overall = audioLevel.overall;

    // Deconstruction progress: 0 until the final minute, easing to 1 at round
    // end. Pure function of resetAt, so it resets itself each round.
    const f = resetAt
      ? THREE.MathUtils.clamp(
          (Date.now() - resetAt - (ROUND_DURATION_MS - DECONSTRUCT_MS)) /
            DECONSTRUCT_MS,
          0,
          1,
        )
      : 0;

    // Vertex morph — wander each point; chaos grows as it breaks up.
    const amp = morphAmp * (1 + f * 3);
    const posAttr = geometry.attributes.position;
    const arr = posAttr.array as Float32Array;
    const { basePositions, randDirs } = morphRefs;
    for (let i = 0; i < posAttr.count; i++) {
      const phase = i * 0.731;
      const wobble = Math.sin(t * 1.4 + phase) * amp;
      const o = i * 3;
      arr[o + 0] = basePositions[o + 0] + randDirs[o + 0] * wobble;
      arr[o + 1] = basePositions[o + 1] + randDirs[o + 1] * wobble;
      arr[o + 2] = basePositions[o + 2] + randDirs[o + 2] * wobble;
    }
    posAttr.needsUpdate = true;

    // Edges "explosion" — fling each segment outward, accelerating (f²) and
    // surging on the bass; fades to nothing by round end. Gated to the finale.
    if (f > 0) {
      const dist = f * f * MAX_FLING * (1 + bass * 0.6);
      const { base, vel, segCount } = shatterRefs;
      const epos = edges.attributes.position;
      const earr = epos.array as Float32Array;
      for (let k = 0; k < segCount; k++) {
        const ox = vel[k * 3 + 0] * dist;
        const oy = vel[k * 3 + 1] * dist;
        const oz = vel[k * 3 + 2] * dist;
        const a = k * 6;
        earr[a + 0] = base[a + 0] + ox;
        earr[a + 1] = base[a + 1] + oy;
        earr[a + 2] = base[a + 2] + oz;
        earr[a + 3] = base[a + 3] + ox;
        earr[a + 4] = base[a + 4] + oy;
        earr[a + 5] = base[a + 5] + oz;
      }
      epos.needsUpdate = true;
      displacedRef.current = true;
    } else if (displacedRef.current) {
      // Round reset — restore the edges to their intact positions once.
      const epos = edges.attributes.position;
      (epos.array as Float32Array).set(shatterRefs.base);
      epos.needsUpdate = true;
      displacedRef.current = false;
    }

    // Fade both layers to nothing as the hero deconstructs (gone by round end).
    if (edgesMatRef.current) {
      edgesMatRef.current.opacity = 0.95 * (1 - THREE.MathUtils.smoothstep(f, 0.55, 1));
    }
    if (meshMatRef.current) {
      meshMatRef.current.opacity = 0.16 * (1 - f);
    }

    // Spin accelerates with overall audio energy.
    spinRef.current += spinSpeed * (1 + overall * 1.5) * (1 / 60);
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
          color={color}
          vertexColors
          transparent
          opacity={0.95}
          depthTest
        />
      </lineSegments>
      <mesh geometry={geometry}>
        <meshBasicMaterial
          ref={meshMatRef}
          color={color}
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

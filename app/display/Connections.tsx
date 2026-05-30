"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { audioLevel } from "@/hooks/useAudioLevel";

/** Live position + colour of each placed object, written by PlacedMesh. */
export type ConnRegistry = Map<
  string,
  { pos: THREE.Vector3; color: THREE.Color }
>;

const CONNECT_DIST = 2.4; // objects closer than this start linking
const MAX_STRANDS = 48; // max connected pairs rendered (O(n²) scan, capped)
const STRANDS_PER_PAIR = 2; // "hair" filaments per connection
const POINTS = 9; // points along each filament
const SEGMENTS = POINTS - 1;
const BASE_AMP = 0.12; // jaggedness at rest
const BASS_AMP = 0.18; // extra jaggedness on the beat
const MAX_VERTS = MAX_STRANDS * STRANDS_PER_PAIR * SEGMENTS * 2;

// Reusable temps — no per-frame allocation in the hot loop.
const _dir = new THREE.Vector3();
const _dirN = new THREE.Vector3();
const _perp1 = new THREE.Vector3();
const _perp2 = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _altUp = new THREE.Vector3(1, 0, 0);
const _prev = new THREE.Vector3();
const _cur = new THREE.Vector3();

/**
 * Electric strands between nearby placed objects — visualising the invisible
 * connections of a murmuration. Each frame: find pairs within CONNECT_DIST and
 * draw jagged arcs that brighten/jitter more as objects approach and flare on
 * the bass. Arc colour blends the two objects' colours end-to-end; rendered HDR
 * + additive so the scene bloom turns them into a glow.
 */
export function Connections({ registry }: { registry: ConnRegistry }) {
  const geomRef = useRef<THREE.BufferGeometry>(null);

  const { positions, colors } = useMemo(
    () => ({
      positions: new Float32Array(MAX_VERTS * 3),
      colors: new Float32Array(MAX_VERTS * 3),
    }),
    [],
  );

  useFrame(({ clock }) => {
    const geom = geomRef.current;
    const posAttr = geom?.attributes.position as
      | THREE.BufferAttribute
      | undefined;
    const colAttr = geom?.attributes.color as THREE.BufferAttribute | undefined;
    if (!geom || !posAttr || !colAttr) return;

    const t = clock.elapsedTime;
    const bass = audioLevel.bass;
    const entries = Array.from(registry.values());
    const n = entries.length;

    let v = 0; // vertex cursor
    let strands = 0;
    const maxStrands = MAX_STRANDS * STRANDS_PER_PAIR;

    scan: for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const A = entries[i].pos;
        const B = entries[j].pos;
        const distSq = A.distanceToSquared(B);
        if (distSq >= CONNECT_DIST * CONNECT_DIST) continue;
        const dist = Math.sqrt(distSq) || 1e-4;
        const proximity = 1 - dist / CONNECT_DIST; // 0 at threshold, 1 touching

        const cA = entries[i].color;
        const cB = entries[j].color;
        const bright = 0.3 + 1.7 * proximity + bass * 0.9; // HDR (>1) → blooms
        const amp = (BASE_AMP + bass * BASS_AMP) * proximity;

        // Two perpendicular axes for the jitter (robust when near-vertical).
        _dir.subVectors(B, A);
        _dirN.copy(_dir).normalize();
        _perp1
          .crossVectors(_dirN, Math.abs(_dirN.y) > 0.9 ? _altUp : _up)
          .normalize();
        _perp2.crossVectors(_dirN, _perp1).normalize();

        for (let s = 0; s < STRANDS_PER_PAIR; s++) {
          if (strands >= maxStrands) break scan;
          strands++;
          const seed = (i * 31 + j * 7 + s * 101) * 0.137;
          for (let p = 0; p < POINTS; p++) {
            const f = p / SEGMENTS;
            const taper = Math.sin(Math.PI * f); // anchor the ends to A,B
            const jx =
              (Math.sin(t * 9 + p * 1.7 + seed) +
                0.5 * Math.sin(t * 17 + p * 3.1 + seed * 2)) *
              amp *
              taper;
            const jy =
              (Math.cos(t * 11 + p * 2.3 + seed * 1.5) +
                0.5 * Math.cos(t * 19 + p * 1.3 + seed)) *
              amp *
              taper;
            _cur
              .copy(A)
              .lerp(B, f)
              .addScaledVector(_perp1, jx)
              .addScaledVector(_perp2, jy);
            if (p > 0) {
              const fPrev = (p - 1) / SEGMENTS;
              writeVertex(positions, colors, v++, _prev, cA, cB, fPrev, bright);
              writeVertex(positions, colors, v++, _cur, cA, cB, f, bright);
            }
            _prev.copy(_cur);
          }
        }
      }
    }

    geom.setDrawRange(0, v);
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  });

  return (
    <lineSegments frustumCulled={false}>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <lineBasicMaterial
        vertexColors
        transparent
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        depthWrite={false}
      />
    </lineSegments>
  );
}

function writeVertex(
  positions: Float32Array,
  colors: Float32Array,
  vi: number,
  p: THREE.Vector3,
  cA: THREE.Color,
  cB: THREE.Color,
  f: number,
  bright: number,
): void {
  const o = vi * 3;
  positions[o] = p.x;
  positions[o + 1] = p.y;
  positions[o + 2] = p.z;
  colors[o] = (cA.r + (cB.r - cA.r) * f) * bright;
  colors[o + 1] = (cA.g + (cB.g - cA.g) * f) * bright;
  colors[o + 2] = (cA.b + (cB.b - cA.b) * f) * bright;
}

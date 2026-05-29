"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/* eslint-disable react-hooks/immutability --
   Drives a three.js backdrop mesh + shader uniforms imperatively inside
   useFrame (camera-follow transform, time, eased colors) — the intended R3F
   pattern, which the React Compiler immutability rule doesn't model. */

/**
 * Gentle "electric clouds" behind the scene. A large plane that follows the
 * camera (so it always fills the view through drift + snap-cuts) and renders
 * first (renderOrder -1, depth off) so everything else draws over it. The
 * fragment shader is domain-warped fractal noise scrolling slowly — soft
 * clouds blowing past — tinted by two scheme-paired colours that ease toward
 * the active preset's palette on scene rotation. Kept dim so it mostly stays
 * under the bloom threshold (a gentle glow, with bright peaks shimmering).
 */

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;

  // Overall cloud brightness. A plain const (not a uniform): it never animates,
  // and a number uniform mutated per-frame did not reliably reach the GPU here
  // (Color-object uniforms did, via in-place mutation — numbers did not). Tune
  // this value to make the clouds more/less present.
  const float INTENSITY = 0.025;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }
  float fbm(vec2 p) {
    float v = 0.0, amp = 0.5;
    for (int i = 0; i < 5; i++) {
      v += amp * noise(p);
      p *= 2.0;
      amp *= 0.5;
    }
    return v;
  }
  void main() {
    vec2 uv = vUv * 3.0;
    float t = uTime * 0.03; // slow drift = "blowing gently past"
    // Domain warp for soft rolling motion.
    vec2 q = vec2(
      fbm(uv + vec2(t, t * 0.6)),
      fbm(uv + vec2(5.2 - t * 0.7, 1.3 + t * 0.5))
    );
    float n = fbm(uv + 1.6 * q + vec2(t * 0.5, -t * 0.2));
    // Near-full-field flow with a soft floor, so it reads as a gentle rolling
    // gradient (visible across all hues, not just bright ones) that swells into
    // brighter wisps — rather than sparse puffs lost on black.
    float clouds = 0.3 + 0.7 * smoothstep(0.05, 0.85, n);
    // Normalize by the colour's luminance so every preset (dim magenta or bright
    // cyan alike) reads with similar presence, then scale by intensity.
    vec3 base = mix(uColorA, uColorB, clamp(n * 1.15, 0.0, 1.0));
    float luma = max(dot(base, vec3(0.2126, 0.7152, 0.0722)), 0.18);
    vec3 col = (base / luma) * clouds * INTENSITY;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const FOLLOW_DIST = 22; // plane sits this far in front of the camera
const _fwd = new THREE.Vector3();

export function CloudBackdrop({
  colorA,
  colorB,
}: {
  colorA: string;
  colorB: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  const targetA = useMemo(() => new THREE.Color(colorA), [colorA]);
  const targetB = useMemo(() => new THREE.Color(colorB), [colorB]);

  // Stable uniforms, created once. Colours start at black and ease toward the
  // active preset in useFrame (Color objects, mutated in place — which does
  // reach the GPU), so the clouds fade up gently on load and shift on scene
  // rotation. No props in the factory, so the empty dep list is correct.
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color() },
      uColorB: { value: new THREE.Color() },
    }),
    [],
  );

  useFrame(({ camera, clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    // Follow the camera so the backdrop always fills the view (camera drifts
    // and snap-cuts around, but the clouds shouldn't reveal an edge).
    mesh.quaternion.copy(camera.quaternion);
    _fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
    mesh.position.copy(camera.position).addScaledVector(_fwd, FOLLOW_DIST);

    uniforms.uTime.value = clock.elapsedTime;
    // Ease colours toward the active preset so scene rotation shifts the
    // clouds gently rather than popping.
    uniforms.uColorA.value.lerp(targetA, 0.03);
    uniforms.uColorB.value.lerp(targetB, 0.03);
  });

  return (
    <mesh ref={meshRef} renderOrder={-1} frustumCulled={false}>
      <planeGeometry args={[80, 50]} />
      <shaderMaterial
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

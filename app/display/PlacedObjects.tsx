"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  BufferGeometry,
  Color as ThreeColor,
  Float32BufferAttribute,
  MeshBasicMaterial,
  SphereGeometry,
  type Group,
  type LineBasicMaterial,
  type Mesh,
} from "three";
import { useObjects, type WireframeEntry } from "@/hooks/useObjects";
import { audioLevel } from "@/hooks/useAudioLevel";
import { MAX_OBJECTS_RENDERED } from "@/lib/presets";
import { edgesByShape } from "@/lib/object-geometries";
import { applyEffect } from "@/lib/effect-runtime";
import { TESSELATION_INDEX, CONTOURS_INDEX } from "@/lib/face-mesh-topology";

// Glowing red eyes for selfie faces — a hue unused elsewhere in the palette.
// Rendered HDR (channels exceed 1) with toneMapped:false so the scene bloom
// turns them into a glow; pure red's luminance otherwise sits under the bloom
// threshold. Brightness = steady base + gentle sine pulse + bass flare.
const EYE_R = 1.0;
// Pure red — any green/blue gets split into separate ghost orbs by the scene's
// chromatic-aberration pass, so keep those channels at zero.
const EYE_G = 0.0;
const EYE_B = 0.0;
// Brightness (HDR, >1): higher = more bloom glow. base + gentle pulse + bass.
const EYE_BASE = 2.4;
const EYE_PULSE = 1.2;
const EYE_BASS = 2.6;
const EYE_PULSE_RATE = 1.6; // rad/s — slow & gentle
// The orbs also throb in size with the same pulse + bass for a stronger pulse.
const EYE_SCALE_PULSE = 0.25;
const EYE_SCALE_BASS = 0.6;
const EYE_GEOMETRY = new SphereGeometry(0.075, 16, 16); // shared by all eyes

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
  const leftEyeRef = useRef<Mesh>(null);
  const rightEyeRef = useRef<Mesh>(null);
  const baseColor = useMemo(() => new ThreeColor(obj.color), [obj.color]);
  const seed = useMemo(
    () => hashStringToFloat(obj.sessionId),
    [obj.sessionId],
  );

  // Per-face eye material (own instance so each face pulses on its own phase).
  // Declared before useFrame, which mutates its colour each frame.
  const eyeMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new ThreeColor(EYE_R, EYE_G, EYE_B),
        toneMapped: false,
        transparent: true,
        depthWrite: false,
      }),
    [],
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

    // Faces add their own gentle yaw sway. Placed objects otherwise never
    // rotate at runtime (effects touch only position/scale/color and the
    // camera never orbits), so the 3D relief would only show from one frozen
    // angle. This overrides the static JSX rotation each frame.
    if (obj.faceMesh?.length) {
      groupRef.current.rotation.set(
        Math.sin(t * 0.5 + seed) * 0.08, // subtle pitch
        Math.sin(t * 0.3 + seed) * 0.7, // yaw ±~40°
        0, // stay upright
      );

      // Glowing eyes: steady base + gentle sine pulse + bass flare, kept HDR
      // (>1) so the bloom turns them into a red glow; the orbs also throb in
      // size with the same pulse + bass. Per-seed phase so faces don't pulse
      // in unison.
      const pulse01 = 0.5 + 0.5 * Math.sin(t * EYE_PULSE_RATE + seed);
      const bright = EYE_BASE + EYE_PULSE * pulse01 + EYE_BASS * audioLevel.bass;
      eyeMat.color.setRGB(EYE_R * bright, EYE_G * bright, EYE_B * bright);
      const eyeScale =
        1 + EYE_SCALE_PULSE * pulse01 + EYE_SCALE_BASS * audioLevel.bass;
      leftEyeRef.current?.scale.setScalar(eyeScale);
      rightEyeRef.current?.scale.setScalar(eyeScale);
    }
  });

  // Face geometry — built on-demand from the user's uploaded MediaPipe
  // landmarks. Two indexed line layers over the same 478 points: a dim full
  // tessellation net and bright feature contours. The per-vertex grayscale
  // attribute carries the face's sampled luminance (real light/shadow, so
  // different people look different), with depth as a light secondary
  // multiplier; it falls back to depth-only when no luminance was sent. Only
  // rebuilt when the points/shade change — useObjects preserves both array
  // references across position-only drag updates, so dragging never rebuilds.
  const faceGeometry = useMemo(() => {
    if (obj.shape !== "selfie" || !obj.faceMesh?.length) return null;
    const positions = new Float32Array(obj.faceMesh);
    const vcount = positions.length / 3;
    const shade = obj.faceShade?.length === vcount ? obj.faceShade : null;

    // Depth range → relief cue (1 = nearest).
    let zmin = Infinity;
    let zmax = -Infinity;
    for (let i = 0; i < vcount; i++) {
      const z = positions[i * 3 + 2];
      if (z < zmin) zmin = z;
      if (z > zmax) zmax = z;
    }
    const zspan = zmax - zmin || 1;

    // Per-face luminance range for a contrast stretch, so dark and bright
    // selfies both read through the bloom.
    let lmin = Infinity;
    let lmax = -Infinity;
    if (shade) {
      for (let i = 0; i < vcount; i++) {
        const l = shade[i];
        if (l < lmin) lmin = l;
        if (l > lmax) lmax = l;
      }
    }
    const lspan = lmax - lmin || 1;

    // Grayscale (b,b,b) so final color = material.color (tint) × b — keeping
    // the tint out of the vertex color lets colorPulse modulate the material
    // without squaring the hue.
    const colors = new Float32Array(vcount * 3);
    for (let i = 0; i < vcount; i++) {
      const depthNorm = 1 - (positions[i * 3 + 2] - zmin) / zspan; // 1 = nearest
      let b: number;
      if (shade) {
        const ln = (shade[i] - lmin) / lspan; // 0..1 within this face
        const lum = 0.35 + 0.8 * ln; // 0.35 .. 1.15
        b = lum * (0.85 + 0.15 * depthNorm); // depth as a gentle modulation
      } else {
        b = 0.45 + 0.75 * depthNorm; // depth-only fallback (0.45 .. 1.2)
      }
      colors[i * 3] = b;
      colors[i * 3 + 1] = b;
      colors[i * 3 + 2] = b;
    }

    const make = (index: number[]) => {
      const g = new BufferGeometry();
      g.setAttribute("position", new Float32BufferAttribute(positions, 3));
      g.setAttribute("color", new Float32BufferAttribute(colors, 3));
      g.setIndex(index);
      return g;
    };

    return { tess: make(TESSELATION_INDEX), contour: make(CONTOURS_INDEX) };
  }, [obj.shape, obj.faceMesh, obj.faceShade]);

  // Iris-center landmarks (MediaPipe 468 / 473 = the pupils) for the glowing
  // eyes — only when this is a selfie carrying the full 478-point mesh.
  const eyePositions = useMemo(() => {
    const fm = obj.faceMesh;
    if (obj.shape !== "selfie" || !fm || fm.length < 478 * 3) return null;
    const at = (i: number): [number, number, number] => [
      fm[i * 3],
      fm[i * 3 + 1],
      fm[i * 3 + 2],
    ];
    return { left: at(468), right: at(473) };
  }, [obj.shape, obj.faceMesh]);

  // Dispose both face layers on swap/unmount to avoid GPU buffer leaks.
  useEffect(() => {
    return () => {
      faceGeometry?.tess.dispose();
      faceGeometry?.contour.dispose();
    };
  }, [faceGeometry]);

  // Dispose the eye material on unmount (geometry is shared/module-level).
  useEffect(() => () => eyeMat.dispose(), [eyeMat]);

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

  if (obj.shape === "selfie") {
    // Awaiting upload: render nothing rather than fall through to a
    // missing-geometry crash.
    if (!faceGeometry) return null;
    // Rotation is driven entirely by useFrame (yaw sway); start face-on
    // rather than using the random per-session rotation.
    return (
      <group
        ref={groupRef}
        position={[obj.position.x, obj.position.y, obj.position.z]}
        rotation={[0, 0, 0]}
      >
        <lineSegments geometry={faceGeometry.tess}>
          <lineBasicMaterial
            color={obj.color}
            vertexColors
            transparent
            opacity={0.28}
          />
        </lineSegments>
        <lineSegments geometry={faceGeometry.contour}>
          <lineBasicMaterial
            ref={matRef}
            color={obj.color}
            vertexColors
            transparent
            opacity={0.95}
          />
        </lineSegments>
        {eyePositions && (
          <>
            <mesh
              ref={leftEyeRef}
              geometry={EYE_GEOMETRY}
              material={eyeMat}
              position={eyePositions.left}
            />
            <mesh
              ref={rightEyeRef}
              geometry={EYE_GEOMETRY}
              material={eyeMat}
              position={eyePositions.right}
            />
          </>
        )}
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

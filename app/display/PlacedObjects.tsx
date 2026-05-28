"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  BufferGeometry,
  Color as ThreeColor,
  Float32BufferAttribute,
  type Group,
  type LineBasicMaterial,
} from "three";
import { useObjects, type WireframeEntry } from "@/hooks/useObjects";
import { MAX_OBJECTS_RENDERED } from "@/lib/presets";
import { edgesByShape } from "@/lib/object-geometries";
import { applyEffect } from "@/lib/effect-runtime";
import { TESSELATION_INDEX, CONTOURS_INDEX } from "@/lib/face-mesh-topology";

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

  // Dispose both layers on swap/unmount to avoid GPU buffer leaks.
  useEffect(() => {
    return () => {
      faceGeometry?.tess.dispose();
      faceGeometry?.contour.dispose();
    };
  }, [faceGeometry]);

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

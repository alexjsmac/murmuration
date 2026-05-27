"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { audioLevel } from "@/hooks/useAudioLevel";

/**
 * Slow autonomous drift + occasional cinematic snap-cuts. Most of the
 * time the camera lerps gently around a drift baseline; every 8-14s OR
 * on a strong detected bass onset, it jumps hard to one of several
 * preset vantage points, holds for ~1.5s, then eases back to drift.
 */

interface CutPreset {
  pos: THREE.Vector3;
  look: THREE.Vector3;
}

const CUT_PRESETS: CutPreset[] = [
  // Low-angle hero shot
  { pos: new THREE.Vector3(0, -0.5, 5.5), look: new THREE.Vector3(0, 1, 0) },
  // Tight close-up from front
  { pos: new THREE.Vector3(0.2, 1.0, 3.8), look: new THREE.Vector3(0, 0.5, 0) },
  // Off-axis tilt right
  { pos: new THREE.Vector3(3.8, 1.5, 4.5), look: new THREE.Vector3(0, 0.5, 0) },
  // Off-axis tilt left
  { pos: new THREE.Vector3(-3.8, 1.5, 4.5), look: new THREE.Vector3(0, 0.5, 0) },
  // High-angle wide
  { pos: new THREE.Vector3(0, 3.5, 7), look: new THREE.Vector3(0, 0, 0) },
  // Dutch angle / canted
  { pos: new THREE.Vector3(2.5, 0.2, 5), look: new THREE.Vector3(-0.5, 0.8, 0) },
];

const CUT_HOLD_MS = 1500;
const MIN_TIME_BETWEEN_CUTS_MS = 6500;

export function CameraRig() {
  const { camera } = useThree();
  const baseY = useRef(camera.position.y);
  const baseZ = useRef(camera.position.z);
  const lookTarget = useRef(new THREE.Vector3(0, 0, 0));

  // Snap-cut state
  const nextCutAt = useRef(performance.now() + 8000 + Math.random() * 6000);
  const cutEndsAt = useRef(0);
  const lastOnsetSeen = useRef(0);
  const cutPreset = useRef<CutPreset | null>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const now = performance.now();

    // Trigger a cut: either scheduled or on a strong bass onset.
    const onsetCut =
      audioLevel.lastBassOnset > lastOnsetSeen.current &&
      audioLevel.bass > 0.55 &&
      now - cutEndsAt.current > MIN_TIME_BETWEEN_CUTS_MS;
    const timerCut = now >= nextCutAt.current;

    if (onsetCut || timerCut) {
      lastOnsetSeen.current = audioLevel.lastBassOnset;
      cutPreset.current =
        CUT_PRESETS[Math.floor(Math.random() * CUT_PRESETS.length)];
      cutEndsAt.current = now + CUT_HOLD_MS;
      nextCutAt.current = now + 8000 + Math.random() * 6000;
    }

    if (now < cutEndsAt.current && cutPreset.current) {
      // In a cut: snap hard to preset (no lerp — that's the "cut" feel).
      const p = cutPreset.current;
      camera.position.copy(p.pos);
      camera.lookAt(p.look);
      return;
    }

    // Drift baseline (post-cut returns to this).
    const driftX = Math.sin(t * 0.07) * 0.6;
    const driftY = Math.cos(t * 0.05) * 0.3;
    camera.position.x = THREE.MathUtils.lerp(
      camera.position.x,
      driftX,
      0.04,
    );
    camera.position.y = THREE.MathUtils.lerp(
      camera.position.y,
      baseY.current + driftY,
      0.04,
    );
    // Recover z toward the hero preset's intended distance (captured at mount).
    camera.position.z = THREE.MathUtils.lerp(
      camera.position.z,
      baseZ.current,
      0.04,
    );

    lookTarget.current.set(
      Math.sin(t * 0.13) * 0.4,
      Math.cos(t * 0.18) * 0.2,
      0,
    );
    camera.lookAt(lookTarget.current);
  });

  return null;
}

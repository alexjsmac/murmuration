"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

export function CameraRig() {
  const { camera } = useThree();
  const baseY = useRef(camera.position.y);
  const lookTarget = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const driftX = Math.sin(t * 0.07) * 0.6;
    const driftY = Math.cos(t * 0.05) * 0.3;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, driftX, 0.02);
    camera.position.y = THREE.MathUtils.lerp(
      camera.position.y,
      baseY.current + driftY,
      0.02,
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

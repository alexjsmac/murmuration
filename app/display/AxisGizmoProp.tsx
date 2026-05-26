"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";

export function AxisGizmoProp() {
  const ref = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.position.x = Math.sin(t * 0.2) * 4;
    ref.current.position.y = Math.cos(t * 0.15) * 1.2 + 0.5;
    ref.current.position.z = Math.cos(t * 0.18) * 2 - 1;
    ref.current.rotation.y = t * 0.3;
    ref.current.rotation.x = t * 0.15;
  });

  return (
    <group ref={ref} scale={1.4}>
      <axesHelper args={[1.2]} />
    </group>
  );
}

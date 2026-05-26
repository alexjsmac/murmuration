"use client";

import { Canvas } from "@react-three/fiber";
import { Grid } from "@react-three/drei";
import { Suspense } from "react";
import { CameraRig } from "./CameraRig";
import { HeroMesh } from "./HeroMesh";
import { AxisGizmoProp } from "./AxisGizmoProp";
import { PlacedObjects } from "./PlacedObjects";
import { Glitchers } from "./Glitchers";
import { PostProcess } from "./PostProcess";
import { ResetController } from "./ResetController";
import { useScene } from "@/hooks/useScene";
import { presetById } from "@/lib/presets";

export function Scene() {
  const scene = useScene();
  const preset = presetById(scene.preset);

  return (
    <Canvas
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      camera={{ position: [0, 1.2, preset.cameraDistance], fov: 45, near: 0.1, far: 100 }}
      dpr={[1, 1.5]}
    >
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" args={["#000000", 10, 30]} />

      <ambientLight intensity={0.25} />
      <directionalLight position={[5, 8, 5]} intensity={0.4} />

      <CameraRig />

      <Grid
        args={[60, 60]}
        position={[0, -1.5, 0]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#ff007a"
        sectionSize={5}
        sectionThickness={1.4}
        sectionColor="#ff3df0"
        infiniteGrid
        fadeDistance={28}
        fadeStrength={1.2}
        followCamera={false}
      />

      <Suspense fallback={null}>
        <HeroMesh kind={preset.hero} />
        <AxisGizmoProp />
        <PlacedObjects />
        <Glitchers />
      </Suspense>

      <PostProcess />
      <ResetController />
    </Canvas>
  );
}

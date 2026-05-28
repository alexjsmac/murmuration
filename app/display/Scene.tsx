"use client";

import { Canvas } from "@react-three/fiber";
import { Grid, Sparkles } from "@react-three/drei";
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
      camera={{
        position: [0, 1.2, preset.cameraDistance],
        fov: 45,
        near: 0.1,
        far: 100,
      }}
      dpr={[1, 1.5]}
    >
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" args={["#000000", preset.fogNear, preset.fogFar]} />

      <ambientLight intensity={0.25} />
      <directionalLight position={[5, 8, 5]} intensity={0.4} />

      <CameraRig />

      {preset.gridColor && (
        <Grid
          args={[60, 60]}
          position={[0, -1.5, 0]}
          cellSize={1}
          cellThickness={0.6}
          cellColor={preset.gridColor}
          sectionSize={5}
          sectionThickness={1.4}
          sectionColor={preset.gridAccent}
          infiniteGrid
          fadeDistance={28}
          fadeStrength={1.2}
          followCamera={false}
        />
      )}

      <Suspense fallback={null}>
        <HeroMesh
          kind={preset.hero}
          color={preset.heroColor}
          morphAmp={preset.morphAmp}
          spinSpeed={preset.heroSpinSpeed}
        />
        {preset.showAxisGizmo && <AxisGizmoProp />}
        <PlacedObjects />
        <Glitchers />
        {/* `key` forces a fresh mount on preset change so the per-vertex
            color buffer drei builds at construction time picks up the new
            sparklesColor. Without this, colors stick to whatever the first
            preset rendered. Bigger size + higher opacity so they read at
            projector scale through bloom + chromatic aberration; otherwise
            the dots disappear into the post-process haze on dense presets. */}
        <Sparkles
          key={preset.id}
          count={preset.sparklesCount}
          scale={[24, 8, 24]}
          size={5}
          speed={0.3}
          color={preset.sparklesColor}
          noise={1.2}
          opacity={0.9}
        />
      </Suspense>

      <PostProcess />
      <ResetController />
    </Canvas>
  );
}

"use client";

import { Canvas } from "@react-three/fiber";
import { Grid } from "@react-three/drei";
import { Suspense } from "react";
import { CameraRig } from "../display/CameraRig";
import { HeroMesh } from "../display/HeroMesh";
import { AxisGizmoProp } from "../display/AxisGizmoProp";
import { PlacedObjects } from "../display/PlacedObjects";
import { Glitchers } from "../display/Glitchers";
import { PostProcess } from "../display/PostProcess";
import { useScene } from "@/hooks/useScene";
import { presetById } from "@/lib/presets";
import { PromoDecor } from "./PromoDecor";
import { PromoBeam } from "./PromoBeam";

export function PromoScene() {
  const scene = useScene();
  const preset = presetById(scene.preset);

  return (
    <Canvas
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      }}
      camera={{
        position: [0, 1.0, preset.cameraDistance * 0.9],
        fov: 38,
        near: 0.1,
        far: 100,
      }}
      dpr={[1, 2]}
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
        <HeroMesh
          kind={preset.hero}
          color={preset.heroColor}
          morphAmp={preset.morphAmp}
          spinSpeed={preset.heroSpinSpeed}
        />
        <AxisGizmoProp />
        <PromoDecor />
        <PromoBeam />
        <PlacedObjects />
        <Glitchers />
      </Suspense>

      <PostProcess />
    </Canvas>
  );
}

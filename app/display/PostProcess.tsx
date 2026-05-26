"use client";

import {
  EffectComposer,
  ChromaticAberration,
  Scanline,
  Vignette,
  Glitch,
} from "@react-three/postprocessing";
import { GlitchMode } from "postprocessing";
import { Vector2 } from "three";
import { useMemo } from "react";
import { useGlitchers } from "@/hooks/useGlitchers";
import { useScene } from "@/hooks/useScene";

export function PostProcess() {
  const glitchers = useGlitchers();
  const scene = useScene();

  const intensity = useMemo(() => {
    const sum = glitchers.reduce((acc, g) => acc + g.intensity, 0);
    return Math.min(1, sum * 0.18 + scene.globalIntensity * 0.6);
  }, [glitchers, scene.globalIntensity]);

  const chromaOffset = useMemo(
    () => new Vector2(0.0008 + intensity * 0.012, 0),
    [intensity],
  );

  const glitchStrength = useMemo(
    () => new Vector2(0.02, 0.05 + intensity * 0.4),
    [intensity],
  );

  const glitchDelay = useMemo(() => new Vector2(6, 14), []);
  const glitchDuration = useMemo(() => new Vector2(0.1, 0.3), []);

  return (
    <EffectComposer>
      <ChromaticAberration offset={chromaOffset} radialModulation={false} modulationOffset={0} />
      <Scanline density={1.6} opacity={0.06 + intensity * 0.1} />
      <Glitch
        delay={glitchDelay}
        duration={glitchDuration}
        strength={glitchStrength}
        mode={GlitchMode.SPORADIC}
        active
        ratio={0.4}
      />
      <Vignette eskil={false} offset={0.2} darkness={0.85} />
    </EffectComposer>
  );
}

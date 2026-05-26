import type { Color as ThreeColor, Group, LineBasicMaterial } from "three";
import type { Effect } from "./types";

interface ApplyEffectArgs {
  group: Group;
  material: LineBasicMaterial | null;
  baseColor: ThreeColor;
  basePosition: { x: number; y: number; z: number };
  effect: Effect | undefined;
  seed: number;
  t: number;
}

export function applyEffect({
  group,
  material,
  baseColor,
  basePosition,
  effect,
  seed,
  t,
}: ApplyEffectArgs): void {
  // Reset to base each frame so effects are isolated.
  group.scale.setScalar(1);
  group.position.set(basePosition.x, basePosition.y, basePosition.z);
  if (material) {
    material.opacity = 0.95;
    material.color.copy(baseColor);
  }

  switch (effect) {
    case "pulse": {
      const s = 1 + Math.sin(t * 1.6 + seed) * 0.28;
      group.scale.setScalar(s);
      break;
    }
    case "colorPulse": {
      if (material) {
        // Modulate brightness via scalar multiply on the color, plus an
        // opacity dip so the pulse reads strongly through the glitch pass.
        const k = 0.55 + 0.45 * Math.sin(t * 2.2 + seed);
        material.color.copy(baseColor).multiplyScalar(0.4 + 1.4 * k);
        material.opacity = 0.55 + 0.4 * k;
      }
      break;
    }
    case "drift": {
      group.position.x = basePosition.x + Math.sin(t * 0.55 + seed) * 0.45;
      group.position.y = basePosition.y + Math.cos(t * 0.43 + seed) * 0.3;
      group.position.z = basePosition.z + Math.sin(t * 0.61 + seed) * 0.4;
      break;
    }
    case "glitchJitter": {
      // Period 2.5s, 0.18s active. Use deterministic per-cycle noise so each
      // object's fracture reads as discrete jumps.
      const period = 2.5;
      const phase = (t + seed) % period;
      if (phase < 0.18) {
        const cycleIdx = Math.floor((t + seed) / period);
        const r1 = Math.sin(seed * 5.7 + cycleIdx * 13.31);
        const r2 = Math.sin(seed * 9.13 + cycleIdx * 17.77);
        const r3 = Math.sin(seed * 12.5 + cycleIdx * 21.11);
        group.position.x = basePosition.x + r1 * 0.45;
        group.position.y = basePosition.y + r2 * 0.3;
        group.position.z = basePosition.z + r3 * 0.45;
      }
      break;
    }
    case "still":
    default:
      break;
  }
}

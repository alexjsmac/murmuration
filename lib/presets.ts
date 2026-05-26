export type HeroKind = "head" | "ico" | "torus" | "abstract";

export interface Preset {
  id: string;
  label: string;
  hero: HeroKind;
  cameraDistance: number;
}

export const PRESETS: Preset[] = [
  { id: "head_v1", label: "HEAD", hero: "head", cameraDistance: 7 },
  { id: "ico_v1", label: "ICO", hero: "ico", cameraDistance: 6 },
  { id: "torus_v1", label: "TORUS", hero: "torus", cameraDistance: 6.5 },
  { id: "abstract_v1", label: "ABSTRACT", hero: "abstract", cameraDistance: 7 },
];

export const ROUND_DURATION_MS = 4 * 60 * 1000;

export const PLACE_THROTTLE_MS = 2000;
export const GLITCHER_THROTTLE_MS = 60;
export const MAX_OBJECTS_RENDERED = 200;
export const MAX_GLITCHERS_RENDERED = 50;

export function presetById(id: string): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}

export function nextPresetId(currentId: string): string {
  const idx = PRESETS.findIndex((p) => p.id === currentId);
  const next = (idx + 1) % PRESETS.length;
  return PRESETS[next].id;
}

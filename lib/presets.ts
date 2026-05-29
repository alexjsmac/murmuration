export type HeroKind =
  | "head"
  | "ico"
  | "torus"
  | "abstract"
  | "spiral"
  | "lattice";

/**
 * A scene preset is a full visual identity: hero geometry, color palette
 * across hero/grid/sparkles/fog, camera framing, motion settings. Each
 * round (preset rotation) swaps a new "world" rather than just a new
 * sculpture on the same stage.
 */
export interface Preset {
  id: string;
  label: string;
  hero: HeroKind;
  heroColor: string;
  cameraDistance: number;
  /** Magenta primary grid lines; null hides the grid entirely. */
  gridColor: string | null;
  /** Brighter section grid lines (every 5 cells). */
  gridAccent: string;
  sparklesColor: string;
  sparklesCount: number;
  /** Tighter [near,far] = more enclosed/atmospheric. Default [10,30]. */
  fogNear: number;
  fogFar: number;
  /** Hero vertex-morph amplitude. Default 0.13. */
  morphAmp: number;
  /** Hero base spin speed (rad/s before audio acceleration). */
  heroSpinSpeed: number;
  /** Optional toggle for the drifting axis gizmo prop. */
  showAxisGizmo: boolean;
}

export const PRESETS: Preset[] = [
  {
    // The iconic flyer look — magenta spiked head on magenta grid.
    id: "head_v1",
    label: "HEAD",
    hero: "head",
    heroColor: "#ff007a",
    cameraDistance: 7,
    gridColor: "#ff007a",
    gridAccent: "#ff3df0",
    sparklesColor: "#ff3df0",
    sparklesCount: 140,
    fogNear: 10,
    fogFar: 30,
    morphAmp: 0.13,
    heroSpinSpeed: 0.18,
    showAxisGizmo: true,
  },
  {
    // Tron-cool: cyan ico over cyan grid, tighter framing.
    id: "ico_v1",
    label: "ICO",
    hero: "ico",
    heroColor: "#00f0ff",
    cameraDistance: 6,
    gridColor: "#00f0ff",
    gridAccent: "#aaffff",
    sparklesColor: "#00f0ff",
    sparklesCount: 100,
    fogNear: 8,
    fogFar: 26,
    morphAmp: 0.18,
    heroSpinSpeed: 0.22,
    showAxisGizmo: true,
  },
  {
    // Liquid / orbital — hot pink hero spinning over hot pink grid, yellow sparkles.
    id: "torus_v1",
    label: "TORUS",
    hero: "torus",
    heroColor: "#ff3df0",
    cameraDistance: 6.5,
    gridColor: "#ff3df0",
    gridAccent: "#ff007a",
    sparklesColor: "#f5ff00",
    sparklesCount: 160,
    fogNear: 10,
    fogFar: 28,
    morphAmp: 0.08,
    heroSpinSpeed: 0.45,
    showAxisGizmo: true,
  },
  {
    // Nuclear / alien — chartreuse everything, claustrophobic fog.
    id: "abstract_v1",
    label: "ABSTRACT",
    hero: "abstract",
    heroColor: "#aaff00",
    cameraDistance: 7,
    gridColor: "#aaff00",
    gridAccent: "#f5ff00",
    sparklesColor: "#aaff00",
    sparklesCount: 90,
    fogNear: 6,
    fogFar: 18,
    morphAmp: 0.16,
    heroSpinSpeed: 0.15,
    showAxisGizmo: false,
  },
  {
    // Vortex — magenta spiral over cyan grid (cross-color tension).
    id: "spiral_v1",
    label: "SPIRAL",
    hero: "spiral",
    heroColor: "#ff007a",
    cameraDistance: 7,
    gridColor: "#00f0ff",
    gridAccent: "#aaffff",
    sparklesColor: "#ffffff",
    sparklesCount: 130,
    fogNear: 10,
    fogFar: 30,
    morphAmp: 0.06,
    heroSpinSpeed: 0.55,
    showAxisGizmo: true,
  },
  {
    // Zero-gravity void — white lattice in pure black, no grid, less atmosphere.
    id: "lattice_v1",
    label: "LATTICE",
    hero: "lattice",
    heroColor: "#ffffff",
    cameraDistance: 7.5,
    gridColor: null,
    gridAccent: "#ffffff",
    sparklesColor: "#ffffff",
    sparklesCount: 60,
    fogNear: 12,
    fogFar: 35,
    morphAmp: 0.08,
    heroSpinSpeed: 0.12,
    showAxisGizmo: false,
  },
];

export const ROUND_DURATION_MS = 4 * 60 * 1000;

export const PLACE_THROTTLE_MS = 2000;
export const GLITCHER_THROTTLE_MS = 60;
export const MAX_OBJECTS_RENDERED = 200;
// (Glitcher beam count is now the admin-tunable SceneState.maxGlitchers.)

export function presetById(id: string): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}

export function nextPresetId(currentId: string): string {
  const idx = PRESETS.findIndex((p) => p.id === currentId);
  const next = (idx + 1) % PRESETS.length;
  return PRESETS[next].id;
}

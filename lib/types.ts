export type Mode = "placer" | "glitcher";

export type Shape =
  | "cube"
  | "ico"
  | "head"
  | "cone"
  | "axisGizmo"
  | "selfie";

/** Standard geometric shapes that show in the 5-column picker row. */
export const GEOMETRIC_SHAPES: Shape[] = [
  "cube",
  "ico",
  "head",
  "cone",
  "axisGizmo",
];

/** All shapes including the user-uploaded "selfie" variant. */
export const SHAPES: Shape[] = [...GEOMETRIC_SHAPES, "selfie"];

export const SHAPE_LABELS: Record<Shape, string> = {
  cube: "CUBE",
  ico: "ICO",
  head: "HEAD",
  cone: "CONE",
  axisGizmo: "AXIS",
  selfie: "SELFIE",
};

export type Effect =
  | "still"
  | "pulse"
  | "colorPulse"
  | "drift"
  | "glitchJitter";

export const EFFECTS: Effect[] = [
  "still",
  "pulse",
  "colorPulse",
  "drift",
  "glitchJitter",
];

export const EFFECT_LABELS: Record<Effect, string> = {
  still: "STILL",
  pulse: "PULSE",
  colorPulse: "COLOR",
  drift: "DRIFT",
  glitchJitter: "GLITCH",
};

export type Color = string;

export const PALETTE: Color[] = [
  "#ff007a",
  "#00f0ff",
  "#f5ff00",
  "#aaff00",
  "#ff3df0",
  "#ffffff",
];

export interface Position3 {
  x: number;
  y: number;
  z: number;
}

export interface Position2 {
  x: number;
  y: number;
}

/**
 * A user's wireframe contribution. Keyed in RTDB by sessionId — one per
 * connected Placer user. shape/color/effect customized via pickers,
 * position updated live from the drag pad. `dragging` is true while the
 * user's finger is on the pad — display uses it to skip idle drift so
 * the object follows the finger precisely.
 */
export interface Wireframe {
  shape: Shape;
  position: Position3;
  rotation: Position3;
  color: Color;
  effect: Effect;
  dragging?: boolean;
  /**
   * Flat array of [x,y,z,x,y,z,...] for shape="selfie" — 478 MediaPipe
   * Face Landmarker points, normalized into scene space on the phone. The
   * display builds an indexed LineSegments from the bundled face topology
   * (lib/face-mesh-topology.ts), giving the wireframe real 3D depth.
   */
  faceMesh?: number[];
  joinedAt: number;
}

export interface Glitcher {
  position: Position2;
  intensity: number;
  hue: Color;
  lastSeen: number;
}

export interface Connection {
  mode: Mode;
  joinedAt: number;
}

export interface SceneState {
  preset: string;
  resetAt: number;
  presetSwitchAt: number;
  globalIntensity: number;
  audioGain: number;
  pause: boolean;
}

export const DEFAULT_SCENE_STATE: SceneState = {
  preset: "head_v1",
  resetAt: 0,
  presetSwitchAt: 0,
  globalIntensity: 0.4,
  audioGain: 1.0,
  pause: false,
};

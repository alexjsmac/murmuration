export type Mode = "placer" | "glitcher";

export type Shape = "cube" | "ico" | "head" | "cone" | "axisGizmo";

export const SHAPES: Shape[] = ["cube", "ico", "head", "cone", "axisGizmo"];

export const SHAPE_LABELS: Record<Shape, string> = {
  cube: "CUBE",
  ico: "ICO",
  head: "HEAD",
  cone: "CONE",
  axisGizmo: "AXIS",
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

export interface PlacedObject {
  sessionId: string;
  shape: Shape;
  position: Position3;
  rotation: Position3;
  color: Color;
  effect?: Effect;
  placedAt: number;
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
  pause: boolean;
}

export const DEFAULT_SCENE_STATE: SceneState = {
  preset: "head_v1",
  resetAt: 0,
  presetSwitchAt: 0,
  globalIntensity: 0.4,
  pause: false,
};

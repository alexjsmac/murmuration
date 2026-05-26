import { BufferAttribute, type BufferGeometry } from "three";

/**
 * Per-line color animation for wireframe geometries.
 *
 * On a bass-drum onset, individual line segments flash to randomized
 * palette colors. Between onsets, colors decay back toward white so the
 * material's base color (which is multiplied with the vertex color) shows
 * through again.
 *
 * Geometries share their `color` attribute when shared across instances —
 * that means all instances of a given shape flash in sync, which reads as
 * a unified shockwave per kick rather than chaos.
 */

// Normalized 0..1 RGB for each palette swatch — matches PALETTE in lib/types.ts.
const FLASH_PALETTE: ReadonlyArray<readonly [number, number, number]> = [
  [1.0, 0.0, 0.48],
  [0.0, 0.94, 1.0],
  [0.96, 1.0, 0.0],
  [0.67, 1.0, 0.0],
  [1.0, 0.24, 0.94],
  [1.0, 1.0, 1.0],
];

/**
 * Attach a white-filled per-vertex color attribute to a geometry. With
 * vertexColors:true on the material, white vertex colors multiply through
 * to the material's base color (no visual change), so this is safe to
 * apply at module load to all shared geometries.
 */
export function attachWhiteColors(geom: BufferGeometry): void {
  if (geom.attributes.color) return;
  const count = geom.attributes.position?.count ?? 0;
  if (count === 0) return;
  const colors = new Float32Array(count * 3);
  colors.fill(1);
  geom.setAttribute("color", new BufferAttribute(colors, 3));
}

/**
 * Randomize per-line colors using the flash palette. Both vertices of each
 * line segment get the same color so the line reads as a single color
 * rather than gradient.
 */
export function flashLineColors(geom: BufferGeometry): void {
  const attr = geom.attributes.color;
  if (!attr) return;
  const arr = attr.array as Float32Array;
  const vertexCount = attr.count;
  // Edges geometries store one segment per pair of vertices.
  for (let i = 0; i < vertexCount; i += 2) {
    const c = FLASH_PALETTE[Math.floor(Math.random() * FLASH_PALETTE.length)];
    const a = i * 3;
    const b = a + 3;
    arr[a] = c[0];
    arr[a + 1] = c[1];
    arr[a + 2] = c[2];
    arr[b] = c[0];
    arr[b + 1] = c[1];
    arr[b + 2] = c[2];
  }
  attr.needsUpdate = true;
}

/**
 * Lerp every channel of every vertex toward white. `factor` is per-frame
 * decay rate; ~0.07 gives a roughly 0.5s decay tail at 60fps.
 */
export function decayLineColors(
  geom: BufferGeometry,
  factor: number,
): void {
  const attr = geom.attributes.color;
  if (!attr) return;
  const arr = attr.array as Float32Array;
  let dirty = false;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (v < 0.999) {
      arr[i] = v + (1 - v) * factor;
      dirty = true;
    }
  }
  if (dirty) attr.needsUpdate = true;
}

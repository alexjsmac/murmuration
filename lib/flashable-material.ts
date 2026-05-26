import type { LineBasicMaterial, MeshBasicMaterial } from "three";

/**
 * Replace the default `diffuseColor *= vColor` blend with a saturation-aware
 * mix so per-line bass-onset flash overlays the base color cleanly instead
 * of multiplicatively masking it.
 *
 * - Idle vertex color (1,1,1) → no contribution; base color renders pure.
 * - Saturated palette vertex color → mix toward the vertex hue, but capped
 *   so the base color still bleeds through (max 85% replacement).
 * - White materials specifically stop reading "green" or "magenta" between
 *   bass kicks because the idle vertex value cleanly contributes zero.
 *
 * Call once on a material instance (after mount via a matRef + useEffect).
 * Sets needsUpdate so the next render compiles the new shader.
 */
export function makeFlashable(
  mat: LineBasicMaterial | MeshBasicMaterial,
): void {
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `
        // Saturation distance: 0 for white vertex (idle), ~1 for saturated palette.
        // 1.732 = sqrt(3) so we normalize the longest possible distance to 1.
        float chromaDist = length(vColor.rgb - vec3(1.0)) / 1.732;
        float flashStrength = clamp(chromaDist * 1.2, 0.0, 0.85);

        // Screen blend: 1 - (1-a)*(1-b). White materials are invariant under
        // screen (1 stays at 1), so picking #ffffff in the palette renders
        // faithfully forever regardless of bass flashes. Colored materials
        // still flash visibly by brightening toward the flash hue.
        vec3 screened = vec3(1.0) - (vec3(1.0) - diffuseColor.rgb) * (vec3(1.0) - vColor.rgb);
        diffuseColor.rgb = mix(diffuseColor.rgb, screened, flashStrength);
      `,
    );
  };
  mat.needsUpdate = true;
}

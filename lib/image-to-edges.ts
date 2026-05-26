/**
 * Client-side image → wireframe-segment extraction.
 *
 * Pipeline: decode image → downscale to a small grid → grayscale → Sobel
 * edge detection → threshold → emit line segments between adjacent
 * above-threshold pixels (horizontal + vertical neighbors). The result
 * is a flat array of position triplets suitable to construct a
 * THREE.BufferGeometry directly.
 *
 * Returns segments centered around origin and scaled to roughly fit a
 * 1.5×1.5 area, sitting on the XY plane (z = 0).
 */

const TARGET_SIZE = 72; // px per axis, post-downscale
const EDGE_THRESHOLD = 95; // 0..~1000 (sobel magnitude). Higher = sparser.
const MAX_SEGMENTS = 600; // hard cap; randomly sampled down if exceeded.
const SCENE_SCALE = 1.6;

export async function extractEdgeSegments(file: File): Promise<number[]> {
  const bitmap = await createImageBitmap(file);

  // Downscale onto a small canvas. Square crop centered so portraits and
  // landscapes both work.
  const minDim = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - minDim) / 2;
  const sy = (bitmap.height - minDim) / 2;

  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(TARGET_SIZE, TARGET_SIZE)
      : (() => {
          const c = document.createElement("canvas");
          c.width = TARGET_SIZE;
          c.height = TARGET_SIZE;
          return c;
        })();

  const ctx = (canvas as HTMLCanvasElement | OffscreenCanvas).getContext(
    "2d",
  ) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not create 2D canvas context");
  }

  ctx.drawImage(
    bitmap,
    sx,
    sy,
    minDim,
    minDim,
    0,
    0,
    TARGET_SIZE,
    TARGET_SIZE,
  );
  bitmap.close();

  const imgData = ctx.getImageData(0, 0, TARGET_SIZE, TARGET_SIZE);
  return sobelToSegments(imgData);
}

function sobelToSegments(imgData: ImageData): number[] {
  const { width: w, height: h, data: px } = imgData;

  // Grayscale (luma weights)
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = px[i * 4];
    const g = px[i * 4 + 1];
    const b = px[i * 4 + 2];
    gray[i] = r * 0.299 + g * 0.587 + b * 0.114;
  }

  // Sobel gradient magnitude
  const edges = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -gray[i - w - 1] +
        gray[i - w + 1] +
        -2 * gray[i - 1] +
        2 * gray[i + 1] +
        -gray[i + w - 1] +
        gray[i + w + 1];
      const gy =
        -gray[i - w - 1] -
        2 * gray[i - w] -
        gray[i - w + 1] +
        gray[i + w - 1] +
        2 * gray[i + w] +
        gray[i + w + 1];
      edges[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  // Walk edge pixels; emit segments to right/down neighbors that are also
  // above threshold. Each such pair becomes a line in the final mesh.
  const segments: number[] = [];
  const toScene = (px: number, total: number) =>
    ((px - total / 2) / total) * SCENE_SCALE;

  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = y * w + x;
      if (edges[i] < EDGE_THRESHOLD) continue;

      const sx0 = toScene(x, w);
      const sy0 = -toScene(y, h); // image y goes down; scene y goes up

      if (edges[i + 1] >= EDGE_THRESHOLD) {
        const sx1 = toScene(x + 1, w);
        segments.push(sx0, sy0, 0, sx1, sy0, 0);
      }
      if (edges[i + w] >= EDGE_THRESHOLD) {
        const sy1 = -toScene(y + 1, h);
        segments.push(sx0, sy0, 0, sx0, sy1, 0);
      }
    }
  }

  // Cap with deterministic stride sampling so dense-edge photos don't
  // blow out RTDB write size.
  const segCount = segments.length / 6;
  if (segCount > MAX_SEGMENTS) {
    const stride = Math.ceil(segCount / MAX_SEGMENTS);
    const out: number[] = [];
    for (let s = 0; s < segCount; s += stride) {
      const o = s * 6;
      out.push(
        segments[o],
        segments[o + 1],
        segments[o + 2],
        segments[o + 3],
        segments[o + 4],
        segments[o + 5],
      );
    }
    return out;
  }
  return segments;
}

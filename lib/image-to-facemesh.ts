import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// Faces are a hero element — bigger than the standard geometric shapes.
const FACE_SCALE = 2.2;
// Depth amplification so relief (nose/cheeks) reads through the bloom stack.
const Z_GAIN = 1.6;
// Phone photos are huge (often 12 MP) and frequently HEIC. We decode through an
// <img> and downscale to this max dimension before inference — ample detail for
// 478 landmarks, far lighter on phone memory than detecting on the full bitmap.
const MAX_DETECT_DIM = 1280;

// The MediaPipe runtime + model (~7 MB) is created once and reused across
// re-uploads. wasm and model are self-hosted under public/mediapipe (copied
// in at build/deploy time) so there's no CDN dependency at the venue.
let landmarkerPromise: Promise<FaceLandmarker> | null = null;

function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: "/mediapipe/face_landmarker.task" },
        runningMode: "IMAGE",
        numFaces: 1,
      });
    })();
  }
  return landmarkerPromise;
}

/**
 * MediaPipe's TFLite backend prints benign progress lines such as
 * "INFO: Created TensorFlow Lite XNNPACK delegate for CPU." to stderr, which
 * Emscripten routes to console.error. In Next dev that pops the red error
 * overlay as if detection had failed (it didn't — detect() returns normally).
 * Run `fn` with those INFO lines filtered out; any real console.error still
 * passes through.
 */
async function silencingTfliteInfo<T>(fn: () => T | Promise<T>): Promise<T> {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].startsWith("INFO:")) return;
    original(...args);
  };
  try {
    return await fn();
  } finally {
    console.error = original;
  }
}

/**
 * Decode an uploaded image into a downscaled canvas for inference. Decoding via
 * an <img> element (rather than createImageBitmap) is the most compatible path
 * on phones — notably iOS Safari, which can decode HEIC camera captures in an
 * <img> but NOT via createImageBitmap. The browser applies EXIF orientation
 * when rendering the <img>, so portrait selfies aren't detected sideways.
 */
async function fileToCanvas(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(
      1,
      MAX_DETECT_DIM / Math.max(img.naturalWidth, img.naturalHeight),
    );
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get a 2D canvas context");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Run MediaPipe Face Landmarker on a captured selfie and return the 478
 * landmarks (flat [x, y, z, ...] in scene space) plus a parallel per-vertex
 * luminance array (0..1) sampled from the photo, or null when no face is
 * detected. Only these abstract values leave the phone — the 3D coordinates
 * and a coarse 478-point grayscale — never the image itself, which is neither
 * uploaded nor stored.
 */
export async function extractFaceMesh(
  file: File,
): Promise<{ points: number[]; shade: number[] } | null> {
  const landmarker = await silencingTfliteInfo(() => getLandmarker());
  const canvas = await fileToCanvas(file);
  const landmarks = await silencingTfliteInfo(
    () => landmarker.detect(canvas).faceLandmarks?.[0],
  );
  if (!landmarks || landmarks.length === 0) return null;

  // Sample the (downscaled) selfie's luminance at each landmark so the display
  // can shade the mesh with the face's real light/shadow. landmark x/y are
  // 0..1, mapping straight onto the canvas; sampled on the raw coords since
  // luminance is orientation-independent.
  const w = canvas.width;
  const h = canvas.height;
  const pixels = canvas.getContext("2d")?.getImageData(0, 0, w, h).data;

  // Recenter on the face centroid so it sits at the object's local origin.
  const n = landmarks.length;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const p of landmarks) {
    cx += p.x;
    cy += p.y;
    cz += p.z;
  }
  cx /= n;
  cy /= n;
  cz /= n;

  const points: number[] = [];
  const shade: number[] = [];
  for (const p of landmarks) {
    points.push(
      -(p.x - cx) * FACE_SCALE, // mirror X for a natural selfie
      -(p.y - cy) * FACE_SCALE, // flip Y: image-down → scene-up
      (p.z - cz) * FACE_SCALE * Z_GAIN, // amplified depth
    );

    let luma = 1;
    if (pixels) {
      const px = Math.min(w - 1, Math.max(0, Math.round(p.x * (w - 1))));
      const py = Math.min(h - 1, Math.max(0, Math.round(p.y * (h - 1))));
      const i = (py * w + px) * 4;
      luma =
        (0.2126 * pixels[i] +
          0.7152 * pixels[i + 1] +
          0.0722 * pixels[i + 2]) /
        255;
    }
    shade.push(Math.round(luma * 1000) / 1000);
  }
  return { points, shade };
}

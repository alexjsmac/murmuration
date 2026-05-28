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
 * landmarks as a flat [x, y, z, ...] array in scene space, or null when no
 * face is detected. Only these abstract coordinates ever leave the phone —
 * the photo itself is never uploaded or stored.
 */
export async function extractFaceMesh(file: File): Promise<number[] | null> {
  const landmarker = await silencingTfliteInfo(() => getLandmarker());
  const canvas = await fileToCanvas(file);
  const landmarks = await silencingTfliteInfo(
    () => landmarker.detect(canvas).faceLandmarks?.[0],
  );
  if (!landmarks || landmarks.length === 0) return null;

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

  const out: number[] = [];
  for (const p of landmarks) {
    out.push(
      -(p.x - cx) * FACE_SCALE, // mirror X for a natural selfie
      -(p.y - cy) * FACE_SCALE, // flip Y: image-down → scene-up
      (p.z - cz) * FACE_SCALE * Z_GAIN, // amplified depth
    );
  }
  return out;
}

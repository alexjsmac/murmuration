import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// Faces are a hero element — bigger than the standard geometric shapes.
const FACE_SCALE = 2.2;
// Depth amplification so relief (nose/cheeks) reads through the bloom stack.
const Z_GAIN = 1.6;

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
 * Run MediaPipe Face Landmarker on a captured selfie and return the 478
 * landmarks as a flat [x, y, z, ...] array in scene space, or null when no
 * face is detected. Only these abstract coordinates ever leave the phone —
 * the photo itself is never uploaded or stored.
 */
export async function extractFaceMesh(file: File): Promise<number[] | null> {
  const landmarker = await silencingTfliteInfo(() => getLandmarker());
  // "from-image" applies EXIF orientation so portrait phone photos aren't
  // detected sideways.
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });

  let landmarks;
  try {
    landmarks = await silencingTfliteInfo(
      () => landmarker.detect(bitmap).faceLandmarks?.[0],
    );
  } finally {
    bitmap.close();
  }
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

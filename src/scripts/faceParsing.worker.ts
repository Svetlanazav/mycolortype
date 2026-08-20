/**
 * Web Worker hosting the Xenova/face-parsing model (SegFormer, CelebAMask-HQ).
 *
 * Inference is ONNX-on-WASM and takes ~8s per image. Running it on the main
 * thread froze the whole page for that entire time, so it lives here instead:
 * the main thread stays responsive and can paint loading states while this
 * worker chews through the model.
 *
 * The worker receives the already-rendered pixels (RGBA buffer, transferred)
 * plus a JPEG data URL for the model input, and returns dominant colors for
 * skin, hair, lips and brows.
 *
 * Iris is intentionally NOT handled here — face-parsing eye masks include
 * the full eye opening (iris + sclera). Use MediaPipe iris landmarks instead.
 */

import { pipeline } from "@huggingface/transformers";

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface Lab {
  l: number;
  a: number;
  b: number;
}

export interface FaceParsingColors {
  skin: RGB;
  hair: RGB;
  lips: RGB;
  brows: RGB;
}

// ── Worker message protocol ────────────────────────────────────────────────

export type FaceParsingRequest =
  | { type: "load" }
  | {
      type: "analyze";
      id: number;
      dataUrl: string;
      buffer: ArrayBuffer;
      width: number;
      height: number;
    };

export type FaceParsingResponse =
  | { type: "loaded" }
  | { type: "loadError"; message: string }
  | { type: "result"; id: number; colors: FaceParsingColors }
  | { type: "analyzeError"; id: number; message: string };

interface WorkerScope {
  postMessage(message: FaceParsingResponse): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<FaceParsingRequest>) => void,
  ): void;
}

const ctx = self as unknown as WorkerScope;

// ── Types for the pipeline output ──────────────────────────────────────────

interface SegMask {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

interface SegItem {
  label: string;
  score: number;
  mask: SegMask;
}

/** Minimal view of the pixel data we sample colors from. */
interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

// Lazily-loaded singleton — model downloads once, then stays in browser cache
let pipelineInstance: ((input: string) => Promise<SegItem[]>) | null = null;
let loadPromise: Promise<void> | null = null;

function load(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const pipe = await pipeline("image-segmentation", "Xenova/face-parsing");
    pipelineInstance = pipe as unknown as (input: string) => Promise<SegItem[]>;
  })();
  return loadPromise;
}

// ── Color-space utilities ──────────────────────────────────────────────────

function rgbToHsv(r: number, g: number, b: number): { s: number; v: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  return {
    s: max === 0 ? 0 : ((max - min) / max) * 255,
    v: max * 255,
  };
}

function rgbToLab(r: number, g: number, b: number): Lab {
  let rn = r / 255, gn = g / 255, bn = b / 255;
  rn = rn > 0.04045 ? Math.pow((rn + 0.055) / 1.055, 2.4) : rn / 12.92;
  gn = gn > 0.04045 ? Math.pow((gn + 0.055) / 1.055, 2.4) : gn / 12.92;
  bn = bn > 0.04045 ? Math.pow((bn + 0.055) / 1.055, 2.4) : bn / 12.92;
  const xr = (rn * 0.4124 + gn * 0.3576 + bn * 0.1805) * 100 / 95.047;
  const yr = (rn * 0.2126 + gn * 0.7152 + bn * 0.0722);
  const zr = (rn * 0.0193 + gn * 0.1192 + bn * 0.9505) * 100 / 108.883;
  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  return {
    l: 116 * f(yr) - 16,
    a: 500 * (f(xr) - f(yr)),
    b: 200 * (f(yr) - f(zr)),
  };
}

function labToRgb(lab: Lab): RGB {
  const fy = (lab.l + 16) / 116;
  const fx = lab.a / 500 + fy;
  const fz = fy - lab.b / 200;
  const cube = (v: number) => (v ** 3 > 0.008856 ? v ** 3 : (v - 16 / 116) / 7.787);
  const x = cube(fx) * 95.047;
  const y = cube(fy) * 100.0;
  const z = cube(fz) * 108.883;
  const toSrgb = (c: number) =>
    c > 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : 12.92 * c;
  return {
    r: Math.round(Math.max(0, Math.min(255, toSrgb(x / 100 * 3.2406 - y / 100 * 1.5372 - z / 100 * 0.4986) * 255))),
    g: Math.round(Math.max(0, Math.min(255, toSrgb(-x / 100 * 0.9689 + y / 100 * 1.8758 + z / 100 * 0.0415) * 255))),
    b: Math.round(Math.max(0, Math.min(255, toSrgb(x / 100 * 0.0557 - y / 100 * 0.2040 + z / 100 * 1.0570) * 255))),
  };
}

// ── K-means in LAB space ───────────────────────────────────────────────────

function kMeansLab(pixels: Lab[], k: number, maxIter = 10): Lab[] {
  if (pixels.length === 0) return [];
  const n = Math.min(k, pixels.length);
  const step = Math.max(1, Math.floor(pixels.length / n));
  const centers: Lab[] = Array.from({ length: n }, (_, i) => ({
    ...pixels[Math.min(i * step, pixels.length - 1)]!,
  }));
  const assignments = new Int32Array(pixels.length);

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (let i = 0; i < pixels.length; i++) {
      const px = pixels[i]!;
      let minD = Infinity, best = 0;
      for (let j = 0; j < n; j++) {
        const c = centers[j]!;
        const d = (px.l - c.l) ** 2 + (px.a - c.a) ** 2 + (px.b - c.b) ** 2;
        if (d < minD) { minD = d; best = j; }
      }
      if (assignments[i] !== best) { assignments[i] = best; changed = true; }
    }
    if (!changed) break;

    const sums = Array.from({ length: n }, () => ({ l: 0, a: 0, b: 0, count: 0 }));
    for (let i = 0; i < pixels.length; i++) {
      const px = pixels[i]!;
      const s = sums[assignments[i]!]!;
      s.l += px.l; s.a += px.a; s.b += px.b; s.count++;
    }
    for (let j = 0; j < n; j++) {
      const s = sums[j]!;
      if (s.count > 0) centers[j] = { l: s.l / s.count, a: s.a / s.count, b: s.b / s.count };
    }
  }

  // Return centers sorted by cluster size (largest first)
  const sizes: number[] = new Array(n).fill(0) as number[];
  for (const a of assignments) {
    sizes[a] = (sizes[a] ?? 0) + 1;
  }
  return Array.from({ length: n }, (_, i) => ({ center: centers[i]!, size: sizes[i] ?? 0 }))
    .sort((a, b) => b.size - a.size)
    .map((x) => x.center);
}

// ── Mask pixel extraction ──────────────────────────────────────────────────

/**
 * Extract LAB-converted pixels from image data where mask value > threshold.
 * Applies HSV pre-filtering: removes extreme shadows (v<20), extreme highlights
 * (v>235), and fully-desaturated pixels (s<10).
 * If the filter removes too many pixels (fewer than MIN_PIXELS remain),
 * falls back to brightness-only filtering to handle dark hair/brows.
 */
function getMaskedLabPixels(
  pixels: Pixels,
  mask: SegMask,
  threshold = 128,
): Lab[] {
  const MIN_PIXELS = 20;
  const scaleX = pixels.width / mask.width;
  const scaleY = pixels.height / mask.height;

  const allMasked: Array<[number, number, number]> = [];

  for (let my = 0; my < mask.height; my++) {
    for (let mx = 0; mx < mask.width; mx++) {
      if ((mask.data[my * mask.width + mx] ?? 0) <= threshold) continue;
      const ix = Math.min(Math.round(mx * scaleX), pixels.width - 1);
      const iy = Math.min(Math.round(my * scaleY), pixels.height - 1);
      const idx = (iy * pixels.width + ix) * 4;
      allMasked.push([pixels.data[idx]!, pixels.data[idx + 1]!, pixels.data[idx + 2]!]);
    }
  }

  // Try HSV filter first (relaxed thresholds for dark/pale skin)
  const filtered = allMasked.filter(([r, g, b]) => {
    const { s, v } = rgbToHsv(r, g, b);
    return v >= 15 && v <= 240 && s >= 7;
  });

  // If too few pixels pass HSV filter (dark hair, brows, etc.) — fall back to
  // brightness-only filter: just remove extreme shadows and highlights
  const kept = filtered.length >= MIN_PIXELS
    ? filtered
    : allMasked.filter(([r, g, b]) => {
        const { v } = rgbToHsv(r, g, b);
        return v >= 10 && v <= 245;
      });

  return kept.map(([r, g, b]) => rgbToLab(r, g, b));
}

function combineMasks(mask1: SegMask, mask2: SegMask | undefined): SegMask {
  if (!mask2) return mask1;
  const combined = new Uint8ClampedArray(mask1.data.length);
  for (let i = 0; i < combined.length; i++) {
    combined[i] = Math.max(mask1.data[i] ?? 0, mask2.data[i] ?? 0);
  }
  return { data: combined, width: mask1.width, height: mask1.height };
}

function dominantColor(labs: Lab[], k = 3): RGB {
  if (labs.length === 0) return { r: 128, g: 128, b: 128 };
  const centers = kMeansLab(labs, Math.min(k, labs.length));
  if (centers.length === 0) return { r: 128, g: 128, b: 128 };
  const center = centers[0]!;

  // Pass 2: discard outlier pixels too far from dominant center in LAB space.
  // ΔE ≈ 22 removes clearly different colors (black lashes, bright skin in brow region).
  const THRESHOLD = 35;
  const refined = labs.filter((l) => {
    const dl = l.l - center.l;
    const da = l.a - center.a;
    const db = l.b - center.b;
    return Math.sqrt(dl * dl + da * da + db * db) <= THRESHOLD;
  });
  if (refined.length < 5) return labToRgb(center);

  const avg = refined.reduce(
    (acc, l) => ({ l: acc.l + l.l, a: acc.a + l.a, b: acc.b + l.b }),
    { l: 0, a: 0, b: 0 },
  );
  return labToRgb({
    l: avg.l / refined.length,
    a: avg.a / refined.length,
    b: avg.b / refined.length,
  });
}

// ── Analysis ───────────────────────────────────────────────────────────────

async function analyze(
  dataUrl: string,
  pixels: Pixels,
): Promise<FaceParsingColors> {
  await load();
  if (!pipelineInstance) throw new Error("face parser unavailable");

  const results = await pipelineInstance(dataUrl);

  const find = (label: string) => results.find((r) => r.label === label)?.mask;

  const skinMask  = find("skin");
  const hairMask  = find("hair");
  const uLipMask  = find("u_lip");
  const lLipMask  = find("l_lip");
  const lBrowMask = find("l_brow");
  const rBrowMask = find("r_brow");

  const lipsMask = uLipMask
    ? combineMasks(uLipMask, lLipMask)
    : lLipMask;

  const browsMask = lBrowMask
    ? combineMasks(lBrowMask, rBrowMask)
    : rBrowMask;

  const extract = (mask: SegMask | undefined): RGB => {
    if (!mask) return { r: 128, g: 128, b: 128 };
    return dominantColor(getMaskedLabPixels(pixels, mask));
  };

  return {
    skin:  extract(skinMask),
    hair:  extract(hairMask),
    lips:  extract(lipsMask),
    brows: extract(browsMask),
  };
}

// ── Message handling ───────────────────────────────────────────────────────

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

ctx.addEventListener("message", (event) => {
  const msg = event.data;

  if (msg.type === "load") {
    load().then(
      () => ctx.postMessage({ type: "loaded" }),
      (err: unknown) =>
        ctx.postMessage({ type: "loadError", message: messageOf(err) }),
    );
    return;
  }

  const { id, dataUrl, buffer, width, height } = msg;
  const pixels: Pixels = {
    data: new Uint8ClampedArray(buffer),
    width,
    height,
  };
  analyze(dataUrl, pixels).then(
    (colors) => ctx.postMessage({ type: "result", id, colors }),
    (err: unknown) =>
      ctx.postMessage({ type: "analyzeError", id, message: messageOf(err) }),
  );
});

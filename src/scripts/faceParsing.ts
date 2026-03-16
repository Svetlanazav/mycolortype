/**
 * Face parsing via Xenova/face-parsing (SegFormer trained on CelebAMask-HQ).
 * Provides pixel-accurate masks for: skin, hair, lips (u_lip+l_lip),
 * brows (l_brow+r_brow). Returns dominant color via K-means in LAB space
 * with HSV pre-filtering to remove highlights/shadows.
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

// Lazily-loaded singleton — model downloads once, then stays in browser cache
let pipelineInstance: ((input: string) => Promise<SegItem[]>) | null = null;
let loadPromise: Promise<void> | null = null;

export function loadFaceParser(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const pipe = await pipeline("image-segmentation", "Xenova/face-parsing");
    pipelineInstance = pipe as unknown as (input: string) => Promise<SegItem[]>;
  })();
  return loadPromise;
}

export function isFaceParserLoaded(): boolean {
  return pipelineInstance !== null;
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
 * Applies HSV pre-filtering: removes shadows (v<30), highlights (v>240),
 * and fully-desaturated pixels (s<15) that would skew the dominant color.
 */
function getMaskedLabPixels(
  imageData: ImageData,
  mask: SegMask,
  threshold = 128,
): Lab[] {
  const labs: Lab[] = [];
  const scaleX = imageData.width / mask.width;
  const scaleY = imageData.height / mask.height;

  for (let my = 0; my < mask.height; my++) {
    for (let mx = 0; mx < mask.width; mx++) {
      if ((mask.data[my * mask.width + mx] ?? 0) <= threshold) continue;

      const ix = Math.min(Math.round(mx * scaleX), imageData.width - 1);
      const iy = Math.min(Math.round(my * scaleY), imageData.height - 1);
      const idx = (iy * imageData.width + ix) * 4;
      const r = imageData.data[idx]!;
      const g = imageData.data[idx + 1]!;
      const b = imageData.data[idx + 2]!;

      // HSV pre-filter: drop shadows, highlights, and near-grey pixels
      const { s, v } = rgbToHsv(r, g, b);
      if (v < 30 || v > 240 || s < 15) continue;

      labs.push(rgbToLab(r, g, b));
    }
  }
  return labs;
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
  return labToRgb(centers[0]!);
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Run face-parsing on the given canvas and return dominant colors for
 * skin, hair, lips, and brows using the Xenova/face-parsing model.
 * Returns null if the parser has not been loaded yet.
 */
export async function analyzeFaceWithParsing(
  canvas: HTMLCanvasElement,
): Promise<FaceParsingColors | null> {
  if (!pipelineInstance) return null;

  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  const results = await pipelineInstance(dataUrl);

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

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
    return dominantColor(getMaskedLabPixels(imageData, mask));
  };

  return {
    skin:  extract(skinMask),
    hair:  extract(hairMask),
    lips:  extract(lipsMask),
    brows: extract(browsMask),
  };
}

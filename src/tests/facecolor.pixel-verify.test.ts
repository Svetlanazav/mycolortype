/**
 * Independent pixel-level verification of FaceColorAnalyzer.
 *
 * Ground truth is computed by simple pixel averaging at landmark regions —
 * no k-means, no clustering, no algorithm magic. The algorithm's output
 * must stay within a perceptual distance (ΔE in LAB) of these ground truths.
 *
 * If a test fails, the ALGORITHM must be fixed — not the test expectations.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { FaceColorAnalyzer, type FaceColors } from "../scripts/facecolor";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Types ───────────────────────────────────────────────────────────────

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

// ── Color space helpers (standalone, independent of algorithm) ───────────

function rgbToLab(color: RGB): Lab {
  let rn = color.r / 255;
  let gn = color.g / 255;
  let bn = color.b / 255;
  rn = rn > 0.04045 ? Math.pow((rn + 0.055) / 1.055, 2.4) : rn / 12.92;
  gn = gn > 0.04045 ? Math.pow((gn + 0.055) / 1.055, 2.4) : gn / 12.92;
  bn = bn > 0.04045 ? Math.pow((bn + 0.055) / 1.055, 2.4) : bn / 12.92;
  const xr = (rn * 0.4124 + gn * 0.3576 + bn * 0.1805) * 100 / 95.047;
  const yr = rn * 0.2126 + gn * 0.7152 + bn * 0.0722;
  const zr = (rn * 0.0193 + gn * 0.1192 + bn * 0.9505) * 100 / 108.883;
  const f = (t: number) =>
    t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  return {
    l: 116 * f(yr) - 16,
    a: 500 * (f(xr) - f(yr)),
    b: 200 * (f(yr) - f(zr)),
  };
}

function deltaE(a: RGB, b: RGB): number {
  const la = rgbToLab(a);
  const lb = rgbToLab(b);
  return Math.sqrt(
    (la.l - lb.l) ** 2 + (la.a - lb.a) ** 2 + (la.b - lb.b) ** 2,
  );
}

function toHex(c: RGB): string {
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`;
}

// ── Shared pixel sampling helpers ───────────────────────────────────────

let pixelBuf: Uint8ClampedArray;
let imgW: number;
let imgH: number;

function getPixel(x: number, y: number): RGB {
  const xi = Math.max(0, Math.min(imgW - 1, Math.floor(x)));
  const yi = Math.max(0, Math.min(imgH - 1, Math.floor(y)));
  const i = (yi * imgW + xi) * 4;
  return { r: pixelBuf[i]!, g: pixelBuf[i + 1]!, b: pixelBuf[i + 2]! };
}

function sampleCircle(cx: number, cy: number, radius: number): RGB[] {
  const colors: RGB[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy <= radius * radius) {
        colors.push(getPixel(cx + dx, cy + dy));
      }
    }
  }
  return colors;
}

function averageColor(colors: RGB[]): RGB {
  if (colors.length === 0) return { r: 0, g: 0, b: 0 };
  const sum = colors.reduce(
    (acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b }),
    { r: 0, g: 0, b: 0 },
  );
  return {
    r: Math.round(sum.r / colors.length),
    g: Math.round(sum.g / colors.length),
    b: Math.round(sum.b / colors.length),
  };
}

function brightness(c: RGB): number {
  return (c.r + c.g + c.b) / 3;
}

// ── Shared ground truth samplers ────────────────────────────────────────

function sampleIrisRingGT(
  centerIdx: number,
  boundaryIndices: number[],
  landmarks: NormalizedLandmark[],
): RGB {
  const center = landmarks[centerIdx]!;
  const cx = center.x * imgW;
  const cy = center.y * imgH;
  const distances = boundaryIndices.map((idx) => {
    const p = landmarks[idx]!;
    return Math.sqrt((p.x * imgW - cx) ** 2 + (p.y * imgH - cy) ** 2);
  });
  const irisRadius = Math.min(...distances);
  const pupilR = irisRadius * 0.45;
  const outerR = irisRadius * 0.85;
  const colors: RGB[] = [];
  for (let dy = -Math.ceil(outerR); dy <= Math.ceil(outerR); dy++) {
    for (let dx = -Math.ceil(outerR); dx <= Math.ceil(outerR); dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= pupilR && dist <= outerR) {
        const p = getPixel(cx + dx, cy + dy);
        if (brightness(p) > 35 && brightness(p) < 245) colors.push(p);
      }
    }
  }
  return averageColor(colors);
}

const SKIN_INDICES = [
  118, 119, 100, 36, 50,
  329, 348, 347, 280, 266,
  151, 108, 69, 109, 10, 338, 297, 337,
  4, 195, 5,
];

const BROW_INDICES = [
  70, 63, 105, 66, 107, 55, 65, 52, 53, 46,
  300, 293, 334, 296, 336, 285, 295, 282, 283, 276,
];

// ── Test setup helper ───────────────────────────────────────────────────

async function loadPhotoAndAnalyze(
  imageFile: string,
  landmarkFile: string,
): Promise<{ landmarks: NormalizedLandmark[]; result: FaceColors }> {
  const imagePath = join(__dirname, "fixtures", imageFile);
  const landmarkPath = join(__dirname, "fixtures", landmarkFile);

  const { data, info } = await sharp(imagePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  imgW = info.width;
  imgH = info.height;
  pixelBuf = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);

  const rawLandmarks = JSON.parse(
    await readFile(landmarkPath, "utf-8"),
  ) as Array<{ x: number; y: number; z: number }>;

  const landmarks: NormalizedLandmark[] = rawLandmarks.map((lm) => ({
    x: lm.x,
    y: lm.y,
    z: lm.z,
    visibility: 1,
  }));

  const ctx = {
    getImageData(x: number, y: number, _w: number, _h: number) {
      const xi = Math.max(0, Math.min(imgW - 1, Math.floor(x)));
      const yi = Math.max(0, Math.min(imgH - 1, Math.floor(y)));
      const i = (yi * imgW + xi) * 4;
      return {
        data: new Uint8ClampedArray([pixelBuf[i]!, pixelBuf[i + 1]!, pixelBuf[i + 2]!, pixelBuf[i + 3]!]),
      };
    },
  } as unknown as CanvasRenderingContext2D;
  const canvas = { width: imgW, height: imgH } as unknown as HTMLCanvasElement;

  const analyzer = new FaceColorAnalyzer(canvas, ctx);
  const result = analyzer.analyzeFaceColors(landmarks);

  return { landmarks, result };
}

// ── Blue eyes photo ─────────────────────────────────────────────────────

describe("pixel verification: blue-eyes photo", () => {
  let landmarks: NormalizedLandmark[];
  let result: FaceColors;

  beforeAll(async () => {
    ({ landmarks, result } = await loadPhotoAndAnalyze(
      "blue-eyes-test.jpg",
      "blue-eyes-landmarks.json",
    ));
  });

  it("iris: blue (b > r) within ΔE 15", () => {
    const leftGT = sampleIrisRingGT(468, [469, 470, 471, 472], landmarks);
    const rightGT = sampleIrisRingGT(473, [474, 475, 476, 477], landmarks);
    const combinedGT = averageColor([leftGT, rightGT]);

    console.log("  IRIS GT L:", toHex(leftGT), "R:", toHex(rightGT), "C:", toHex(combinedGT));
    console.log("  IRIS AL L:", toHex(result.leftIris), "R:", toHex(result.rightIris), "C:", toHex(result.eyeColor));

    // Blue eyes: b channel dominant
    expect(result.eyeColor.b).toBeGreaterThan(result.eyeColor.r);

    expect(deltaE(result.leftIris, leftGT)).toBeLessThan(15);
    expect(deltaE(result.rightIris, rightGT)).toBeLessThan(15);
    expect(deltaE(result.eyeColor, combinedGT)).toBeLessThan(15);
  });

  it("skin: warm (r > b) within ΔE 20", () => {
    const allPixels: RGB[] = [];
    SKIN_INDICES.forEach((idx) => {
      const lm = landmarks[idx]!;
      allPixels.push(...sampleCircle(lm.x * imgW, lm.y * imgH, 8));
    });
    const skinGT = averageColor(allPixels);
    console.log("  SKIN GT:", toHex(skinGT), "AL:", toHex(result.skin));
    expect(result.skin.r).toBeGreaterThan(result.skin.b);
    expect(deltaE(result.skin, skinGT)).toBeLessThan(20);
  });

  it("lips: within ΔE 25 of central lip pixels", () => {
    const centralPixels: RGB[] = [];
    [13, 14].forEach((idx) => {
      const lm = landmarks[idx]!;
      centralPixels.push(...sampleCircle(lm.x * imgW, lm.y * imgH, 5));
    });
    const lipsGT = averageColor(centralPixels);
    const d = deltaE(result.lips, lipsGT);
    console.log("  LIPS GT:", toHex(lipsGT), "AL:", toHex(result.lips), "ΔE:", d.toFixed(1));
    expect(d).toBeLessThan(25);
  });

  it("brows: darker than raw average, same hue family", () => {
    const allPixels: RGB[] = [];
    BROW_INDICES.forEach((idx) => {
      const lm = landmarks[idx]!;
      allPixels.push(...sampleCircle(lm.x * imgW, lm.y * imgH, 3));
    });
    const browGT = averageColor(allPixels);
    console.log("  BROW GT:", toHex(browGT), "AL:", toHex(result.brows));
    expect(brightness(result.brows)).toBeLessThan(brightness(browGT));
    expect(deltaE(result.brows, browGT)).toBeLessThan(35);
  });
});

// ── Brown eyes photo ────────────────────────────────────────────────────

describe("pixel verification: brown-eyes photo", () => {
  let landmarks: NormalizedLandmark[];
  let result: FaceColors;

  beforeAll(async () => {
    ({ landmarks, result } = await loadPhotoAndAnalyze(
      "brown-eyes-test.jpg",
      "brown-eyes-landmarks.json",
    ));
  });

  it("iris: brown (r > b) within ΔE 15", () => {
    const leftGT = sampleIrisRingGT(468, [469, 470, 471, 472], landmarks);
    const rightGT = sampleIrisRingGT(473, [474, 475, 476, 477], landmarks);
    const combinedGT = averageColor([leftGT, rightGT]);

    console.log("  IRIS GT L:", toHex(leftGT), "R:", toHex(rightGT), "C:", toHex(combinedGT));
    console.log("  IRIS AL L:", toHex(result.leftIris), "R:", toHex(result.rightIris), "C:", toHex(result.eyeColor));

    const dL = deltaE(result.leftIris, leftGT);
    const dR = deltaE(result.rightIris, rightGT);
    const dC = deltaE(result.eyeColor, combinedGT);
    console.log("  ΔE L:", dL.toFixed(1), "R:", dR.toFixed(1), "C:", dC.toFixed(1));

    // Brown eyes: r channel dominant (warm tone)
    expect(result.eyeColor.r).toBeGreaterThan(result.eyeColor.b);

    expect(dL).toBeLessThan(15);
    expect(dR).toBeLessThan(15);
    expect(dC).toBeLessThan(15);
  });

  it("skin: warm/light (r > b, r > 180) within ΔE 20", () => {
    const allPixels: RGB[] = [];
    SKIN_INDICES.forEach((idx) => {
      const lm = landmarks[idx]!;
      allPixels.push(...sampleCircle(lm.x * imgW, lm.y * imgH, 8));
    });
    const skinGT = averageColor(allPixels);
    const d = deltaE(result.skin, skinGT);
    console.log("  SKIN GT:", toHex(skinGT), "AL:", toHex(result.skin), "ΔE:", d.toFixed(1));

    expect(result.skin.r).toBeGreaterThan(result.skin.b);
    expect(result.skin.r).toBeGreaterThan(180);
    expect(d).toBeLessThan(20);
  });

  it("lips: pink (r > g, r > b) within ΔE 25 of central pixels", () => {
    const centralPixels: RGB[] = [];
    [13, 14].forEach((idx) => {
      const lm = landmarks[idx]!;
      centralPixels.push(...sampleCircle(lm.x * imgW, lm.y * imgH, 5));
    });
    const lipsGT = averageColor(centralPixels);
    const d = deltaE(result.lips, lipsGT);
    console.log("  LIPS GT:", toHex(lipsGT), "AL:", toHex(result.lips), "ΔE:", d.toFixed(1));

    expect(result.lips.r).toBeGreaterThan(result.lips.g);
    expect(result.lips.r).toBeGreaterThan(result.lips.b);
    expect(d).toBeLessThan(25);
  });

  it("brows: darker than raw average", () => {
    const allPixels: RGB[] = [];
    BROW_INDICES.forEach((idx) => {
      const lm = landmarks[idx]!;
      allPixels.push(...sampleCircle(lm.x * imgW, lm.y * imgH, 3));
    });
    const browGT = averageColor(allPixels);
    const d = deltaE(result.brows, browGT);
    console.log("  BROW GT:", toHex(browGT), "AL:", toHex(result.brows), "ΔE:", d.toFixed(1));

    expect(brightness(result.brows)).toBeLessThan(brightness(browGT));
    expect(d).toBeLessThan(35);
  });
});

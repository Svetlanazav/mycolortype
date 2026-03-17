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
import { FaceColorAnalyzer } from "../scripts/facecolor";
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

// ── Image + canvas stub ─────────────────────────────────────────────────

let buf: Uint8ClampedArray;
let W: number;
let H: number;

function getPixel(x: number, y: number): RGB {
  const xi = Math.max(0, Math.min(W - 1, Math.floor(x)));
  const yi = Math.max(0, Math.min(H - 1, Math.floor(y)));
  const i = (yi * W + xi) * 4;
  return { r: buf[i]!, g: buf[i + 1]!, b: buf[i + 2]! };
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

// ── Tests ───────────────────────────────────────────────────────────────

describe("algorithm vs independent pixel analysis (blue-eyes photo)", () => {
  let landmarks: NormalizedLandmark[];
  let algorithmResult: ReturnType<FaceColorAnalyzer["analyzeFaceColors"]>;

  beforeAll(async () => {
    const imagePath = join(__dirname, "fixtures", "blue-eyes-test.jpg");
    const landmarkPath = join(__dirname, "fixtures", "blue-eyes-landmarks.json");

    const { data, info } = await sharp(imagePath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    W = info.width;
    H = info.height;
    buf = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);

    const rawLandmarks = JSON.parse(
      await readFile(landmarkPath, "utf-8"),
    ) as Array<{ x: number; y: number; z: number }>;

    landmarks = rawLandmarks.map((lm) => ({
      x: lm.x,
      y: lm.y,
      z: lm.z,
      visibility: 1,
    }));

    // Run algorithm once
    const ctx = {
      getImageData(x: number, y: number, _w: number, _h: number) {
        const xi = Math.max(0, Math.min(W - 1, Math.floor(x)));
        const yi = Math.max(0, Math.min(H - 1, Math.floor(y)));
        const i = (yi * W + xi) * 4;
        return {
          data: new Uint8ClampedArray([buf[i]!, buf[i + 1]!, buf[i + 2]!, buf[i + 3]!]),
        };
      },
    } as unknown as CanvasRenderingContext2D;
    const canvas = { width: W, height: H } as unknown as HTMLCanvasElement;

    const analyzer = new FaceColorAnalyzer(canvas, ctx);
    algorithmResult = analyzer.analyzeFaceColors(landmarks);
  });

  // ── Iris ────────────────────────────────────────────────────────────

  it("iris color within ΔE 15 of raw pixel average", () => {
    // Independent ground truth: sample iris ring pixels, simple average
    const sampleIrisRing = (centerIdx: number, boundaryIndices: number[]) => {
      const center = landmarks[centerIdx]!;
      const cx = center.x * W;
      const cy = center.y * H;
      const distances = boundaryIndices.map((idx) => {
        const p = landmarks[idx]!;
        return Math.sqrt((p.x * W - cx) ** 2 + (p.y * H - cy) ** 2);
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
            const b = brightness(p);
            if (b > 35 && b < 245) colors.push(p);
          }
        }
      }
      return averageColor(colors);
    };

    const leftGT = sampleIrisRing(468, [469, 470, 471, 472]);
    const rightGT = sampleIrisRing(473, [474, 475, 476, 477]);
    const combinedGT = averageColor([leftGT, rightGT]);

    console.log("  IRIS ground truth L:", toHex(leftGT), "R:", toHex(rightGT), "combined:", toHex(combinedGT));
    console.log("  IRIS algorithm   L:", toHex(algorithmResult.leftIris), "R:", toHex(algorithmResult.rightIris), "combined:", toHex(algorithmResult.eyeColor));

    const dLeft = deltaE(algorithmResult.leftIris, leftGT);
    const dRight = deltaE(algorithmResult.rightIris, rightGT);
    const dCombined = deltaE(algorithmResult.eyeColor, combinedGT);

    console.log("  ΔE left:", dLeft.toFixed(1), "right:", dRight.toFixed(1), "combined:", dCombined.toFixed(1));

    expect(dLeft).toBeLessThan(15);
    expect(dRight).toBeLessThan(15);
    expect(dCombined).toBeLessThan(15);
  });

  // ── Skin ───────────────────────────────────────────────────────────

  it("skin color within ΔE 20 of raw pixel average", () => {
    // Independent ground truth: sample all skin landmark areas, simple average
    const skinIndices = [
      118, 119, 100, 36, 50,
      329, 348, 347, 280, 266,
      151, 108, 69, 109, 10, 338, 297, 337,
      4, 195, 5,
    ];
    const allPixels: RGB[] = [];
    skinIndices.forEach((idx) => {
      const lm = landmarks[idx]!;
      allPixels.push(...sampleCircle(lm.x * W, lm.y * H, 8));
    });
    const skinGT = averageColor(allPixels);

    console.log("  SKIN ground truth:", toHex(skinGT), skinGT);
    console.log("  SKIN algorithm:  ", toHex(algorithmResult.skin), algorithmResult.skin);

    const d = deltaE(algorithmResult.skin, skinGT);
    console.log("  ΔE:", d.toFixed(1));

    // Algorithm filters shadows and uses k-means, so some divergence is expected.
    // But it must stay within perceptual bounds.
    expect(d).toBeLessThan(20);
  });

  // ── Lips ───────────────────────────────────────────────────────────

  it("lips color within ΔE 25 of central lip pixels", () => {
    // Independent ground truth: sample CENTRAL lip points only (not polygon border).
    // Landmarks 13 (upper lip center) and 14 (lower lip center) are on
    // the vermillion — the true lip tissue, not the skin-lip transition.
    const centralLipIndices = [13, 14];
    const centralPixels: RGB[] = [];
    centralLipIndices.forEach((idx) => {
      const lm = landmarks[idx]!;
      centralPixels.push(...sampleCircle(lm.x * W, lm.y * H, 5));
    });
    const lipsGT = averageColor(centralPixels);

    console.log("  LIPS ground truth (central):", toHex(lipsGT), lipsGT);
    console.log("  LIPS algorithm:             ", toHex(algorithmResult.lips), algorithmResult.lips);

    const d = deltaE(algorithmResult.lips, lipsGT);
    console.log("  ΔE:", d.toFixed(1));

    // After the chroma-based fix, the algorithm should pick the saturated
    // lip cluster instead of the washed-out border. ΔE < 25 from central tissue.
    expect(d).toBeLessThan(25);
  });

  // ── Brows ──────────────────────────────────────────────────────────

  it("brow color is darker than raw pixel average (by design)", () => {
    // Independent ground truth: simple average of all brow landmark pixels
    // (includes skin between hairs). Algorithm picks darkest cluster (hair only).
    const browIndices = [
      70, 63, 105, 66, 107, 55, 65, 52, 53, 46,
      300, 293, 334, 296, 336, 285, 295, 282, 283, 276,
    ];
    const allPixels: RGB[] = [];
    browIndices.forEach((idx) => {
      const lm = landmarks[idx]!;
      allPixels.push(...sampleCircle(lm.x * W, lm.y * H, 3));
    });
    const browGT = averageColor(allPixels);

    console.log("  BROW ground truth (avg):", toHex(browGT), browGT);
    console.log("  BROW algorithm (dark):  ", toHex(algorithmResult.brows), algorithmResult.brows);

    // Algorithm should be DARKER than raw average (selects hair, not skin)
    expect(brightness(algorithmResult.brows)).toBeLessThan(brightness(browGT));

    // But they should share the same hue family (both are warm brown)
    const d = deltaE(algorithmResult.brows, browGT);
    console.log("  ΔE:", d.toFixed(1));
    expect(d).toBeLessThan(35);
  });
});

/**
 * Integration test for FaceColorAnalyzer using a real JPEG photo.
 *
 * Uses `sharp` to decode the image into raw RGBA pixels and real
 * MediaPipe landmarks (extracted once via scripts/extract-landmarks.ts).
 */
import { describe, it, expect } from "vitest";
import { FaceColorAnalyzer } from "../scripts/facecolor";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface RGB {
  r: number;
  g: number;
  b: number;
}

function colorDistance(a: RGB, b: RGB): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function toHex(c: RGB): string {
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`;
}

async function loadImageAsCanvasStub(imagePath: string) {
  const { data, info } = await sharp(imagePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const W = info.width;
  const H = info.height;
  const buf = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);

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
  return { canvas, ctx, width: W, height: H };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("FaceColorAnalyzer (integration: real JPEG)", () => {
  it("detects correct face colors from blue-eyes photo", async () => {
    const imagePath = join(__dirname, "fixtures", "blue-eyes-test.jpg");
    const landmarkPath = join(__dirname, "fixtures", "blue-eyes-landmarks.json");

    const { canvas, ctx } = await loadImageAsCanvasStub(imagePath);

    const rawLandmarks = JSON.parse(
      await readFile(landmarkPath, "utf-8"),
    ) as Array<{ x: number; y: number; z: number }>;

    const landmarks: NormalizedLandmark[] = rawLandmarks.map((lm) => ({
      x: lm.x,
      y: lm.y,
      z: lm.z,
      visibility: 1,
    }));

    expect(landmarks).toHaveLength(478);

    const analyzer = new FaceColorAnalyzer(canvas, ctx);
    const result = analyzer.analyzeFaceColors(landmarks);

    // Log actual detected colors for debugging
    console.log("Detected colors:");
    console.log("  eyeColor:", toHex(result.eyeColor), result.eyeColor);
    console.log("  leftIris:", toHex(result.leftIris), result.leftIris);
    console.log("  rightIris:", toHex(result.rightIris), result.rightIris);
    console.log("  skin:", toHex(result.skin), result.skin);
    console.log("  lips:", toHex(result.lips), result.lips);
    console.log("  brows:", toHex(result.brows), result.brows);

    // ── Directional assertions (primary, robust) ──

    // Blue eyes: blue channel dominant
    expect(result.eyeColor.b).toBeGreaterThan(result.eyeColor.r);
    expect(result.leftIris.b).toBeGreaterThan(result.leftIris.r);
    expect(result.rightIris.b).toBeGreaterThan(result.rightIris.r);

    // Warm skin: red > blue
    expect(result.skin.r).toBeGreaterThan(result.skin.b);
    // Skin should not be too dark or too grey
    expect(result.skin.r).toBeGreaterThan(120);

    // Lips: red-ish (r > b)
    expect(result.lips.r).toBeGreaterThan(result.lips.b);

    // Brows: dark (brightness < 120)
    const browBrightness = (result.brows.r + result.brows.g + result.brows.b) / 3;
    expect(browBrightness).toBeLessThan(120);

    // ── Distance assertions (secondary, regression guard) ──
    // Expected values based on actual pixel analysis of this specific photo.
    // The photo has studio lighting that makes skin appear pinkish (hue 3-18),
    // not golden-tan. Eyes are steel grey-blue, not vivid blue.
    // Tolerance of 50 allows for JPEG artifacts + algorithm variance.

    const TOLERANCE = 50;

    // Steel grey-blue iris (this photo has desaturated blue eyes, not vivid)
    const expectedEye = { r: 105, g: 125, b: 150 };
    expect(colorDistance(result.eyeColor, expectedEye)).toBeLessThan(TOLERANCE);

    // Warm-pink skin (studio lighting gives pink cast, hue 5-15)
    const expectedSkin = { r: 215, g: 170, b: 160 };
    expect(colorDistance(result.skin, expectedSkin)).toBeLessThan(TOLERANCE);

    // Rosy-pink lips (male with natural lip color)
    const expectedLips = { r: 185, g: 130, b: 140 };
    expect(colorDistance(result.lips, expectedLips)).toBeLessThan(TOLERANCE);

    // Dark brown brows (actual brow hair, not surrounding skin)
    const expectedBrows = { r: 80, g: 55, b: 48 };
    expect(colorDistance(result.brows, expectedBrows)).toBeLessThan(TOLERANCE);
  });
});

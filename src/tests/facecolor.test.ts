/**
 * Unit tests for FaceColorAnalyzer.
 *
 * Uses a synthetic 300×300 pixel buffer with known colors painted at
 * landmark-specific positions. No browser environment required — the canvas
 * and context are stubbed with plain objects.
 */
import { describe, it, expect } from "vitest";
import { FaceColorAnalyzer } from "../scripts/facecolor";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

const W = 300;
const H = 300;

// ── Pixel buffer helpers ───────────────────────────────────────────────────

/** Fill entire buffer with peach (warm skin-like tone that passes isValidSkinColor). */
function makePeachBuffer(): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    buf[i * 4 + 0] = 220; // r
    buf[i * 4 + 1] = 170; // g
    buf[i * 4 + 2] = 140; // b
    buf[i * 4 + 3] = 255; // a
  }
  return buf;
}

function setPixel(
  buf: Uint8ClampedArray,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
) {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || xi >= W || yi < 0 || yi >= H) return;
  const i = (yi * W + xi) * 4;
  buf[i] = r;
  buf[i + 1] = g;
  buf[i + 2] = b;
  buf[i + 3] = 255;
}

function fillCircle(
  buf: Uint8ClampedArray,
  cx: number,
  cy: number,
  radius: number,
  rgb: [number, number, number],
) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(buf, cx + dx, cy + dy, rgb[0], rgb[1], rgb[2]);
      }
    }
  }
}

// ── Canvas stub ────────────────────────────────────────────────────────────

function makeCanvasStub(buf: Uint8ClampedArray) {
  const ctx = {
    getImageData(x: number, y: number, _w: number, _h: number) {
      const xi = Math.max(0, Math.min(W - 1, Math.floor(x)));
      const yi = Math.max(0, Math.min(H - 1, Math.floor(y)));
      const i = (yi * W + xi) * 4;
      return {
        data: new Uint8ClampedArray([
          buf[i]!,
          buf[i + 1]!,
          buf[i + 2]!,
          buf[i + 3]!,
        ]),
      };
    },
  } as unknown as CanvasRenderingContext2D;

  const canvas = { width: W, height: H } as unknown as HTMLCanvasElement;
  return { canvas, ctx };
}

// ── Landmark helpers ───────────────────────────────────────────────────────

/** Create 478 landmarks all pointing to (150, 150) — peach background. */
function makeDefaultLandmarks(): NormalizedLandmark[] {
  return Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
}

/** Set landmark[idx] to pixel position (px, py). */
function setLandmark(
  lm: NormalizedLandmark[],
  idx: number,
  px: number,
  py: number,
) {
  lm[idx] = { x: px / W, y: py / H, z: 0, visibility: 1 };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("FaceColorAnalyzer", () => {
  // ── Iris ────────────────────────────────────────────────────────────────

  it("detects vivid blue iris (b > r, b > g)", () => {
    const buf = makePeachBuffer();

    // Left iris center (75, 115), radius 10px — paint full circle vivid blue.
    // The annular sampler skips r < pupilRadius (≈4) and r > outerRadius (≈9),
    // so only r ∈ [4, 9] are sampled — all vivid blue.
    fillCircle(buf, 75, 115, 10, [50, 120, 220]);
    // Right iris center (225, 115)
    fillCircle(buf, 225, 115, 10, [50, 120, 220]);

    const lm = makeDefaultLandmarks();
    // Left iris: center=468, perimeter 469-472 (up, left, down, right)
    setLandmark(lm, 468, 75, 115);
    setLandmark(lm, 469, 75, 105); // top   → irisRadius = 10
    setLandmark(lm, 470, 65, 115); // left
    setLandmark(lm, 471, 75, 125); // bottom
    setLandmark(lm, 472, 85, 115); // right
    // Right iris: center=473, perimeter 474-477
    setLandmark(lm, 473, 225, 115);
    setLandmark(lm, 474, 225, 105);
    setLandmark(lm, 475, 215, 115);
    setLandmark(lm, 476, 225, 125);
    setLandmark(lm, 477, 235, 115);

    const { canvas, ctx } = makeCanvasStub(buf);
    const analyzer = new FaceColorAnalyzer(canvas, ctx);
    const result = analyzer.analyzeFaceColors(lm);

    expect(result.leftIris.b).toBeGreaterThan(result.leftIris.r);
    expect(result.leftIris.b).toBeGreaterThan(result.leftIris.g);
    expect(result.rightIris.b).toBeGreaterThan(result.rightIris.r);
    expect(result.rightIris.b).toBeGreaterThan(result.rightIris.g);
    expect(result.eyeColor.b).toBeGreaterThan(result.eyeColor.r);
    expect(result.eyeColor.b).toBeGreaterThan(result.eyeColor.g);
  });

  it("does not confuse dark eyelashes with iris color", () => {
    const buf = makePeachBuffer();

    // Paint near-black eyelashes over the whole iris area (including the ring).
    fillCircle(buf, 75, 115, 10, [18, 14, 12]); // near-black (s ≈ 0.2, but v very low)
    // Paint vivid blue only in the true iris ring (r ∈ 5..9)
    for (let dy = -9; dy <= 9; dy++) {
      for (let dx = -9; dx <= 9; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= 5 && dist <= 9) {
          setPixel(buf, 75 + dx, 115 + dy, 50, 120, 220);
        }
      }
    }
    fillCircle(buf, 225, 115, 9, [50, 120, 220]);

    const lm = makeDefaultLandmarks();
    setLandmark(lm, 468, 75, 115);
    setLandmark(lm, 469, 75, 105);
    setLandmark(lm, 470, 65, 115);
    setLandmark(lm, 471, 75, 125);
    setLandmark(lm, 472, 85, 115);
    setLandmark(lm, 473, 225, 115);
    setLandmark(lm, 474, 225, 105);
    setLandmark(lm, 475, 215, 115);
    setLandmark(lm, 476, 225, 125);
    setLandmark(lm, 477, 235, 115);

    const { canvas, ctx } = makeCanvasStub(buf);
    const result = new FaceColorAnalyzer(canvas, ctx).analyzeFaceColors(lm);

    // Despite dark pixels, iris must be detected as blue
    expect(result.leftIris.b).toBeGreaterThan(result.leftIris.r);
  });

  // ── Lips ────────────────────────────────────────────────────────────────

  it("detects pink/red lips (r > g, r > b)", () => {
    const buf = makePeachBuffer();

    // Paint outer lip area pink (r=20 ellipse), teeth neutral inside (r=8)
    fillCircle(buf, 150, 210, 20, [200, 80, 120]);
    fillCircle(buf, 150, 210, 8, [235, 228, 222]);

    const lm = makeDefaultLandmarks();
    const OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
    const INNER = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191];

    // Outer polygon: 20 points on ellipse 20×12 around (150, 210)
    OUTER.forEach((idx, i) => {
      const angle = (i / OUTER.length) * 2 * Math.PI;
      setLandmark(lm, idx, 150 + 20 * Math.cos(angle), 210 + 12 * Math.sin(angle));
    });
    // Inner polygon: 20 points on ellipse 9×5 around (150, 210)
    INNER.forEach((idx, i) => {
      const angle = (i / INNER.length) * 2 * Math.PI;
      setLandmark(lm, idx, 150 + 9 * Math.cos(angle), 210 + 5 * Math.sin(angle));
    });

    const { canvas, ctx } = makeCanvasStub(buf);
    const result = new FaceColorAnalyzer(canvas, ctx).analyzeFaceColors(lm);

    expect(result.lips.r).toBeGreaterThan(result.lips.g);
    expect(result.lips.r).toBeGreaterThan(result.lips.b);
  });

  // ── Brows ───────────────────────────────────────────────────────────────

  it("detects dark eyebrows (brightness < 100)", () => {
    const buf = makePeachBuffer();

    // Dark-brown brow positions for each of the 20 brow landmark indices
    const browPx: [number, number][] = [
      [75, 70], [80, 68], [90, 67], [95, 68], [100, 69],
      [58, 73], [70, 68], [65, 71], [68, 70], [60, 72],
      [210, 70], [215, 68], [225, 67], [230, 68], [235, 69],
      [193, 73], [205, 68], [200, 71], [203, 70], [197, 72],
    ];
    browPx.forEach(([x, y]) => fillCircle(buf, x, y, 5, [60, 40, 30]));

    const lm = makeDefaultLandmarks();
    const BROW_IDX = [
      70, 63, 105, 66, 107, 55, 65, 52, 53, 46,
      300, 293, 334, 296, 336, 285, 295, 282, 283, 276,
    ];
    BROW_IDX.forEach((idx, i) => {
      const [x, y] = browPx[i]!;
      setLandmark(lm, idx, x, y);
    });

    const { canvas, ctx } = makeCanvasStub(buf);
    const result = new FaceColorAnalyzer(canvas, ctx).analyzeFaceColors(lm);

    const brightness = (result.brows.r + result.brows.g + result.brows.b) / 3;
    expect(brightness).toBeLessThan(100);
  });

  // ── Skin ────────────────────────────────────────────────────────────────

  it("detects warm/peach skin (r > b)", () => {
    // Whole buffer is peach; all skin landmarks default to (150, 150).
    const buf = makePeachBuffer();
    const lm = makeDefaultLandmarks();

    const { canvas, ctx } = makeCanvasStub(buf);
    const result = new FaceColorAnalyzer(canvas, ctx).analyzeFaceColors(lm);

    expect(result.skin.r).toBeGreaterThan(result.skin.b);
    // Sanity: peach is not too dark and not too grey
    expect(result.skin.r).toBeGreaterThan(150);
  });

  // ── Full face: all features together ───────────────────────────────────

  it("full face: iris blue, lips pink, brows dark, skin warm", () => {
    const buf = makePeachBuffer();

    // Iris (blue)
    fillCircle(buf, 75, 115, 10, [50, 120, 220]);
    fillCircle(buf, 225, 115, 10, [50, 120, 220]);

    // Lips (pink)
    fillCircle(buf, 150, 210, 20, [200, 80, 120]);
    fillCircle(buf, 150, 210, 8, [235, 228, 222]);

    // Brows (dark brown)
    const browPx: [number, number][] = [
      [75, 70], [80, 68], [90, 67], [95, 68], [100, 69],
      [58, 73], [70, 68], [65, 71], [68, 70], [60, 72],
      [210, 70], [215, 68], [225, 67], [230, 68], [235, 69],
      [193, 73], [205, 68], [200, 71], [203, 70], [197, 72],
    ];
    browPx.forEach(([x, y]) => fillCircle(buf, x, y, 5, [60, 40, 30]));

    const lm = makeDefaultLandmarks();

    // Iris landmarks
    setLandmark(lm, 468, 75, 115);
    setLandmark(lm, 469, 75, 105);
    setLandmark(lm, 470, 65, 115);
    setLandmark(lm, 471, 75, 125);
    setLandmark(lm, 472, 85, 115);
    setLandmark(lm, 473, 225, 115);
    setLandmark(lm, 474, 225, 105);
    setLandmark(lm, 475, 215, 115);
    setLandmark(lm, 476, 225, 125);
    setLandmark(lm, 477, 235, 115);

    // Lip landmarks
    const OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
    const INNER = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191];
    OUTER.forEach((idx, i) => {
      const angle = (i / OUTER.length) * 2 * Math.PI;
      setLandmark(lm, idx, 150 + 20 * Math.cos(angle), 210 + 12 * Math.sin(angle));
    });
    INNER.forEach((idx, i) => {
      const angle = (i / INNER.length) * 2 * Math.PI;
      setLandmark(lm, idx, 150 + 9 * Math.cos(angle), 210 + 5 * Math.sin(angle));
    });

    // Brow landmarks
    const BROW_IDX = [
      70, 63, 105, 66, 107, 55, 65, 52, 53, 46,
      300, 293, 334, 296, 336, 285, 295, 282, 283, 276,
    ];
    BROW_IDX.forEach((idx, i) => {
      const [x, y] = browPx[i]!;
      setLandmark(lm, idx, x, y);
    });

    const { canvas, ctx } = makeCanvasStub(buf);
    const result = new FaceColorAnalyzer(canvas, ctx).analyzeFaceColors(lm);

    // Iris: blue dominant
    expect(result.eyeColor.b).toBeGreaterThan(result.eyeColor.r);
    expect(result.eyeColor.b).toBeGreaterThan(result.eyeColor.g);

    // Lips: red dominant
    expect(result.lips.r).toBeGreaterThan(result.lips.b);
    expect(result.lips.r).toBeGreaterThan(result.lips.g);

    // Brows: dark
    const browBrightness = (result.brows.r + result.brows.g + result.brows.b) / 3;
    expect(browBrightness).toBeLessThan(100);

    // Skin: warm (r > b)
    expect(result.skin.r).toBeGreaterThan(result.skin.b);
  });
});

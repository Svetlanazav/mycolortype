import { type NormalizedLandmark } from "@mediapipe/tasks-vision";

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface HSV {
  h: number;
  s: number;
  v: number;
}

interface Lab {
  l: number;
  a: number;
  b: number;
}

interface LabCluster {
  center: Lab;
  size: number;
}

interface WhiteBalance {
  rScale: number;
  gScale: number;
  bScale: number;
}

export interface FaceColors {
  leftIris: RGB;
  rightIris: RGB;
  eyeColor: RGB;
  lips: RGB;
  skin: RGB;
  brows: RGB;
}

export class FaceColorAnalyzer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;

  private readonly SKIN_SAMPLE_RADIUS = 8;
  private readonly BROW_SAMPLE_RADIUS = 3;
  private readonly SCLERA_SAMPLE_RADIUS = 3;
  private readonly PUPIL_BRIGHTNESS_THRESHOLD = 35;
  private readonly IRIS_SATURATION_MIN = 0.05;
  private readonly SKIN_SATURATION_MIN = 0.05;
  private readonly SKIN_SATURATION_MAX = 0.80;
  private readonly BRIGHTNESS_MIN = 25;
  private readonly BRIGHTNESS_MAX = 245;
  private readonly NUM_CLUSTERS = 3;
  private readonly MIN_SAMPLES = 5;
  private readonly WB_DAMPING = 0.6;

  constructor(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
    this.canvas = canvas;
    this.ctx = context;
  }

  // ── Pixel access ──────────────────────────────────────────────────────

  private getPixelColor(x: number, y: number): RGB {
    const pixel = this.ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
    return { r: pixel[0]!, g: pixel[1]!, b: pixel[2]! };
  }

  // ── Color space conversions ───────────────────────────────────────────

  private rgbToHsv(color: RGB): HSV {
    const r = color.r / 255;
    const g = color.g / 255;
    const b = color.b / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    let h = 0;
    if (diff !== 0) {
      if (max === r) h = ((g - b) / diff) % 6;
      else if (max === g) h = (b - r) / diff + 2;
      else h = (r - g) / diff + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
    return { h, s: max === 0 ? 0 : diff / max, v: max };
  }

  private rgbToLab(color: RGB): Lab {
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

  private labToRgb(lab: Lab): RGB {
    const fy = (lab.l + 16) / 116;
    const fx = lab.a / 500 + fy;
    const fz = fy - lab.b / 200;
    const cube = (v: number) =>
      v ** 3 > 0.008856 ? v ** 3 : (v - 16 / 116) / 7.787;
    const x = cube(fx) * 95.047;
    const y = cube(fy) * 100.0;
    const z = cube(fz) * 108.883;
    const toSrgb = (c: number) =>
      c > 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : 12.92 * c;
    const clamp = (v: number) =>
      Math.round(Math.max(0, Math.min(255, v * 255)));
    return {
      r: clamp(toSrgb(x / 100 * 3.2406 - y / 100 * 1.5372 - z / 100 * 0.4986)),
      g: clamp(toSrgb(-x / 100 * 0.9689 + y / 100 * 1.8758 + z / 100 * 0.0415)),
      b: clamp(toSrgb(x / 100 * 0.0557 - y / 100 * 0.2040 + z / 100 * 1.0570)),
    };
  }

  private getBrightness(color: RGB): number {
    return (color.r + color.g + color.b) / 3;
  }

  // ── White balance from sclera ─────────────────────────────────────────

  /**
   * Sample sclera (white of eye) pixels between iris boundary and eye corners.
   * The sclera should be near-white; any color cast indicates lighting shift.
   */
  private sampleScleraPixels(landmarks: NormalizedLandmark[]): RGB[] {
    // Pairs: [iris boundary point, eye corner point]
    // Left eye: 469 (lateral iris), 471 (medial iris); corners 33, 133
    // Right eye: 474 (medial iris), 476 (lateral iris); corners 362, 263
    const scleraPairs: Array<[number, number]> = [
      [469, 33],   // left eye lateral sclera
      [471, 133],  // left eye medial sclera
      [474, 362],  // right eye medial sclera
      [476, 263],  // right eye lateral sclera
    ];

    const colors: RGB[] = [];
    for (const [irisIdx, cornerIdx] of scleraPairs) {
      const irisPoint = landmarks[irisIdx]!;
      const cornerPoint = landmarks[cornerIdx]!;
      const mx = ((irisPoint.x + cornerPoint.x) / 2) * this.canvas.width;
      const my = ((irisPoint.y + cornerPoint.y) / 2) * this.canvas.height;
      if (mx < 0 || mx >= this.canvas.width || my < 0 || my >= this.canvas.height) continue;

      const samples = this.sampleAreaColors(mx, my, this.SCLERA_SAMPLE_RADIUS, (color) => {
        const brightness = this.getBrightness(color);
        return brightness > 120 && brightness < 250;
      });
      colors.push(...samples);
    }
    return colors;
  }

  /**
   * Estimate white balance correction from sclera pixels.
   * Returns per-channel scale factors. If sclera is not reliably white
   * (too saturated or too few samples), returns neutral (no correction).
   */
  private estimateWhiteBalance(scleraColors: RGB[]): WhiteBalance {
    const NEUTRAL = { rScale: 1, gScale: 1, bScale: 1 };
    if (scleraColors.length < 4) return NEUTRAL;

    // Use the most neutral (least saturated) sclera pixels
    const sorted = [...scleraColors].sort(
      (a, b) => this.rgbToHsv(a).s - this.rgbToHsv(b).s,
    );
    const neutralCount = Math.max(4, Math.ceil(sorted.length * 0.5));
    const neutral = sorted.slice(0, neutralCount);

    // If even the most neutral pixels are too saturated, sclera is contaminated
    const avgSaturation =
      neutral.reduce((sum, c) => sum + this.rgbToHsv(c).s, 0) / neutral.length;
    if (avgSaturation > 0.25) return NEUTRAL;

    const avg = this.calculateAverageColor(neutral);
    const gray = (avg.r + avg.g + avg.b) / 3;
    if (gray < 80) return NEUTRAL; // too dark, unreliable

    return {
      rScale: 1 + (gray / Math.max(avg.r, 1) - 1) * this.WB_DAMPING,
      gScale: 1 + (gray / Math.max(avg.g, 1) - 1) * this.WB_DAMPING,
      bScale: 1 + (gray / Math.max(avg.b, 1) - 1) * this.WB_DAMPING,
    };
  }

  private applyWhiteBalance(color: RGB, wb: WhiteBalance): RGB {
    return {
      r: Math.round(Math.max(0, Math.min(255, color.r * wb.rScale))),
      g: Math.round(Math.max(0, Math.min(255, color.g * wb.gScale))),
      b: Math.round(Math.max(0, Math.min(255, color.b * wb.bScale))),
    };
  }

  private applyWhiteBalanceBatch(colors: RGB[], wb: WhiteBalance): RGB[] {
    return colors.map((c) => this.applyWhiteBalance(c, wb));
  }

  // ── Skin validation ───────────────────────────────────────────────────

  private isValidSkinColor(color: RGB): boolean {
    const hsv = this.rgbToHsv(color);
    const brightness = this.getBrightness(color);
    // Widened range: 0-100 covers warm/neutral/olive, 300-360 wraps red tones
    return (
      brightness > this.BRIGHTNESS_MIN &&
      brightness < this.BRIGHTNESS_MAX &&
      hsv.s >= this.SKIN_SATURATION_MIN &&
      hsv.s <= this.SKIN_SATURATION_MAX &&
      ((hsv.h >= 0 && hsv.h <= 100) || (hsv.h >= 300 && hsv.h <= 360))
    );
  }

  // ── Sampling helpers ──────────────────────────────────────────────────

  /**
   * Annular ring sampling for iris.
   * Samples pixels between pupilRadius and irisRadius, filtering extremes.
   * No hue-based filtering — LAB clustering handles contamination from skin
   * leak-through. This ensures brown/hazel irises are not mistakenly rejected.
   */
  private sampleIrisRing(
    centerIdx: number,
    boundaryIndices: number[],
    landmarks: NormalizedLandmark[],
  ): RGB[] {
    const center = landmarks[centerIdx]!;
    const cx = center.x * this.canvas.width;
    const cy = center.y * this.canvas.height;

    const distances = boundaryIndices.map((idx) => {
      const p = landmarks[idx]!;
      return Math.sqrt(
        (p.x * this.canvas.width - cx) ** 2 +
        (p.y * this.canvas.height - cy) ** 2,
      );
    });
    const irisRadius = Math.min(...distances);

    const pupilRadius = irisRadius * 0.45;
    const outerRadius = irisRadius * 0.85;
    const r = Math.ceil(outerRadius);
    const colors: RGB[] = [];

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < pupilRadius || dist > outerRadius) continue;

        const x = Math.round(cx + dx);
        const y = Math.round(cy + dy);
        if (x < 0 || x >= this.canvas.width || y < 0 || y >= this.canvas.height) continue;

        const color = this.getPixelColor(x, y);
        const brightness = this.getBrightness(color);
        if (brightness <= this.PUPIL_BRIGHTNESS_THRESHOLD || brightness >= this.BRIGHTNESS_MAX) continue;
        const hsv = this.rgbToHsv(color);
        if (hsv.s < this.IRIS_SATURATION_MIN) continue;
        colors.push(color);
      }
    }
    return colors;
  }

  // Ray-casting point-in-polygon test
  private isPointInPolygon(
    x: number,
    y: number,
    polygon: Array<{ x: number; y: number }>,
  ): boolean {
    let inside = false;
    const n = polygon.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = polygon[i]!.x;
      const yi = polygon[i]!.y;
      const xj = polygon[j]!.x;
      const yj = polygon[j]!.y;
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  // Polygon fill for lips: samples all pixels inside outer lip contour,
  // excluding the mouth opening (teeth area).
  private sampleLipPolygon(landmarks: NormalizedLandmark[]): RGB[] {
    const outerIndices = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
    const innerIndices = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191];

    const toPixel = (idx: number) => ({
      x: landmarks[idx]!.x * this.canvas.width,
      y: landmarks[idx]!.y * this.canvas.height,
    });

    const outerPoly = outerIndices.map(toPixel);
    const innerPoly = innerIndices.map(toPixel);

    const minX = Math.floor(Math.min(...outerPoly.map((p) => p.x)));
    const maxX = Math.ceil(Math.max(...outerPoly.map((p) => p.x)));
    const minY = Math.floor(Math.min(...outerPoly.map((p) => p.y)));
    const maxY = Math.ceil(Math.max(...outerPoly.map((p) => p.y)));

    const colors: RGB[] = [];
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (!this.isPointInPolygon(x, y, outerPoly)) continue;
        if (this.isPointInPolygon(x, y, innerPoly)) continue; // skip teeth
        if (x < 0 || x >= this.canvas.width || y < 0 || y >= this.canvas.height) continue;
        const color = this.getPixelColor(x, y);
        const brightness = this.getBrightness(color);
        if (brightness > 20 && brightness < this.BRIGHTNESS_MAX) {
          colors.push(color);
        }
      }
    }
    return colors;
  }

  // Sample brow colors from MediaPipe brow landmark points
  private sampleBrowColors(landmarks: NormalizedLandmark[]): RGB[] {
    const browIndices = [
      70, 63, 105, 66, 107, 55, 65, 52, 53, 46,
      300, 293, 334, 296, 336, 285, 295, 282, 283, 276,
    ];
    const colors: RGB[] = [];
    browIndices.forEach((index) => {
      const point = landmarks[index]!;
      const samples = this.sampleAreaColors(
        point.x * this.canvas.width,
        point.y * this.canvas.height,
        this.BROW_SAMPLE_RADIUS,
        (color) => {
          const brightness = this.getBrightness(color);
          return brightness > this.BRIGHTNESS_MIN && brightness < this.BRIGHTNESS_MAX;
        },
      );
      colors.push(...samples);
    });
    return colors;
  }

  private sampleAreaColors(
    centerX: number,
    centerY: number,
    radius: number,
    validationFn: (color: RGB) => boolean,
  ): RGB[] {
    const colors: RGB[] = [];
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (dx * dx + dy * dy <= radius * radius) {
          const x = Math.floor(centerX + dx);
          const y = Math.floor(centerY + dy);
          if (x >= 0 && x < this.canvas.width && y >= 0 && y < this.canvas.height) {
            const color = this.getPixelColor(x, y);
            if (validationFn(color)) colors.push(color);
          }
        }
      }
    }
    return colors;
  }

  // ── LAB k-means clustering ────────────────────────────────────────────

  private labDistance(a: Lab, b: Lab): number {
    return Math.sqrt((a.l - b.l) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);
  }

  private kMeansLab(labs: Lab[], k: number): LabCluster[] {
    if (labs.length === 0) return [];
    const n = Math.min(k, labs.length);
    // Sort by lightness for deterministic init
    const sorted = [...labs].sort((a, b) => a.l - b.l);
    const step = Math.max(1, Math.floor(sorted.length / n));
    const centers: Lab[] = Array.from({ length: n }, (_, i) => ({
      ...sorted[Math.min(i * step, sorted.length - 1)]!,
    }));
    const assignments = new Int32Array(labs.length);

    for (let iter = 0; iter < 12; iter++) {
      let changed = false;
      for (let i = 0; i < labs.length; i++) {
        const px = labs[i]!;
        let minD = Infinity;
        let best = 0;
        for (let j = 0; j < n; j++) {
          const c = centers[j]!;
          const d = (px.l - c.l) ** 2 + (px.a - c.a) ** 2 + (px.b - c.b) ** 2;
          if (d < minD) { minD = d; best = j; }
        }
        if (assignments[i] !== best) { assignments[i] = best; changed = true; }
      }
      if (!changed) break;

      const sums = Array.from({ length: n }, () => ({ l: 0, a: 0, b: 0, count: 0 }));
      for (let i = 0; i < labs.length; i++) {
        const px = labs[i]!;
        const s = sums[assignments[i]!]!;
        s.l += px.l; s.a += px.a; s.b += px.b; s.count++;
      }
      for (let j = 0; j < n; j++) {
        const s = sums[j]!;
        if (s.count > 0) {
          centers[j] = { l: s.l / s.count, a: s.a / s.count, b: s.b / s.count };
        }
      }
    }

    const sizes: number[] = new Array(n).fill(0) as number[];
    for (const a of assignments) sizes[a] = (sizes[a] ?? 0) + 1;
    return Array.from({ length: n }, (_, i) => ({
      center: centers[i]!,
      size: sizes[i] ?? 0,
    }))
      .filter((c) => c.size > 0)
      .sort((a, b) => b.size - a.size);
  }

  // ── Color extraction (LAB-based) ─────────────────────────────────────

  /**
   * Iris: pick the largest LAB cluster — the most common iris color.
   * Unlike the old brightness/saturation sort, this does not bias toward
   * unnaturally bright or saturated pixels. Brown eyes stay brown, not golden.
   */
  private getIrisColorLab(colors: RGB[]): RGB {
    if (colors.length === 0) return { r: 128, g: 128, b: 128 };
    if (colors.length < this.MIN_SAMPLES) {
      return this.calculateAverageColor(colors);
    }

    const labs = colors.map((c) => this.rgbToLab(c));
    const clusters = this.kMeansLab(labs, this.NUM_CLUSTERS);
    if (clusters.length === 0) return { r: 128, g: 128, b: 128 };

    // Largest cluster = the dominant iris color
    const dominant = clusters[0]!;
    // Refine: average pixels close to dominant center (ΔE < 25)
    const refined = labs.filter((l) => this.labDistance(l, dominant.center) <= 25);
    if (refined.length < 3) return this.labToRgb(dominant.center);

    const avg = refined.reduce(
      (acc, l) => ({ l: acc.l + l.l, a: acc.a + l.a, b: acc.b + l.b }),
      { l: 0, a: 0, b: 0 },
    );
    return this.labToRgb({
      l: avg.l / refined.length,
      a: avg.a / refined.length,
      b: avg.b / refined.length,
    });
  }

  /**
   * General dominant color via LAB k-means.
   * Used for skin and lips. Picks the largest cluster and refines.
   */
  private getDominantColorLab(colors: RGB[]): RGB {
    if (colors.length === 0) return { r: 128, g: 128, b: 128 };
    if (colors.length < this.MIN_SAMPLES) {
      return this.calculateAverageColor(colors);
    }

    const labs = colors.map((c) => this.rgbToLab(c));
    const clusters = this.kMeansLab(labs, this.NUM_CLUSTERS);
    if (clusters.length === 0) return { r: 128, g: 128, b: 128 };

    const dominant = clusters[0]!;
    const refined = labs.filter((l) => this.labDistance(l, dominant.center) <= 30);
    if (refined.length < 3) return this.labToRgb(dominant.center);

    const avg = refined.reduce(
      (acc, l) => ({ l: acc.l + l.l, a: acc.a + l.a, b: acc.b + l.b }),
      { l: 0, a: 0, b: 0 },
    );
    return this.labToRgb({
      l: avg.l / refined.length,
      a: avg.a / refined.length,
      b: avg.b / refined.length,
    });
  }

  /**
   * Brows: pick the darkest LAB cluster (lowest L*).
   * Brow landmarks often land on skin between hairs. The actual brow color
   * is always darker than surrounding skin.
   */
  private getDarkestClusterColorLab(colors: RGB[]): RGB {
    if (colors.length === 0) return { r: 128, g: 128, b: 128 };
    if (colors.length < this.MIN_SAMPLES) {
      return this.calculateAverageColor(colors);
    }

    const labs = colors.map((c) => this.rgbToLab(c));
    const clusters = this.kMeansLab(labs, this.NUM_CLUSTERS);
    if (clusters.length === 0) return { r: 128, g: 128, b: 128 };

    // Sort by lightness ascending (darkest first)
    clusters.sort((a, b) => a.center.l - b.center.l);
    const minSize = Math.max(3, Math.floor(colors.length * 0.1));
    const darkest = clusters.find((c) => c.size >= minSize) ?? clusters[0]!;

    const refined = labs.filter((l) => this.labDistance(l, darkest.center) <= 25);
    if (refined.length < 3) return this.labToRgb(darkest.center);

    const avg = refined.reduce(
      (acc, l) => ({ l: acc.l + l.l, a: acc.a + l.a, b: acc.b + l.b }),
      { l: 0, a: 0, b: 0 },
    );
    return this.labToRgb({
      l: avg.l / refined.length,
      a: avg.a / refined.length,
      b: avg.b / refined.length,
    });
  }

  // ── Main analysis ─────────────────────────────────────────────────────

  public analyzeFaceColors(landmarks: NormalizedLandmark[]): FaceColors {
    // Step 1: Estimate white balance from sclera (white of eye)
    // Any color cast from lighting is corrected before color extraction
    const scleraColors = this.sampleScleraPixels(landmarks);
    const wb = this.estimateWhiteBalance(scleraColors);

    // Step 2: Sample raw pixels from each facial region
    const leftIrisRaw = this.sampleIrisRing(468, [469, 470, 471, 472], landmarks);
    const rightIrisRaw = this.sampleIrisRing(473, [474, 475, 476, 477], landmarks);
    const lipRaw = this.sampleLipPolygon(landmarks);
    const browRaw = this.sampleBrowColors(landmarks);

    const skinRaw: RGB[] = [];
    const skinIndices = [
      118, 119, 100, 36, 50,
      329, 348, 347, 280, 266,
      151, 108, 69, 109, 10, 338, 297, 337,
      4, 195, 5,
    ];
    skinIndices.forEach((index) => {
      const point = landmarks[index]!;
      const px = point.x * this.canvas.width;
      const py = point.y * this.canvas.height;
      if (px < 0 || px >= this.canvas.width || py < 0 || py >= this.canvas.height) return;
      const samples = this.sampleAreaColors(
        px, py, this.SKIN_SAMPLE_RADIUS,
        this.isValidSkinColor.bind(this),
      );
      skinRaw.push(...samples);
    });

    // Step 3: Apply white balance correction to all sampled pixels
    const leftIrisColors = this.applyWhiteBalanceBatch(leftIrisRaw, wb);
    const rightIrisColors = this.applyWhiteBalanceBatch(rightIrisRaw, wb);
    const lipColors = this.applyWhiteBalanceBatch(lipRaw, wb);
    const browColors = this.applyWhiteBalanceBatch(browRaw, wb);
    const skinColors = this.applyWhiteBalanceBatch(skinRaw, wb);

    // Step 4: Extract colors using perceptually uniform LAB clustering
    const leftIris = this.getIrisColorLab(leftIrisColors);
    const rightIris = this.getIrisColorLab(rightIrisColors);
    const combinedIris = [...leftIrisColors, ...rightIrisColors];
    const eyeColor = this.getIrisColorLab(combinedIris);

    return {
      eyeColor,
      leftIris,
      rightIris,
      lips: this.getDominantColorLab(lipColors),
      skin: this.getDominantColorLab(skinColors),
      brows: this.getDarkestClusterColorLab(browColors),
    };
  }

  public calculateAverageColor(colors: RGB[]): RGB {
    if (colors.length === 0) return { r: 0, g: 0, b: 0 };
    const sum = colors.reduce(
      (acc, color) => ({ r: acc.r + color.r, g: acc.g + color.g, b: acc.b + color.b }),
      { r: 0, g: 0, b: 0 },
    );
    return {
      r: Math.round(sum.r / colors.length),
      g: Math.round(sum.g / colors.length),
      b: Math.round(sum.b / colors.length),
    };
  }
}

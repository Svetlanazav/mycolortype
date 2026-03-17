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

interface ColorCluster {
  colors: RGB[];
  center: RGB;
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
  private readonly PUPIL_BRIGHTNESS_THRESHOLD = 50;
  private readonly IRIS_SATURATION_MIN = 0.10;
  private readonly SKIN_SATURATION_MIN = 0.05;
  private readonly SKIN_SATURATION_MAX = 0.65;
  private readonly BRIGHTNESS_MIN = 25;
  private readonly BRIGHTNESS_MAX = 245;
  private readonly NUM_CLUSTERS = 3;
  private readonly MIN_SAMPLES = 5;

  constructor(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
    this.canvas = canvas;
    this.ctx = context;
  }

  private getPixelColor(x: number, y: number): RGB {
    const pixel = this.ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
    return { r: pixel[0]!, g: pixel[1]!, b: pixel[2]! };
  }

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

  private getBrightness(color: RGB): number {
    return (color.r + color.g + color.b) / 3;
  }

  private isValidSkinColor(color: RGB): boolean {
    const hsv = this.rgbToHsv(color);
    const brightness = this.getBrightness(color);
    // Hue 0–80 covers light/dark skin (warm tones) + wrap-around 330–360
    return (
      brightness > this.BRIGHTNESS_MIN &&
      brightness < this.BRIGHTNESS_MAX &&
      hsv.s >= this.SKIN_SATURATION_MIN &&
      hsv.s <= this.SKIN_SATURATION_MAX &&
      ((hsv.h >= 0 && hsv.h <= 80) ||
        (hsv.h >= 330 && hsv.h <= 360))
    );
  }

  // Annular ring sampling for iris.
  // Samples pixels between pupilRadius and irisRadius, filtering extremes.
  // Correct MediaPipe iris indices:
  //   Left iris:  center=468, perimeter=[469,470,471,472]
  //   Right iris: center=473, perimeter=[474,475,476,477]
  private sampleIrisRing(
    centerIdx: number,
    boundaryIndices: number[],
    landmarks: NormalizedLandmark[],
  ): RGB[] {
    const center = landmarks[centerIdx]!;
    const cx = center.x * this.canvas.width;
    const cy = center.y * this.canvas.height;

    // Use MINIMUM of perimeter distances as iris radius.
    // MediaPipe perimeter includes top/bottom points that can be occluded by eyelids,
    // making them farther from center than the actual iris edge.
    // The minimum distance (usually left or right) is the true iris radius.
    const distances = boundaryIndices.map((idx) => {
      const p = landmarks[idx]!;
      return Math.sqrt(
        (p.x * this.canvas.width - cx) ** 2 +
        (p.y * this.canvas.height - cy) ** 2,
      );
    });
    const irisRadius = Math.min(...distances);

    // Pupil occupies ~45% of iris radius.
    // Use 85% of irisRadius as outer bound to avoid sclera/eyelash contamination.
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
        // Exclude pupil overflow (too dark) and sclera reflections (too bright)
        if (brightness <= this.PUPIL_BRIGHTNESS_THRESHOLD || brightness >= this.BRIGHTNESS_MAX) continue;
        // Exclude near-gray/desaturated pixels (eyelashes, shadows, sclera edge)
        const hsv = this.rgbToHsv(color);
        if (hsv.s < this.IRIS_SATURATION_MIN) continue;
        // Exclude skin-tone pixels (hue 0-50) that leak in from surrounding skin
        if (hsv.h >= 0 && hsv.h <= 50 && hsv.s < 0.4) continue;
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
    // Left brow: 70 63 105 66 107 55 65 52 53 46
    // Right brow: 300 293 334 296 336 285 295 282 283 276
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

  private colorDistance(color1: RGB, color2: RGB): number {
    const rMean = (color1.r + color2.r) / 2;
    const deltaR = color1.r - color2.r;
    const deltaG = color1.g - color2.g;
    const deltaB = color1.b - color2.b;
    return Math.sqrt(
      (2 + rMean / 256) * deltaR * deltaR +
      4 * deltaG * deltaG +
      (2 + (255 - rMean) / 256) * deltaB * deltaB,
    );
  }

  private kMeansClustering(colors: RGB[]): ColorCluster[] {
    if (colors.length < this.MIN_SAMPLES) {
      return colors.length > 0 ? [{ colors, center: colors[0]! }] : [];
    }
    // Deterministic init: pick evenly-spaced samples sorted by brightness
    const sorted = [...colors].sort(
      (a, b) => (a.r + a.g + a.b) - (b.r + b.g + b.b),
    );
    const step = Math.max(1, Math.floor(sorted.length / this.NUM_CLUSTERS));
    const clusters: ColorCluster[] = Array.from({ length: this.NUM_CLUSTERS }, (_, i) => ({
      colors: [],
      center: sorted[Math.min(i * step, sorted.length - 1)]!,
    }));
    let changed = true;
    let iterations = 0;
    while (changed && iterations < 10) {
      changed = false;
      iterations++;
      clusters.forEach((cluster) => (cluster.colors = []));
      colors.forEach((color) => {
        let minDistance = Infinity;
        let nearestCluster = clusters[0]!;
        clusters.forEach((cluster) => {
          const distance = this.colorDistance(color, cluster.center);
          if (distance < minDistance) {
            minDistance = distance;
            nearestCluster = cluster;
          }
        });
        nearestCluster.colors.push(color);
      });
      clusters.forEach((cluster) => {
        if (cluster.colors.length === 0) return;
        const newCenter: RGB = {
          r: Math.round(cluster.colors.reduce((s, c) => s + c.r, 0) / cluster.colors.length),
          g: Math.round(cluster.colors.reduce((s, c) => s + c.g, 0) / cluster.colors.length),
          b: Math.round(cluster.colors.reduce((s, c) => s + c.b, 0) / cluster.colors.length),
        };
        if (this.colorDistance(newCenter, cluster.center) > 1) {
          changed = true;
          cluster.center = newCenter;
        }
      });
    }
    return clusters.filter((c) => c.colors.length > 0);
  }

  private getDominantColor(colors: RGB[]): RGB {
    if (colors.length === 0) return { r: 128, g: 128, b: 128 };

    // Pass 1: find dominant cluster center
    const clusters = this.kMeansClustering(colors);
    clusters.sort((a, b) => b.colors.length - a.colors.length);
    const center = clusters[0]?.center ?? colors[0]!;

    // Pass 2: discard outlier pixels that are too different from the dominant center.
    // Removes black eyelashes inside iris ring, bright skin pixels in brow area, etc.
    const OUTLIER_THRESHOLD = 120;
    const refined = colors.filter(
      (c) => this.colorDistance(c, center) <= OUTLIER_THRESHOLD,
    );
    if (refined.length < 3) return center;

    const sum = refined.reduce(
      (acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b }),
      { r: 0, g: 0, b: 0 },
    );
    return {
      r: Math.round(sum.r / refined.length),
      g: Math.round(sum.g / refined.length),
      b: Math.round(sum.b / refined.length),
    };
  }

  // Brow-specific: pick the darkest cluster.
  // Brow landmarks often land on skin between hairs. The actual brow color
  // is always darker than surrounding skin, so we want the darkest cluster.
  private getDarkestClusterColor(colors: RGB[]): RGB {
    if (colors.length === 0) return { r: 128, g: 128, b: 128 };

    const clusters = this.kMeansClustering(colors);
    // Sort by brightness ascending — darkest first
    clusters.sort(
      (a, b) => this.getBrightness(a.center) - this.getBrightness(b.center),
    );
    // Pick the darkest cluster that has enough pixels (at least 10% of total)
    const minSize = Math.max(3, Math.floor(colors.length * 0.1));
    const darkest = clusters.find((c) => c.colors.length >= minSize) ?? clusters[0]!;

    const sum = darkest.colors.reduce(
      (acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b }),
      { r: 0, g: 0, b: 0 },
    );
    return {
      r: Math.round(sum.r / darkest.colors.length),
      g: Math.round(sum.g / darkest.colors.length),
      b: Math.round(sum.b / darkest.colors.length),
    };
  }

  // Iris-specific: pick the brightest, most saturated pixels.
  // Dark pixels are eyelid shadow falling on the iris — not the true iris color.
  // The visible iris color comes from well-lit pixels with decent saturation.
  private getDominantSaturatedColor(colors: RGB[]): RGB {
    if (colors.length === 0) return { r: 128, g: 128, b: 128 };

    // Step 1: remove the darker 60% — eyelid shadows heavily contaminate the ring
    const byBrightness = [...colors].sort(
      (a, b) => this.getBrightness(b) - this.getBrightness(a),
    );
    const brightPortion = byBrightness.slice(0, Math.max(3, Math.ceil(colors.length * 0.4)));

    // Step 2: from the bright portion, pick the top 50% most-saturated
    const bySaturation = [...brightPortion].sort(
      (a, b) => this.rgbToHsv(b).s - this.rgbToHsv(a).s,
    );
    const topN = Math.max(3, Math.ceil(bySaturation.length * 0.5));
    const top = bySaturation.slice(0, topN);

    const sum = top.reduce(
      (acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b }),
      { r: 0, g: 0, b: 0 },
    );
    return {
      r: Math.round(sum.r / top.length),
      g: Math.round(sum.g / top.length),
      b: Math.round(sum.b / top.length),
    };
  }

  public analyzeFaceColors(landmarks: NormalizedLandmark[]): FaceColors {
    // Left iris: center=468, perimeter=[469,470,471,472]
    const leftIrisColors = this.sampleIrisRing(468, [469, 470, 471, 472], landmarks);
    // Right iris: center=473, perimeter=[474,475,476,477]
    const rightIrisColors = this.sampleIrisRing(473, [474, 475, 476, 477], landmarks);

    // Polygon-fill lips (excludes teeth area automatically)
    const lipColors = this.sampleLipPolygon(landmarks);

    // Brow colors from landmark points
    const browColors = this.sampleBrowColors(landmarks);

    // Skin from cheeks, forehead, nose bridge
    const skinColors: RGB[] = [];
    const skinIndices = [
      118, 119, 100, 36, 50,          // left cheek
      329, 348, 347, 280, 266,         // right cheek
      151, 108, 69, 109, 10, 338, 297, 337, // forehead
      4, 195, 5,                       // nose tip
    ];
    skinIndices.forEach((index) => {
      const point = landmarks[index]!;
      const px = point.x * this.canvas.width;
      const py = point.y * this.canvas.height;
      // Skip landmarks that fall outside the image (e.g. forehead on cropped photos)
      if (px < 0 || px >= this.canvas.width || py < 0 || py >= this.canvas.height) return;
      const samples = this.sampleAreaColors(
        px,
        py,
        this.SKIN_SAMPLE_RADIUS,
        this.isValidSkinColor.bind(this),
      );
      skinColors.push(...samples);
    });

    const leftIris  = this.getDominantSaturatedColor(leftIrisColors);
    const rightIris = this.getDominantSaturatedColor(rightIrisColors);
    // eyeColor: average of both irises using saturation-based selection
    const combinedIris = [...leftIrisColors, ...rightIrisColors];
    const eyeColor = this.getDominantSaturatedColor(combinedIris);

    return {
      eyeColor,
      leftIris,
      rightIris,
      lips:  this.getDominantColor(lipColors),
      skin:  this.getDominantColor(skinColors),
      brows: this.getDarkestClusterColor(browColors),
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

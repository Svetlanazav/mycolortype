import { type NormalizedLandmark } from "@mediapipe/tasks-vision";
import { getIrisColor } from "./asdfasd";

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

  private readonly SKIN_SAMPLE_RADIUS = 5;
  private readonly BROW_SAMPLE_RADIUS = 3;
  private readonly PUPIL_BRIGHTNESS_THRESHOLD = 40;
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
    return (
      brightness > this.BRIGHTNESS_MIN &&
      brightness < this.BRIGHTNESS_MAX &&
      hsv.s >= this.SKIN_SATURATION_MIN &&
      hsv.s <= this.SKIN_SATURATION_MAX &&
      ((hsv.h >= 0 && hsv.h <= 50) ||
        (hsv.h >= 340 && hsv.h <= 360))
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

    const irisRadius = Math.max(
      ...boundaryIndices.map((idx) => {
        const p = landmarks[idx]!;
        return Math.sqrt(
          (p.x * this.canvas.width - cx) ** 2 +
          (p.y * this.canvas.height - cy) ** 2,
        );
      }),
    );

    // Pupil occupies ~38% of iris radius
    const pupilRadius = irisRadius * 0.38;
    const r = Math.ceil(irisRadius);
    const colors: RGB[] = [];

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Only sample the annular ring between pupil and iris edge
        if (dist < pupilRadius || dist > irisRadius) continue;

        const x = Math.round(cx + dx);
        const y = Math.round(cy + dy);
        if (x < 0 || x >= this.canvas.width || y < 0 || y >= this.canvas.height) continue;

        const color = this.getPixelColor(x, y);
        const brightness = this.getBrightness(color);
        // Exclude pupil overflow (too dark) and sclera reflections (too bright)
        if (brightness > this.PUPIL_BRIGHTNESS_THRESHOLD && brightness < this.BRIGHTNESS_MAX) {
          colors.push(color);
        }
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
    const clusters: ColorCluster[] = new Array(this.NUM_CLUSTERS).fill(null).map(() => {
      const randomIndex = Math.floor(Math.random() * colors.length);
      return { colors: [], center: colors[randomIndex]! };
    });
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
    if (colors.length === 0) return { r: 0, g: 0, b: 0 };
    const clusters = this.kMeansClustering(colors);
    clusters.sort((a, b) => b.colors.length - a.colors.length);
    return clusters[0]?.center ?? colors[0]!;
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
      const samples = this.sampleAreaColors(
        point.x * this.canvas.width,
        point.y * this.canvas.height,
        this.SKIN_SAMPLE_RADIUS,
        this.isValidSkinColor.bind(this),
      );
      skinColors.push(...samples);
    });

    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

    return {
      eyeColor: detectEyeColor(imageData, landmarks),
      leftIris: this.getDominantColor(leftIrisColors),
      rightIris: this.getDominantColor(rightIrisColors),
      lips: this.getDominantColor(lipColors),
      skin: this.getDominantColor(skinColors),
      brows: this.getDominantColor(browColors),
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

function detectEyeColor(image: ImageData, landmarks: NormalizedLandmark[]): RGB {
  const irisPoints = [474, 475, 477, 476];
  const boundaryPoints = [385, 386, 380, 374];
  const pupilCenter = 473;
  return getIrisColor(image, landmarks, irisPoints, boundaryPoints, pupilCenter);
}

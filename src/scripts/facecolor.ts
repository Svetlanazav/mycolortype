import {
  DrawingUtils,
  FaceLandmarker,
  type FaceLandmarkerResult,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
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

export class FaceColorAnalyzer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;

  // Feature-specific sampling radii - adjusted for better coverage
  private readonly IRIS_SAMPLE_RADIUS = 3; // Increased for better iris coverage
  private readonly LIPS_SAMPLE_RADIUS = 4; // Increased for better lip color sampling
  private readonly SKIN_SAMPLE_RADIUS = 5; // Increased for better skin tone averaging

  // Color validation thresholds - optimized for each feature
  private readonly PUPIL_BRIGHTNESS_THRESHOLD = 45; // Lowered to better exclude pupil
  private readonly IRIS_SATURATION_THRESHOLD = 0.08; // Lowered to catch lighter eye colors
  private readonly IRIS_SATURATION_MAX = 0.85; // Added to exclude unnatural colors
  private readonly LIPS_SATURATION_MIN = 0.12; // Lowered to catch lighter lip colors
  private readonly LIPS_SATURATION_MAX = 0.95; // Increased for darker lip colors
  private readonly SKIN_SATURATION_MIN = 0.05; // Added for very light skin tones
  private readonly SKIN_SATURATION_MAX = 0.65; // Increased for darker skin tones
  private readonly BRIGHTNESS_MIN = 25; // Lowered for darker skin tones
  private readonly BRIGHTNESS_MAX = 245; // Increased for lighter features

  // Clustering parameters
  private readonly NUM_CLUSTERS = 3;
  private readonly MIN_SAMPLES = 5;

  constructor(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
    this.canvas = canvas;
    this.ctx = context;
  }

  private getPixelColor(x: number, y: number): RGB {
    const pixel = this.ctx.getImageData(
      Math.floor(x),
      Math.floor(y),
      1,
      1
    ).data;
    return {
      r: pixel[0]!,
      g: pixel[1]!,
      b: pixel[2]!,
    };
  }

  private rgbToHsv(color: RGB): HSV {
    const r = color.r / 255;
    const g = color.g / 255;
    const b = color.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;

    let h = 0;
    if (diff === 0) {
      h = 0;
    } else if (max === r) {
      h = ((g - b) / diff) % 6;
    } else if (max === g) {
      h = (b - r) / diff + 2;
    } else {
      h = (r - g) / diff + 4;
    }

    h = Math.round(h * 60);
    if (h < 0) h += 360;

    const s = max === 0 ? 0 : diff / max;
    const v = max;

    return { h, s, v };
  }

  private getBrightness(color: RGB): number {
    return (color.r + color.g + color.b) / 3;
  }

  private isValidIrisColor(color: RGB): boolean {
    const hsv = this.rgbToHsv(color);
    const brightness = this.getBrightness(color);

    // Enhanced iris color validation
    return (
      brightness > this.PUPIL_BRIGHTNESS_THRESHOLD &&
      brightness < this.BRIGHTNESS_MAX &&
      hsv.s > this.IRIS_SATURATION_THRESHOLD &&
      hsv.s < this.IRIS_SATURATION_MAX &&
      // Common eye color hue ranges (blue, green, brown, hazel)
      ((hsv.h >= 180 && hsv.h <= 240) || // Blue range
        (hsv.h >= 60 && hsv.h <= 140) || // Green range
        (hsv.h >= 20 && hsv.h <= 40)) // Brown/Hazel range
    );
  }

  private isValidLipColor(color: RGB): boolean {
    const hsv = this.rgbToHsv(color);
    const brightness = this.getBrightness(color);

    // Enhanced lip color validation
    return (
      brightness > this.BRIGHTNESS_MIN &&
      brightness < this.BRIGHTNESS_MAX &&
      hsv.s >= this.LIPS_SATURATION_MIN &&
      hsv.s <= this.LIPS_SATURATION_MAX &&
      // Natural lip color hue ranges
      (hsv.h >= 350 ||
        hsv.h <= 10 || // Red range
        (hsv.h >= 0 && hsv.h <= 40)) // Pink/Peach range
    );
  }

  private isValidSkinColor(color: RGB): boolean {
    const hsv = this.rgbToHsv(color);
    const brightness = this.getBrightness(color);

    // Enhanced skin tone validation
    return (
      brightness > this.BRIGHTNESS_MIN &&
      brightness < this.BRIGHTNESS_MAX &&
      hsv.s >= this.SKIN_SATURATION_MIN &&
      hsv.s <= this.SKIN_SATURATION_MAX &&
      // Enhanced skin tone hue ranges for better diversity
      ((hsv.h >= 0 && hsv.h <= 50) || // Warm undertones
        (hsv.h >= 340 && hsv.h <= 360) || // Cool undertones
        (hsv.h >= 20 && hsv.h <= 40)) // Neutral undertones
    );
  }

  private colorDistance(color1: RGB, color2: RGB): number {
    // Using CIE76 color difference formula
    const rMean = (color1.r + color2.r) / 2;
    const deltaR = color1.r - color2.r;
    const deltaG = color1.g - color2.g;
    const deltaB = color1.b - color2.b;

    return Math.sqrt(
      (2 + rMean / 256) * deltaR * deltaR +
        4 * deltaG * deltaG +
        (2 + (255 - rMean) / 256) * deltaB * deltaB
    );
  }

  private sampleAreaColors(
    centerX: number,
    centerY: number,
    radius: number,
    validationFn: (color: RGB) => boolean
  ): RGB[] {
    let colors: RGB[] = [];

    // Sample in a circular pattern
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (dx * dx + dy * dy <= radius * radius) {
          const x = Math.floor(centerX + dx);
          const y = Math.floor(centerY + dy);

          if (
            x >= 0 &&
            x < this.canvas.width &&
            y >= 0 &&
            y < this.canvas.height
          ) {
            const color = this.getPixelColor(x, y);
            if (validationFn(color)) {
              colors.push(color);
            }
          }
        }
      }
    }

    return colors;
  }

  private kMeansClustering(colors: RGB[]): ColorCluster[] {
    if (colors.length < this.MIN_SAMPLES) {
      return colors.length > 0
        ? [
            {
              colors: colors,
              center: colors[0]!,
            },
          ]
        : [];
    }

    let clusters: ColorCluster[] = new Array(this.NUM_CLUSTERS)
      .fill(null)
      .map(() => {
        const randomIndex = Math.floor(Math.random() * colors.length);
        return {
          colors: [],
          center: colors[randomIndex]!,
        };
      });

    let changed = true;
    const MAX_ITERATIONS = 10;
    let iterations = 0;

    while (changed && iterations < MAX_ITERATIONS) {
      changed = false;
      iterations++;

      clusters.forEach((cluster) => (cluster.colors = []));

      colors.forEach((color) => {
        let minDistance = Infinity;
        let nearestCluster = clusters[0];

        clusters.forEach((cluster) => {
          const distance = this.colorDistance(color, cluster.center);
          if (distance < minDistance) {
            minDistance = distance;
            nearestCluster = cluster;
          }
        });

        nearestCluster!.colors.push(color);
      });

      clusters.forEach((cluster) => {
        if (cluster.colors.length === 0) return;

        const newCenter: RGB = {
          r: Math.round(
            cluster.colors.reduce((sum, c) => sum + c.r, 0) /
              cluster.colors.length
          ),
          g: Math.round(
            cluster.colors.reduce((sum, c) => sum + c.g, 0) /
              cluster.colors.length
          ),
          b: Math.round(
            cluster.colors.reduce((sum, c) => sum + c.b, 0) /
              cluster.colors.length
          ),
        };

        if (this.colorDistance(newCenter, cluster.center) > 1) {
          changed = true;
          cluster.center = newCenter;
        }
      });
    }

    return clusters.filter((cluster) => cluster.colors.length > 0);
  }

  private getDominantColor(colors: RGB[]): RGB {
    if (colors.length === 0) {
      return { r: 0, g: 0, b: 0 };
    }

    const clusters = this.kMeansClustering(colors);
    clusters.sort((a, b) => b.colors.length - a.colors.length);
    return clusters[0]!?.center || colors[0];
  }

  public analyzeFaceColors(landmarks: NormalizedLandmark[]): {
    leftIris: RGB;
    rightIris: RGB;
    lips: RGB;
    skin: RGB;
    eyeColor: RGB;
  } {
    // Initialize color arrays
    const leftIrisColors: RGB[] = [];
    const rightIrisColors: RGB[] = this.getIrisColors(landmarks);
    const lipColors: RGB[] = [];
    const skinColors: RGB[] = [];

    // Sample iris colors from outer edges
    const leftIrisOuterIndices = [145, 153, 469, 158];
    leftIrisOuterIndices.forEach((index) => {
      const point = landmarks[index]!;
      const samples = this.sampleAreaColors(
        point.x * this.canvas.width,
        point.y * this.canvas.height,
        this.IRIS_SAMPLE_RADIUS,
        this.isValidIrisColor.bind(this)
      );
      leftIrisColors.push(...samples);
    });
    // вычислить точку между двумя точками x i y

    // const rightIrisOuterIndices = [385, 476, 476, 477, 477, 474];
    // rightIrisOuterIndices.forEach((index) => {
    //   const point = landmarks[index]!;
    //   const samples = this.sampleAreaColors(
    //     point.x * this.canvas.width,
    //     point.y * this.canvas.height,
    //     this.IRIS_SAMPLE_RADIUS,
    //     this.isValidIrisColor.bind(this)
    //   );
    //   rightIrisColors.push(...samples);
    // });

    const draw = new DrawingUtils(this.ctx);
    // draw.drawConnectors(
    //   landmarks,
    //   rightIrisOuterIndices
    //     .map((x, i, a) => ({ start: x, end: a[i + 1]! }))
    //     .filter((x) => x.end),
    //   {
    //     color: "red",
    //   }
    // );
    draw.drawConnectors(
      landmarks,
      leftIrisOuterIndices
        .map((x, i, a) => ({ start: x, end: a[i + 1]! }))
        .filter((x) => x.end),
      {
        color: "green",
      }
    );

    // Sample lip colors - using specific points for better coverage
    const lipIndices = [
      0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61,
      185, 40, 39, 37, 87, 13, 14, 317, 402, 318, 324, 308,
    ];
    lipIndices.forEach((index) => {
      const point = landmarks[index]!;
      const samples = this.sampleAreaColors(
        point.x * this.canvas.width,
        point.y * this.canvas.height,
        this.LIPS_SAMPLE_RADIUS,
        this.isValidLipColor.bind(this)
      );
      lipColors.push(...samples);
    });

    // Sample skin colors from cheeks and forehead
    const skinIndices = [
      // Left cheek
      118, 119, 100, 100, 36, 50,
      // Right cheek
      329, 348, 347, 280, 266, 330, 329,
      // Forehead
      151, 108, 69, 67, 109, 10, 338, 297, 299, 337,
      // Nose
      4, 51, 195, 281, 5,
    ];
    skinIndices.forEach((index) => {
      const point = landmarks[index]!;
      const samples = this.sampleAreaColors(
        point.x * this.canvas.width,
        point.y * this.canvas.height,
        this.SKIN_SAMPLE_RADIUS,
        this.isValidSkinColor.bind(this)
      );
      skinColors.push(...samples);
    });

    let imageData = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );
    // Get dominant colors for each feature
    return {
      eyeColor: detectEyeColor(imageData, landmarks),
      leftIris: this.getDominantColor(leftIrisColors),
      rightIris: this.getDominantColor(rightIrisColors),
      lips: this.getDominantColor(lipColors),
      skin: this.getDominantColor(skinColors),
    };
  }

  private calculateMidpoint(
    point1: { x: number; y: number },
    point2: { x: number; y: number }
  ): { x: number; y: number } {
    return {
      x: (point1.x + point2.x) / 2,
      y: (point1.y + point2.y) / 2,
    };
  }

  public getIrisColors(landmarks: NormalizedLandmark[]): RGB[] {
    const rightIrisColors: RGB[] = [];

    // Define pairs of points for midpoint calculation
    const rightIrisIndicesWithMidpoints = [
      [385, 476], // Sample 385 and midpoint between 385-476
      [476, 477], // Sample 476 and midpoint between 476-477
      [477, 474], // Sample 477 and midpoint between 477-474
      [474], // Sample 474 alone
    ] as const;

    rightIrisIndicesWithMidpoints.forEach(([pointIndex, midpointWithIndex]) => {
      // Sample from the main point
      const point = landmarks[pointIndex]!;
      const samples = this.sampleAreaColors(
        point.x * this.canvas.width,
        point.y * this.canvas.height,
        this.IRIS_SAMPLE_RADIUS,
        this.isValidIrisColor.bind(this)
      );
      rightIrisColors.push(...samples);

      // If there's a second point to create midpoint with
      if (midpointWithIndex !== undefined) {
        const point2 = landmarks[midpointWithIndex]!;
        const midpoint = this.calculateMidpoint(point, point2);

        // Sample from the midpoint
        const midpointSamples = this.sampleAreaColors(
          midpoint.x * this.canvas.width,
          midpoint.y * this.canvas.height,
          this.IRIS_SAMPLE_RADIUS,
          this.isValidIrisColor.bind(this)
        );
        rightIrisColors.push(...midpointSamples);
      }
    });

    return rightIrisColors;
  }

  public calculateAverageColor(colors: RGB[]): RGB {
    if (colors.length === 0) {
      return { r: 0, g: 0, b: 0 };
    }

    const sum = colors.reduce(
      (acc, color) => ({
        r: acc.r + color.r,
        g: acc.g + color.g,
        b: acc.b + color.b,
      }),
      { r: 0, g: 0, b: 0 }
    );

    return {
      r: Math.round(sum.r / colors.length),
      g: Math.round(sum.g / colors.length),
      b: Math.round(sum.b / colors.length),
    };
  }
}

function detectEyeColor(
  image: ImageData,
  landmarks: NormalizedLandmark[]
): RGB {
  const irisPoints = [474, 475, 477, 476]; // Right iris landmarks
  const boundaryPoints = [385, 386, 380, 374]; // Upper boundary points
  const pupilCenter = 473; // Pupil center landmark

  return getIrisColor(
    image,
    landmarks,
    irisPoints,
    boundaryPoints,
    pupilCenter
  );
}

import {
  DrawingUtils,
  FaceLandmarker,
  type FaceLandmarkerResult,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";

// interface RGB {
//   r: number;
//   g: number;
//   b: number;
// }

// interface ColorStats {
//   averageColor: RGB;
//   sampleCount: number;
// }

// export class FaceColorAnalyzer {
//   private readonly ctx: CanvasRenderingContext2D;
//   private readonly canvas: HTMLCanvasElement;

//   // Threshold for excluding extreme colors (0-255)
//   private readonly BRIGHTNESS_THRESHOLD = 30; // for dark colors
//   private readonly DARKNESS_THRESHOLD = 225; // for bright colors

//   // Sample radius around each landmark point
//   private readonly SAMPLE_RADIUS = 2;

//   constructor(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
//     this.canvas = canvas;
//     this.ctx = context;
//   }

//   private isValidColor(color: RGB): boolean {
//     // Check if the color is too dark or too bright
//     const brightness = (color.r + color.g + color.b) / 3;
//     return (
//       brightness > this.BRIGHTNESS_THRESHOLD &&
//       brightness < this.DARKNESS_THRESHOLD
//     );
//   }

//   private getPixelColor(x: number, y: number): RGB {
//     const pixel = this.ctx.getImageData(
//       Math.floor(x),
//       Math.floor(y),
//       1,
//       1
//     ).data;
//     return {
//       r: pixel[0]!,
//       g: pixel[1]!,
//       b: pixel[2]!,
//     };
//   }

//   private sampleAreaColors(centerX: number, centerY: number): ColorStats {
//     let validColors: RGB[] = [];

//     // Sample pixels in a square around the center point
//     for (let dx = -this.SAMPLE_RADIUS; dx <= this.SAMPLE_RADIUS; dx++) {
//       for (let dy = -this.SAMPLE_RADIUS; dy <= this.SAMPLE_RADIUS; dy++) {
//         const x = centerX + dx;
//         const y = centerY + dy;

//         // Ensure we're within canvas bounds
//         if (
//           x >= 0 &&
//           x < this.canvas.width &&
//           y >= 0 &&
//           y < this.canvas.height
//         ) {
//           const color = this.getPixelColor(x, y);
//           if (this.isValidColor(color)) {
//             validColors.push(color);
//           }
//         }
//       }
//     }

//     // Calculate average color from valid samples
//     const averageColor = validColors.reduce(
//       (acc, color) => ({
//         r: acc.r + color.r / validColors.length,
//         g: acc.g + color.g / validColors.length,
//         b: acc.b + color.b / validColors.length,
//       }),
//       { r: 0, g: 0, b: 0 }
//     );

//     return {
//       averageColor,
//       sampleCount: validColors.length,
//     };
//   }

//   public analyzeFaceColors(landmarks: any): {
//     leftIris: RGB;
//     rightIris: RGB;
//     lips: RGB;
//     skin: RGB;
//   } {
//     // Calculate average colors for each facial feature
//     const leftIrisColors = FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS.map(
//       ({ start, end }) => {
//         const point = landmarks[start];
//         return this.sampleAreaColors(
//           point.x * this.canvas.width,
//           point.y * this.canvas.height
//         );
//       }
//     ).filter((stats) => stats.sampleCount > 0);

//     const rightIrisColors = FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS.map(
//       ({ start, end }) => {
//         const point = landmarks[start];
//         return this.sampleAreaColors(
//           point.x * this.canvas.width,
//           point.y * this.canvas.height
//         );
//       }
//     ).filter((stats) => stats.sampleCount > 0);

//     const lipColors = FaceLandmarker.FACE_LANDMARKS_LIPS.map(
//       ({ start, end }) => {
//         const point = landmarks[start];
//         return this.sampleAreaColors(
//           point.x * this.canvas.width,
//           point.y * this.canvas.height
//         );
//       }
//     ).filter((stats) => stats.sampleCount > 0);

//     // For skin color, sample from specific face oval points while avoiding eyes and lips areas
//     const skinLandmarks = FaceLandmarker.FACE_LANDMARKS_FACE_OVAL.filter(
//       ({ start, end }) => {
//         // Add logic here to exclude points near eyes and lips
//         // This is a simplified version - you might want to add more sophisticated filtering
//         const point = landmarks[start];
//         const y = point.y * this.canvas.height;
//         return y > this.canvas.height * 0.4 && y < this.canvas.height * 0.7;
//       }
//     );

//     const skinColors = skinLandmarks
//       .map(({ start, end }) => {
//         const point = landmarks[start];
//         return this.sampleAreaColors(
//           point.x * this.canvas.width,
//           point.y * this.canvas.height
//         );
//       })
//       .filter((stats) => stats.sampleCount > 0);

//     // Calculate final average colors
//     const averageColor = (colors: ColorStats[]): RGB => ({
//       r:
//         colors.reduce(
//           (sum, stat) => sum + stat.averageColor.r * stat.sampleCount,
//           0
//         ) / colors.reduce((sum, stat) => sum + stat.sampleCount, 0),
//       g:
//         colors.reduce(
//           (sum, stat) => sum + stat.averageColor.g * stat.sampleCount,
//           0
//         ) / colors.reduce((sum, stat) => sum + stat.sampleCount, 0),
//       b:
//         colors.reduce(
//           (sum, stat) => sum + stat.averageColor.b * stat.sampleCount,
//           0
//         ) / colors.reduce((sum, stat) => sum + stat.sampleCount, 0),
//     });

//     return {
//       leftIris: averageColor(leftIrisColors),
//       rightIris: averageColor(rightIrisColors),
//       lips: averageColor(lipColors),
//       skin: averageColor(skinColors),
//     };
//   }
// }

// interface RGB {
//   r: number;
//   g: number;
//   b: number;
// }

// interface ColorCluster {
//   colors: RGB[];
//   center: RGB;
// }

// export class FaceColorAnalyzer {
//   private readonly ctx: CanvasRenderingContext2D;
//   private readonly canvas: HTMLCanvasElement;

//   // Increased sample radius for better color collection
//   private readonly SAMPLE_RADIUS = 3;

//   // Number of clusters for k-means
//   private readonly NUM_CLUSTERS = 3;

//   // Minimum number of samples needed for valid analysis
//   private readonly MIN_SAMPLES = 5;

//   constructor(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
//     this.canvas = canvas;
//     this.ctx = context;
//   }

//   private getPixelColor(x: number, y: number): RGB {
//     const pixel = this.ctx.getImageData(
//       Math.floor(x),
//       Math.floor(y),
//       1,
//       1
//     ).data;
//     return {
//       r: pixel[0]!,
//       g: pixel[1]!,
//       b: pixel[2]!,
//     };
//   }

//   private colorDistance(color1: RGB, color2: RGB): number {
//     // Using CIE76 color difference formula for better accuracy
//     const rMean = (color1.r + color2.r) / 2;
//     const deltaR = color1.r - color2.r;
//     const deltaG = color1.g - color2.g;
//     const deltaB = color1.b - color2.b;

//     return Math.sqrt(
//       (2 + rMean / 256) * deltaR * deltaR +
//         4 * deltaG * deltaG +
//         (2 + (255 - rMean) / 256) * deltaB * deltaB
//     );
//   }

//   private kMeansClustering(colors: RGB[]): ColorCluster[] {
//     if (colors.length < this.MIN_SAMPLES) {
//       return [
//         {
//           colors: colors,
//           center: colors[0]!,
//         },
//       ];
//     }

//     // Initialize clusters with random centers
//     let clusters: ColorCluster[] = Array(this.NUM_CLUSTERS)
//       .fill(null)
//       .map(() => {
//         const randomIndex = Math.floor(Math.random() * colors.length);
//         return {
//           colors: [],
//           center: colors[randomIndex],
//         };
//       });

//     let changed = true;
//     const MAX_ITERATIONS = 10;
//     let iterations = 0;

//     while (changed && iterations < MAX_ITERATIONS) {
//       changed = false;
//       iterations++;

//       // Reset clusters
//       clusters.forEach((cluster) => (cluster.colors = []));

//       // Assign colors to nearest cluster
//       colors.forEach((color) => {
//         let minDistance = Infinity;
//         let nearestCluster = clusters[0];

//         clusters.forEach((cluster) => {
//           const distance = this.colorDistance(color, cluster.center);
//           if (distance < minDistance) {
//             minDistance = distance;
//             nearestCluster = cluster;
//           }
//         });

//         nearestCluster!.colors.push(color);
//       });

//       // Update cluster centers
//       clusters.forEach((cluster) => {
//         if (cluster.colors.length === 0) return;

//         const newCenter: RGB = {
//           r: Math.round(
//             cluster.colors.reduce((sum, c) => sum + c.r, 0) /
//               cluster.colors.length
//           ),
//           g: Math.round(
//             cluster.colors.reduce((sum, c) => sum + c.g, 0) /
//               cluster.colors.length
//           ),
//           b: Math.round(
//             cluster.colors.reduce((sum, c) => sum + c.b, 0) /
//               cluster.colors.length
//           ),
//         };

//         if (this.colorDistance(newCenter, cluster.center) > 1) {
//           changed = true;
//           cluster.center = newCenter;
//         }
//       });
//     }

//     // Filter out empty clusters
//     return clusters.filter((cluster) => cluster.colors.length > 0);
//   }

//   private getDominantColor(colors: RGB[]): RGB {
//     if (colors.length === 0) {
//       return { r: 0, g: 0, b: 0 };
//     }

//     const clusters = this.kMeansClustering(colors);

//     // Sort clusters by size and pick the largest one
//     clusters.sort((a, b) => b.colors.length - a.colors.length);

//     // Return the center of the largest cluster
//     return clusters[0]!.center;
//   }

//   private sampleAreaColors(centerX: number, centerY: number): RGB[] {
//     let colors: RGB[] = [];

//     // Sample in a circular pattern for better coverage
//     for (let dx = -this.SAMPLE_RADIUS; dx <= this.SAMPLE_RADIUS; dx++) {
//       for (let dy = -this.SAMPLE_RADIUS; dy <= this.SAMPLE_RADIUS; dy++) {
//         // Check if point is within circular radius
//         if (dx * dx + dy * dy <= this.SAMPLE_RADIUS * this.SAMPLE_RADIUS) {
//           const x = Math.floor(centerX + dx);
//           const y = Math.floor(centerY + dy);

//           if (
//             x >= 0 &&
//             x < this.canvas.width &&
//             y >= 0 &&
//             y < this.canvas.height
//           ) {
//             colors.push(this.getPixelColor(x, y));
//           }
//         }
//       }
//     }

//     return colors;
//   }

//   public analyzeFaceColors(landmarks: any): {
//     leftIris: RGB;
//     rightIris: RGB;
//     lips: RGB;
//     skin: RGB;
//   } {
//     // Collect color samples for each feature
//     const leftIrisColors: RGB[] = [];
//     const rightIrisColors: RGB[] = [];
//     const lipColors: RGB[] = [];
//     const skinColors: RGB[] = [];

//     // Sample iris colors - using specific iris landmark indices
//     const leftIrisIndices = [468, 469, 470, 471, 472]; // MediaPipe left iris landmarks
//     leftIrisIndices.forEach((index) => {
//       const point = landmarks[index];
//       leftIrisColors.push(
//         ...this.sampleAreaColors(
//           point.x * this.canvas.width,
//           point.y * this.canvas.height
//         )
//       );
//     });

//     const rightIrisIndices = [473, 474, 475, 476, 477]; // MediaPipe right iris landmarks
//     rightIrisIndices.forEach((index) => {
//       const point = landmarks[index];
//       rightIrisColors.push(
//         ...this.sampleAreaColors(
//           point.x * this.canvas.width,
//           point.y * this.canvas.height
//         )
//       );
//     });

//     // Sample lip colors - using specific lip landmark indices
//     const lipIndices = [
//       0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61,
//       185, 40, 39, 37,
//     ]; // MediaPipe lip landmarks
//     lipIndices.forEach((index) => {
//       const point = landmarks[index];
//       lipColors.push(
//         ...this.sampleAreaColors(
//           point.x * this.canvas.width,
//           point.y * this.canvas.height
//         )
//       );
//     });

//     // Sample skin colors from cheek areas
//     // Using specific indices for cheeks to avoid shadows and other features
//     const cheekIndices = [
//       93,
//       132,
//       58,
//       172,
//       136,
//       150,
//       149,
//       176,
//       148,
//       152, // Adjust these indices based on MediaPipe face mesh
//     ];

//     cheekIndices.forEach((index) => {
//       const point = landmarks[index];
//       skinColors.push(
//         ...this.sampleAreaColors(
//           point.x * this.canvas.width,
//           point.y * this.canvas.height
//         )
//       );
//     });

//     return {
//       leftIris: this.getDominantColor(leftIrisColors),
//       rightIris: this.getDominantColor(rightIrisColors),
//       lips: this.getDominantColor(lipColors),
//       skin: this.getDominantColor(skinColors),
//     };
//   }
// }

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
              center: colors[0],
            },
          ]
        : [];
    }

    let clusters: ColorCluster[] = Array(this.NUM_CLUSTERS)
      .fill(null)
      .map(() => {
        const randomIndex = Math.floor(Math.random() * colors.length);
        return {
          colors: [],
          center: colors[randomIndex],
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
  } {
    // Initialize color arrays
    const leftIrisColors: RGB[] = [];
    const rightIrisColors: RGB[] = [];
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

    const rightIrisOuterIndices = [384, 380, 374, 385];
    rightIrisOuterIndices.forEach((index) => {
      const point = landmarks[index]!;
      const samples = this.sampleAreaColors(
        point.x * this.canvas.width,
        point.y * this.canvas.height,
        this.IRIS_SAMPLE_RADIUS,
        this.isValidIrisColor.bind(this)
      );
      rightIrisColors.push(...samples);
    });

    const draw = new DrawingUtils(this.ctx);
    draw.drawConnectors(
      landmarks,
      rightIrisOuterIndices
        .map((x, i, a) => ({ start: x, end: a[i + 1]! }))
        .filter((x) => x.end),
      {
        color: "red",
      }
    );
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
      const point = landmarks[index];
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
      const point = landmarks[index];
      const samples = this.sampleAreaColors(
        point.x * this.canvas.width,
        point.y * this.canvas.height,
        this.SKIN_SAMPLE_RADIUS,
        this.isValidSkinColor.bind(this)
      );
      skinColors.push(...samples);
    });

    // Get dominant colors for each feature
    return {
      leftIris: this.getDominantColor(leftIrisColors),
      rightIris: this.getDominantColor(rightIrisColors),
      lips: this.getDominantColor(lipColors),
      skin: this.getDominantColor(skinColors),
    };
  }

  // Debug method to visualize sampling points
  public debugSamplingPoints(
    landmarks: any,
    ctx: CanvasRenderingContext2D
  ): void {
    const drawPoint = (x: number, y: number, color: string) => {
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    };

    // Draw iris points
    [468, 469, 471, 472].forEach((index) => {
      const point = landmarks[index];
      drawPoint(
        point.x * this.canvas.width,
        point.y * this.canvas.height,
        "blue"
      );
    });

    // Draw lip points
    [0, 267, 269, 270, 409, 291, 375, 321, 405, 314].forEach((index) => {
      const point = landmarks[index];
      drawPoint(
        point.x * this.canvas.width,
        point.y * this.canvas.height,
        "red"
      );
    });

    // Draw skin points
    [123, 147, 187, 205, 36, 356, 389, 367, 397, 435].forEach((index) => {
      const point = landmarks[index];
      drawPoint(
        point.x * this.canvas.width,
        point.y * this.canvas.height,
        "green"
      );
    });
  }
}

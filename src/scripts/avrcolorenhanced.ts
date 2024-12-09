import { ImageSegmenterResult } from "@mediapipe/tasks-vision";

interface HSL {
  h: number;
  s: number;
  l: number;
}

interface Lab {
  l: number;
  a: number;
  b: number;
}

// Enhance the existing RGB interface with conversion methods
interface RGB {
  r: number;
  g: number;
  b: number;
}

// Add confidence scores to color analysis
export interface ColorAnalysis {
  color: RGB;
  confidence: number;
  shadowPercentage: number;
  colorSpace: {
    rgb: RGB;
    hsl: HSL;
    lab: Lab;
  };
}

export interface EnhancedCategoryColors {
  hair: ColorAnalysis;
  bodySkin: ColorAnalysis;
  faceSkin: ColorAnalysis;
  clothes: ColorAnalysis;
  others: ColorAnalysis;
}

// Advanced shadow detection using multiple techniques
function detectShadows(
  pixels: RGB[],
  avgColor: RGB
): {
  shadowPixels: RGB[];
  nonShadowPixels: RGB[];
  shadowPercentage: number;
} {
  const brightnessTolerance = 0.3;
  const saturationTolerance = 0.2;
  const avgBrightness = calculateBrightness(avgColor);
  const avgHSL = rgbToHSL(avgColor);

  const shadowPixels: RGB[] = [];
  const nonShadowPixels: RGB[] = [];

  pixels.forEach((pixel) => {
    const pixelHSL = rgbToHSL(pixel);
    const pixelBrightness = calculateBrightness(pixel);

    // Multiple shadow detection criteria
    const isShadow =
      pixelBrightness < avgBrightness * (1 - brightnessTolerance) ||
      (pixelHSL.s > avgHSL.s * (1 + saturationTolerance) &&
        pixelHSL.l < avgHSL.l * (1 - brightnessTolerance)) ||
      (Math.abs(pixelHSL.h - avgHSL.h) < 15 &&
        pixelHSL.l < avgHSL.l * (1 - brightnessTolerance));

    if (isShadow) {
      shadowPixels.push(pixel);
    } else {
      nonShadowPixels.push(pixel);
    }
  });

  return {
    shadowPixels,
    nonShadowPixels,
    shadowPercentage: (shadowPixels.length / pixels.length) * 100,
  };
}

// Utility functions for color calculations
function calculateBrightness(color: RGB): number {
  return (color.r + color.g + color.b) / 3;
}

function calculateSaturation(color: RGB): number {
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);
  return max === 0 ? 0 : (max - min) / max;
}

function colorDistance(c1: RGB, c2: RGB): number {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
      Math.pow(c1.g - c2.g, 2) +
      Math.pow(c1.b - c2.b, 2)
  );
}

// Color space conversion functions
function rgbToHSL(rgb: RGB): HSL {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (diff !== 0) {
    s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / diff + (g < b ? 6 : 0)) * 60;
        break;
      case g:
        h = ((b - r) / diff + 2) * 60;
        break;
      case b:
        h = ((r - g) / diff + 4) * 60;
        break;
    }
  }

  return { h, s, l };
}

function rgbToLab(rgb: RGB): Lab {
  // Convert RGB to XYZ
  let r = rgb.r / 255;
  let g = rgb.g / 255;
  let b = rgb.b / 255;

  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) * 100;
  const y = (r * 0.2126 + g * 0.7152 + b * 0.0722) * 100;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) * 100;

  // Convert XYZ to Lab
  const xn = 95.047;
  const yn = 100.0;
  const zn = 108.883;

  const fx =
    x / xn > 0.008856 ? Math.pow(x / xn, 1 / 3) : (7.787 * x) / xn + 16 / 116;
  const fy =
    y / yn > 0.008856 ? Math.pow(y / yn, 1 / 3) : (7.787 * y) / yn + 16 / 116;
  const fz =
    z / zn > 0.008856 ? Math.pow(z / zn, 1 / 3) : (7.787 * z) / zn + 16 / 116;

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

// Enhanced color analysis with confidence scoring
function analyzeCategoryColorEnhanced(
  pixels: RGB[],
  category: string
): ColorAnalysis {
  if (pixels.length === 0) {
    return {
      color: { r: 0, g: 0, b: 0 },
      confidence: 0,
      shadowPercentage: 0,
      colorSpace: {
        rgb: { r: 0, g: 0, b: 0 },
        hsl: { h: 0, s: 0, l: 0 },
        lab: { l: 0, a: 0, b: 0 },
      },
    };
  }

  const avgColor = calculateAverageColor(pixels);
  const { shadowPixels, nonShadowPixels, shadowPercentage } = detectShadows(
    pixels,
    avgColor
  );
  const dominantColors = findDominantColors(nonShadowPixels, 3);

  let selectedColor: RGB;
  let confidence: number;

  switch (category) {
    case "faceSkin":
    case "bodySkin":
      selectedColor = analyzeSkinColor(nonShadowPixels, dominantColors);
      confidence = calculateSkinConfidence(selectedColor, shadowPercentage);
      break;
    case "hair":
      selectedColor = analyzeHairColor(nonShadowPixels, dominantColors);
      confidence = calculateHairConfidence(selectedColor, shadowPercentage);
      break;
    case "clothes":
      selectedColor = analyzeClothesColor(nonShadowPixels, dominantColors);
      confidence = calculateClothesConfidence(selectedColor, shadowPercentage);
      break;
    default:
      selectedColor = avgColor;
      confidence = 0.5;
  }

  return {
    color: selectedColor,
    confidence,
    shadowPercentage,
    colorSpace: {
      rgb: selectedColor,
      hsl: rgbToHSL(selectedColor),
      lab: rgbToLab(selectedColor),
    },
  };
}

// Confidence calculation functions
function calculateSkinConfidence(color: RGB, shadowPercentage: number): number {
  const hsl = rgbToHSL(color);
  const inSkinToneRange =
    hsl.h >= 0 &&
    hsl.h <= 50 && // Hue range for skin tones
    hsl.s >= 0.2 &&
    hsl.s <= 0.6 && // Saturation range for skin
    hsl.l >= 0.4 &&
    hsl.l <= 0.8; // Lightness range for skin

  const shadowPenalty = shadowPercentage > 30 ? 0.2 : 0;

  return inSkinToneRange ? Math.max(0, Math.min(1, 1 - shadowPenalty)) : 0.5;
}

function calculateHairConfidence(color: RGB, shadowPercentage: number): number {
  const hsl = rgbToHSL(color);
  const naturalHairColor =
    (hsl.h >= 0 && hsl.h <= 60) || // Brown/blonde range
    (hsl.h >= 330 && hsl.h <= 360); // Red range

  const shadowPenalty = shadowPercentage > 40 ? 0.3 : 0;

  return naturalHairColor ? Math.max(0, Math.min(1, 0.9 - shadowPenalty)) : 0.7;
}

function calculateClothesConfidence(
  color: RGB,
  shadowPercentage: number
): number {
  const lab = rgbToLab(color);
  const isNeutral = Math.abs(lab.a) < 5 && Math.abs(lab.b) < 5;
  const shadowPenalty = shadowPercentage > 50 ? 0.4 : 0;

  return isNeutral
    ? Math.max(0, Math.min(1, 0.8 - shadowPenalty))
    : Math.max(0, Math.min(1, 0.95 - shadowPenalty));
}

// Basic color analysis functions from original code
function calculateAverageColor(pixels: RGB[]): RGB {
  const sum = pixels.reduce(
    (acc, pixel) => ({
      r: acc.r + pixel.r,
      g: acc.g + pixel.g,
      b: acc.b + pixel.b,
    }),
    { r: 0, g: 0, b: 0 }
  );

  return {
    r: Math.round(sum.r / pixels.length),
    g: Math.round(sum.g / pixels.length),
    b: Math.round(sum.b / pixels.length),
  };
}

function findDominantColors(pixels: RGB[], k: number): RGB[] {
  // Simple k-means implementation
  let centroids = pixels.slice(0, k);
  const maxIterations = 10;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const clusters: RGB[][] = Array.from({ length: k }, () => []);

    // Assign pixels to nearest centroid
    pixels.forEach((pixel) => {
      let minDist = Infinity;
      let nearestCentroid = 0;

      centroids.forEach((centroid, i) => {
        const dist = colorDistance(pixel, centroid);
        if (dist < minDist) {
          minDist = dist;
          nearestCentroid = i;
        }
      });

      clusters[nearestCentroid]?.push(pixel);
    });

    // Update centroids
    centroids = clusters.map((cluster) =>
      cluster.length > 0 ? calculateAverageColor(cluster) : centroids[0]!
    );
  }

  return centroids;
}

function analyzeSkinColor(pixels: RGB[], dominantColors: RGB[]): RGB {
  // Sort by brightness and take the middle cluster to avoid highlights and shadows
  const sortedByBrightness = dominantColors.sort(
    (a, b) => calculateBrightness(b) - calculateBrightness(a)
  );

  return sortedByBrightness[1] || calculateAverageColor(pixels);
}

function analyzeHairColor(pixels: RGB[], dominantColors: RGB[]): RGB {
  // Take the darkest dominant color that's not a shadow
  const sortedByBrightness = dominantColors
    .filter((color) => calculateBrightness(color) > 30)
    .sort((a, b) => calculateBrightness(a) - calculateBrightness(b));

  return sortedByBrightness[0] || calculateAverageColor(pixels);
}

function analyzeClothesColor(pixels: RGB[], dominantColors: RGB[]): RGB {
  // Take the most saturated dominant color
  const sortedBySaturation = dominantColors.sort(
    (a, b) => calculateSaturation(b) - calculateSaturation(a)
  );

  return sortedBySaturation[0] || calculateAverageColor(pixels);
}

// Update the main analysis function to use enhanced analysis
export function analyzeImageCategoriesEnhanced(
  result: ImageSegmenterResult,
  imageData: Uint8ClampedArray
): EnhancedCategoryColors {
  const categoryPixels: { [key: number]: RGB[] } = {
    1: [], // hair
    2: [], // body-skin
    3: [], // face-skin
    4: [], // clothes
    5: [], // others
  };

  const mask: Uint8Array = result.categoryMask!.getAsUint8Array();

  for (let i = 0; i < mask.length; i++) {
    const category = mask[i]!;
    if (category > 0) {
      const pixel: RGB = {
        r: imageData[i * 4]!,
        g: imageData[i * 4 + 1]!,
        b: imageData[i * 4 + 2]!,
      };
      categoryPixels[category]?.push(pixel);
    }
  }

  return {
    hair: analyzeCategoryColorEnhanced(categoryPixels[1]!, "hair"),
    bodySkin: analyzeCategoryColorEnhanced(categoryPixels[2]!, "bodySkin"),
    faceSkin: analyzeCategoryColorEnhanced(categoryPixels[3]!, "faceSkin"),
    clothes: analyzeCategoryColorEnhanced(categoryPixels[4]!, "clothes"),
    others: analyzeCategoryColorEnhanced(categoryPixels[5]!, "others"),
  };
}

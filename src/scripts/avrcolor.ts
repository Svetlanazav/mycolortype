import { ImageSegmenterResult } from "@mediapipe/tasks-vision";

interface CategoryColors {
  hair: RGB;
  bodySkin: RGB;
  faceSkin: RGB;
  clothes: RGB;
  others: RGB;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface ColorStats {
  avgColor: RGB;
  dominantColor: RGB;
  shadowAdjustedColor: RGB;
}

export function analyzeImageCategories(
  result: ImageSegmenterResult,
  imageData: Uint8ClampedArray
): CategoryColors {
  const categoryPixels: { [key: number]: RGB[] } = {
    1: [], // hair
    2: [], // body-skin
    3: [], // face-skin
    4: [], // clothes
    5: [], // others
  };

  const mask: Uint8Array = result.categoryMask!.getAsUint8Array();

  // Collect all pixels for each category
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

  // Analyze each category
  const colors: CategoryColors = {
    hair: analyzeCategoryColor(categoryPixels[1]!, "hair"),
    bodySkin: analyzeCategoryColor(categoryPixels[2]!, "bodySkin"),
    faceSkin: analyzeCategoryColor(categoryPixels[3]!, "faceSkin"),
    clothes: analyzeCategoryColor(categoryPixels[4]!, "clothes"),
    others: analyzeCategoryColor(categoryPixels[5]!, "others"),
  };

  return colors;
}

function analyzeCategoryColor(pixels: RGB[], category: string): RGB {
  if (pixels.length === 0) {
    return { r: 0, g: 0, b: 0 };
  }

  // Calculate average color
  const avgColor = calculateAverageColor(pixels);

  // Find dominant color clusters using k-means
  const dominantColors = findDominantColors(pixels, 3);

  // Detect and remove shadow pixels
  const nonShadowPixels = removeShadowPixels(pixels, avgColor);

  // Get the most representative color based on the category
  switch (category) {
    case "faceSkin":
    case "bodySkin":
      return analyzeSkinColor(nonShadowPixels, dominantColors);
    case "hair":
      return analyzeHairColor(nonShadowPixels, dominantColors);
    case "clothes":
      return analyzeClothesColor(nonShadowPixels, dominantColors);
    default:
      return avgColor;
  }
}

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

function removeShadowPixels(pixels: RGB[], avgColor: RGB): RGB[] {
  const threshold = calculateBrightness(avgColor) * 0.7;

  return pixels.filter((pixel) => calculateBrightness(pixel) >= threshold);
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

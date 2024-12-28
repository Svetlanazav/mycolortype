import { type NormalizedLandmark } from "@mediapipe/tasks-vision";

interface Point {
  x: number;
  y: number;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface PupilDetectionResult {
  radius: number;
  confidence: number;
}

function getBrightnessGradient(
  image: ImageData,
  x: number,
  y: number,
  direction: "horizontal" | "vertical"
): number {
  if (x <= 0 || x >= image.width - 1 || y <= 0 || y >= image.height - 1) {
    return 0;
  }

  const idx = (y * image.width + x) * 4;
  let prev: number, next: number;

  if (direction === "horizontal") {
    prev = (y * image.width + (x - 1)) * 4;
    next = (y * image.width + (x + 1)) * 4;
  } else {
    prev = ((y - 1) * image.width + x) * 4;
    next = ((y + 1) * image.width + x) * 4;
  }

  // Calculate brightness using luminosity formula
  const getBrightness = (i: number) =>
    0.299 * image.data[i]! +
    0.587 * image.data[i + 1]! +
    0.114 * image.data[i + 2]!;

  return Math.abs(getBrightness(next) - getBrightness(prev));
}

function detectPupilBoundary(
  image: ImageData,
  center: Point,
  searchRadius: number,
  samples: number = 32
): PupilDetectionResult {
  const gradientThreshold = 30; // Minimum brightness gradient to consider as edge
  const angleStep = (2 * Math.PI) / samples;
  const radialSteps = 20; // Number of steps to search in radial direction

  let edgePoints: Point[] = [];
  let totalConfidence = 0;

  // Search along radial lines from center
  for (let i = 0; i < samples; i++) {
    const angle = i * angleStep;
    let maxGradient = 0;
    let edgeRadius = 0;

    // Search along each radial line
    for (let r = 2; r < searchRadius; r += searchRadius / radialSteps) {
      const x = Math.round(center.x + r * Math.cos(angle));
      const y = Math.round(center.y + r * Math.sin(angle));

      if (x < 0 || x >= image.width || y < 0 || y >= image.height) {
        continue;
      }

      // Check both horizontal and vertical gradients
      const hGradient = getBrightnessGradient(image, x, y, "horizontal");
      const vGradient = getBrightnessGradient(image, x, y, "vertical");
      const gradient = Math.max(hGradient, vGradient);

      if (gradient > maxGradient && gradient > gradientThreshold) {
        maxGradient = gradient;
        edgeRadius = r;
      }
    }

    if (edgeRadius > 0) {
      edgePoints.push({
        x: center.x + edgeRadius * Math.cos(angle),
        y: center.y + edgeRadius * Math.sin(angle),
      });
      totalConfidence += maxGradient;
    }
  }

  // Calculate average radius and normalize confidence
  if (edgePoints.length === 0) {
    return { radius: searchRadius * 0.4, confidence: 0 }; // Fallback to default
  }

  const avgRadius =
    edgePoints.reduce(
      (sum, point) =>
        sum +
        Math.sqrt(
          Math.pow(point.x - center.x, 2) + Math.pow(point.y - center.y, 2)
        ),
      0
    ) / edgePoints.length;

  const confidence = Math.min(1, totalConfidence / (edgePoints.length * 255));

  return {
    radius: avgRadius,
    confidence: confidence,
  };
}

export function getIrisColor(
  image: ImageData,
  landmarks: NormalizedLandmark[],
  irisPoints: number[],
  boundaryPoints: number[],
  pupilCenter: number
): RGB {
  // Convert normalized coordinates to pixel coordinates
  const getPixelCoords = (landmark: NormalizedLandmark): Point => ({
    x: Math.round(landmark.x * image.width),
    y: Math.round(landmark.y * image.height),
  });

  // Get iris boundary points
  const irisCoords = irisPoints.map((id) => getPixelCoords(landmarks[id]!));
  const boundaryCoords = boundaryPoints.map((id) =>
    getPixelCoords(landmarks[id]!)
  );
  const pupilCoords = getPixelCoords(landmarks[pupilCenter]!);

  // Calculate iris radius
  const irisRadius = Math.max(
    ...irisCoords.map((point) =>
      Math.sqrt(
        Math.pow(point.x - pupilCoords.x, 2) +
          Math.pow(point.y - pupilCoords.y, 2)
      )
    )
  );

  // Use advanced pupil detection
  const pupilDetection = detectPupilBoundary(
    image,
    pupilCoords,
    irisRadius * 0.6 // Maximum expected pupil radius
  );

  const pupilRadius =
    pupilDetection.confidence > 0.5 ? pupilDetection.radius : irisRadius * 0.4; // Fallback to default ratio if detection confidence is low

  // Find the maximum y-coordinate from boundary points
  const maxY = Math.min(...boundaryCoords.map((point) => point.y));

  // Create color histogram
  const colorMap: Map<string, number> = new Map();
  const irisPixels: RGB[] = [];

  // Sample pixels in the iris region
  for (
    let y = pupilCoords.y - irisRadius;
    y <= pupilCoords.y + irisRadius;
    y++
  ) {
    for (
      let x = pupilCoords.x - irisRadius;
      x <= pupilCoords.x + irisRadius;
      x++
    ) {
      const distanceFromCenter = Math.sqrt(
        Math.pow(x - pupilCoords.x, 2) + Math.pow(y - pupilCoords.y, 2)
      );

      if (
        distanceFromCenter <= irisRadius &&
        distanceFromCenter >= pupilRadius &&
        y <= maxY &&
        x >= 0 &&
        x < image.width &&
        y >= 0 &&
        y < image.height
      ) {
        const index = +((y * image.width + x) * 4).toFixed(0);
        const rgb: RGB = {
          r: image.data[index]!,
          g: image.data[index + 1]!,
          b: image.data[index + 2]!,
        };

        // Add to color histogram (quantize colors to reduce noise)
        const quantizedColor = `${Math.floor(rgb.r / 8)},${Math.floor(rgb.g / 8)},${Math.floor(rgb.b / 8)}`;
        colorMap.set(quantizedColor, (colorMap.get(quantizedColor) || 0) + 1);
        irisPixels.push(rgb);
      }
    }
  }

  // Find dominant color group
  let maxCount = 0;
  let dominantQuantizedColor = "";
  for (const [color, count] of colorMap.entries()) {
    if (count > maxCount) {
      maxCount = count;
      dominantQuantizedColor = color;
    }
  }

  // Calculate average color within the dominant color group
  const [qR, qG, qB] = dominantQuantizedColor.split(",").map(Number);
  const dominantPixels = irisPixels.filter(
    (pixel) =>
      Math.floor(pixel.r / 8) === qR &&
      Math.floor(pixel.g / 8) === qG &&
      Math.floor(pixel.b / 8) === qB
  );

  const averageColor = dominantPixels.reduce(
    (acc, pixel) => ({
      r: acc.r + pixel.r,
      g: acc.g + pixel.g,
      b: acc.b + pixel.b,
    }),
    { r: 0, g: 0, b: 0 }
  );
  debugger;

  return {
    r: Math.round(averageColor.r / dominantPixels.length),
    g: Math.round(averageColor.g / dominantPixels.length),
    b: Math.round(averageColor.b / dominantPixels.length),
  };
}

// Example usage:
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

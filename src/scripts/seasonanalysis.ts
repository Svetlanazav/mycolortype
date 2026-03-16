import type { ColorAnalysis } from "../scripts/avrcolorenhanced";

// TypeScript Implementation

// Types for seasonal color analysis
type Season = "Spring" | "Summer" | "Autumn" | "Winter";
type SubSeason =
  | "Light Spring"
  | "Warm Spring"
  | "Bright Spring"
  | "Light Summer"
  | "Cool Summer"
  | "Soft Summer"
  | "Soft Autumn"
  | "Warm Autumn"
  | "Deep Autumn"
  | "Deep Winter"
  | "Cool Winter"
  | "Bright Winter";

export interface SeasonalCharacteristics {
  season: Season;
  subSeason: SubSeason;
  characteristics: {
    contrast: "low" | "medium" | "high";
    undertone: "warm" | "cool" | "neutral";
    intensity: "soft" | "medium" | "bright";
    value: "light" | "medium" | "deep";
  };
  confidence: number;
}

interface ColorValues {
  hair: ColorAnalysis;
  bodySkin: ColorAnalysis;
  faceSkin: ColorAnalysis;
}

export function determineSeasonalPalette(
  colorValues: ColorValues,
): SeasonalCharacteristics {
  // Calculate key characteristics
  const undertone = determineUndertone(colorValues.faceSkin);
  const contrast = calculateContrast(colorValues);
  const intensity = calculateColorIntensity(colorValues);
  const value = calculateValue(colorValues);

  // Determine base season
  const season = determineBaseSeason(undertone, contrast, intensity, value);

  // Determine specific sub-season
  const subSeason = determineSubSeason(
    season,
    undertone,
    contrast,
    intensity,
    value,
  );

  // Calculate confidence score
  const confidence = calculateSeasonalConfidence(
    colorValues,
    season,
    subSeason,
  );

  return {
    season,
    subSeason,
    characteristics: {
      contrast,
      undertone,
      intensity,
      value,
    },
    confidence,
  };
}

// function determineUndertone(
//   skinAnalysis: ColorAnalysis
// ): "warm" | "cool" | "neutral" {
//   const { lab } = skinAnalysis.colorSpace;

//   // Use a/b values from LAB color space to determine undertone
//   // Positive a = red (warm), negative a = green (cool)
//   // Positive b = yellow (warm), negative b = blue (cool)

//   const warmScore = lab.a * 0.5 + lab.b;

//   if (Math.abs(warmScore) < 5) {
//     return "neutral";
//   }
//   return warmScore > 0 ? "warm" : "cool";
// }

function determineUndertone(
  skinAnalysis: ColorAnalysis,
): "warm" | "cool" | "neutral" {
  const { lab, hsl } = skinAnalysis.colorSpace;

  // LAB: a > 0 = reddish (warm), b > 0 = yellowish (warm).
  // Normalize to ~[-1, 1]: typical skin lab.a -5..+20, lab.b +5..+35.
  const warmScoreLab = (lab.a * 0.4 + lab.b * 0.6) / 25;

  // HSL: peak warmth at hue 30 (orange), peak cool at hue 210 (blue).
  const warmScoreHsl = Math.cos(((hsl.h - 30) * Math.PI) / 180);

  // Both inputs are now on the same [-1, 1] scale.
  const combinedScore = warmScoreLab * 0.7 + warmScoreHsl * 0.3;

  if (Math.abs(combinedScore) < 0.15) {
    return "neutral";
  }
  return combinedScore > 0 ? "warm" : "cool";
}

function calculateContrast(
  colorValues: ColorValues,
): "low" | "medium" | "high" {
  const { hair, faceSkin } = colorValues;

  // Calculate contrast using Lab values
  const contrastValue = Math.abs(
    hair.colorSpace.lab.l - faceSkin.colorSpace.lab.l,
  );

  if (contrastValue < 30) return "low";
  if (contrastValue > 50) return "high";
  return "medium";
}

function calculateColorIntensity(
  colorValues: ColorValues,
): "soft" | "medium" | "bright" {
  const { faceSkin, hair } = colorValues;

  // Lab chroma is perceptually uniform — better than HSL saturation.
  // Chroma = sqrt(a² + b²). Typical skin: 5-40, hair: 2-35.
  const skinChroma = Math.sqrt(
    faceSkin.colorSpace.lab.a ** 2 + faceSkin.colorSpace.lab.b ** 2,
  );
  const hairChroma = Math.sqrt(
    hair.colorSpace.lab.a ** 2 + hair.colorSpace.lab.b ** 2,
  );

  // Face skin is more representative of personal coloring than hair.
  const weightedChroma = skinChroma * 0.65 + hairChroma * 0.35;

  if (weightedChroma < 12) return "soft";
  if (weightedChroma > 25) return "bright";
  return "medium";
}

function calculateValue(colorValues: ColorValues): "light" | "medium" | "deep" {
  const { faceSkin, bodySkin, hair } = colorValues;

  // Face skin matters most (50%), body skin adds context (30%), hair least (20%)
  // because hair can be dyed, while skin is inherent.
  const weightedLightness =
    faceSkin.colorSpace.lab.l * 0.5 +
    bodySkin.colorSpace.lab.l * 0.3 +
    hair.colorSpace.lab.l * 0.2;

  if (weightedLightness > 65) return "light";
  if (weightedLightness < 45) return "deep";
  return "medium";
}

function determineBaseSeason(
  undertone: "warm" | "cool" | "neutral",
  contrast: "low" | "medium" | "high",
  intensity: "soft" | "medium" | "bright",
  value: "light" | "medium" | "deep",
): Season {
  if (undertone === "warm") {
    return value === "light" ? "Spring" : "Autumn";
  }
  if (undertone === "cool") {
    return value === "light" ? "Summer" : "Winter";
  }

  // For neutral undertones, use contrast and intensity
  if (contrast === "high" || intensity === "bright") {
    return value === "light" ? "Spring" : "Winter";
  }
  return value === "light" ? "Summer" : "Autumn";
}

function determineSubSeason(
  season: Season,
  undertone: "warm" | "cool" | "neutral",
  contrast: "low" | "medium" | "high",
  intensity: "soft" | "medium" | "bright",
  value: "light" | "medium" | "deep",
): SubSeason {
  switch (season) {
    case "Spring":
      if (value === "light") return "Light Spring";
      if (contrast === "high" || intensity === "bright") return "Bright Spring";
      return "Warm Spring";

    case "Summer":
      if (value === "light" && intensity === "soft") return "Light Summer";
      if (intensity === "soft") return "Soft Summer";
      return "Cool Summer";

    case "Autumn":
      if (intensity === "soft" || contrast === "low") return "Soft Autumn";
      if (value === "deep") return "Deep Autumn";
      return "Warm Autumn";

    case "Winter":
      if (value === "deep") return "Deep Winter";
      if (contrast === "high" || intensity === "bright") return "Bright Winter";
      return "Cool Winter";

    default:
      return undertone === "warm" ? "Warm Spring" : "Cool Winter";
  }
}

function calculateSeasonalConfidence(
  colorValues: ColorValues,
  season: Season,
  _subSeason: SubSeason,
): number {
  const { hair, faceSkin } = colorValues;

  // Base confidence on:
  // 1. Confidence of input color analysis
  // 2. Strength of characteristics
  // 3. Consistency of features

  const colorConfidence = (hair.confidence + faceSkin.confidence) / 2;

  // Calculate how strongly the characteristics match the season
  const characteristicMatch = calculateCharacteristicMatch(colorValues, season);

  // Consider shadow percentage in confidence calculation
  const shadowImpact = Math.max(0, 1 - faceSkin.shadowPercentage / 100);

  return colorConfidence * characteristicMatch * shadowImpact;
}

function calculateCharacteristicMatch(
  colorValues: ColorValues,
  season: Season,
): number {
  const undertone = determineUndertone(colorValues.faceSkin);
  const value = calculateValue(colorValues);
  const intensity = calculateColorIntensity(colorValues);

  // Expected characteristics per season (multiple valid values per dimension)
  const expectations: Record<
    Season,
    {
      undertone: string[];
      value: string[];
      intensity: string[];
    }
  > = {
    Spring: {
      undertone: ["warm"],
      value: ["light", "medium"],
      intensity: ["medium", "bright"],
    },
    Summer: {
      undertone: ["cool", "neutral"],
      value: ["light", "medium"],
      intensity: ["soft", "medium"],
    },
    Autumn: {
      undertone: ["warm", "neutral"],
      value: ["medium", "deep"],
      intensity: ["soft", "medium"],
    },
    Winter: {
      undertone: ["cool"],
      value: ["medium", "deep"],
      intensity: ["medium", "bright"],
    },
  };

  const exp = expectations[season];

  // Undertone is the strongest season signal (0.5), value next (0.3), intensity (0.2)
  const undertoneScore = exp.undertone.includes(undertone) ? 1 : 0.4;
  const valueScore = exp.value.includes(value) ? 1 : 0.6;
  const intensityScore = exp.intensity.includes(intensity) ? 1 : 0.6;

  return undertoneScore * 0.5 + valueScore * 0.3 + intensityScore * 0.2;
}

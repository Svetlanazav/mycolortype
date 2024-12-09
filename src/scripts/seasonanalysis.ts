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

interface SeasonalCharacteristics {
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
  faceSkin: ColorAnalysis;
  bodySkin: ColorAnalysis;
}

export function determineSeasonalPalette(
  colorValues: ColorValues
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
    value
  );

  // Calculate confidence score
  const confidence = calculateSeasonalConfidence(
    colorValues,
    season,
    subSeason
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
  skinAnalysis: ColorAnalysis
): "warm" | "cool" | "neutral" {
  const { lab, hsl } = skinAnalysis.colorSpace;

  // Combine LAB and HSL information
  const warmScoreLab = lab.a * 0.5 + lab.b;
  const warmScoreHsl = Math.cos(((hsl.h - 30) * Math.PI) / 180); // Peak warmth at 30 degrees

  const combinedScore = warmScoreLab * 0.7 + warmScoreHsl * 30 * 0.3;

  if (Math.abs(combinedScore) < 5) {
    return "neutral";
  }
  return combinedScore > 0 ? "warm" : "cool";
}

function calculateContrast(
  colorValues: ColorValues
): "low" | "medium" | "high" {
  const { hair, faceSkin } = colorValues;

  // Calculate contrast using Lab values
  const contrastValue = Math.abs(
    hair.colorSpace.lab.l - faceSkin.colorSpace.lab.l
  );

  if (contrastValue < 30) return "low";
  if (contrastValue > 50) return "high";
  return "medium";
}

function calculateColorIntensity(
  colorValues: ColorValues
): "soft" | "medium" | "bright" {
  const { faceSkin, hair } = colorValues;

  // Use saturation from HSL to determine intensity
  const skinSaturation = faceSkin.colorSpace.hsl.s;
  const hairSaturation = hair.colorSpace.hsl.s;

  const averageSaturation = (skinSaturation + hairSaturation) / 2;

  if (averageSaturation < 0.3) return "soft";
  if (averageSaturation > 0.6) return "bright";
  return "medium";
}

function calculateValue(colorValues: ColorValues): "light" | "medium" | "deep" {
  const { faceSkin, hair } = colorValues;

  // Use lightness from Lab color space
  const skinLightness = faceSkin.colorSpace.lab.l;
  const hairLightness = hair.colorSpace.lab.l;

  const averageLightness = (skinLightness + hairLightness) / 2;

  if (averageLightness > 65) return "light";
  if (averageLightness < 45) return "deep";
  return "medium";
}

function determineBaseSeason(
  undertone: "warm" | "cool" | "neutral",
  contrast: "low" | "medium" | "high",
  intensity: "soft" | "medium" | "bright",
  value: "light" | "medium" | "deep"
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
  value: "light" | "medium" | "deep"
): SubSeason {
  switch (season) {
    case "Spring":
      if (value === "light") return "Light Spring";
      if (undertone === "warm") return "Warm Spring";
      return "Bright Spring";

    case "Summer":
      if (value === "light") return "Light Summer";
      if (intensity === "soft") return "Soft Summer";
      return "Cool Summer";

    case "Autumn":
      if (intensity === "soft") return "Soft Autumn";
      if (undertone === "warm") return "Warm Autumn";
      return "Deep Autumn";

    case "Winter":
      if (value === "deep") return "Deep Winter";
      if (undertone === "cool") return "Cool Winter";
      return "Bright Winter";
  }
}

function calculateSeasonalConfidence(
  colorValues: ColorValues,
  season: Season,
  subSeason: SubSeason
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
  season: Season
): number {
  // Calculate how well the characteristics match the typical values for the season
  // Returns a value between 0 and 1

  const undertone = determineUndertone(colorValues.faceSkin);
  const expectedUndertone =
    season === "Spring" || season === "Autumn" ? "warm" : "cool";

  const undertoneMatch =
    undertone === expectedUndertone ? 1 : undertone === "neutral" ? 0.7 : 0.5;

  // Add more characteristic matching calculations...

  return undertoneMatch;
}

// Python equivalent (key functions)
// """
// import numpy as np
// from dataclasses import dataclass
// from typing import Literal, TypedDict
// from enum import Enum

// class Season(Enum):
//     SPRING = "Spring"
//     SUMMER = "Summer"
//     AUTUMN = "Autumn"
//     WINTER = "Winter"

// @dataclass
// class ColorAnalysis:
//     color: dict  # RGB values
//     confidence: float
//     shadow_percentage: float
//     color_space: dict  # Contains RGB, HSL, Lab

// def determine_undertone(skin_analysis: ColorAnalysis) -> str:
//     lab = skin_analysis.color_space['lab']
//     warm_score = lab['a'] * 0.5 + lab['b']

//     if abs(warm_score) < 5:
//         return 'neutral'
//     return 'warm' if warm_score > 0 else 'cool'

// def calculate_contrast(color_values: dict) -> str:
//     hair = color_values['hair']
//     face_skin = color_values['faceSkin']

//     contrast_value = abs(
//         hair.color_space['lab']['l'] -
//         face_skin.color_space['lab']['l']
//     )

//     if contrast_value < 30:
//         return 'low'
//     if contrast_value > 50:
//         return 'high'
//     return 'medium'

// def determine_seasonal_palette(color_values: dict) -> dict:
//     undertone = determine_undertone(color_values['faceSkin'])
//     contrast = calculate_contrast(color_values)
//     intensity = calculate_color_intensity(color_values)
//     value = calculate_value(color_values)

//     season = determine_base_season(undertone, contrast, intensity, value)
//     sub_season = determine_sub_season(season, undertone, contrast, intensity, value)
//     confidence = calculate_seasonal_confidence(color_values, season, sub_season)

//     return {
//         'season': season,
//         'subSeason': sub_season,
//         'characteristics': {
//             'contrast': contrast,
//             'undertone': undertone,
//             'intensity': intensity,
//             'value': value
//         },
//         'confidence': confidence
//     }
// """

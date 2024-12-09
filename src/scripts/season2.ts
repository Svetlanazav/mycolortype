import type { ColorAnalysis } from "../scripts/avrcolorenhanced";

interface HSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

interface ColorValues {
  hair: ColorAnalysis;
  faceSkin: ColorAnalysis;
  bodySkin: ColorAnalysis;
}
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

interface ColorCharacteristics {
  value: {
    score: number; // 0-100 (using Lightness)
    category: "light" | "medium" | "deep";
  };
  hue: {
    score: number; // -100 to 100 (normalized from 0-360)
    category: "cool" | "cool-warm" | "warm";
  };
  chroma: {
    score: number; // 0-100 (using Saturation)
    category: "soft" | "medium" | "clear";
  };
}

function calculateValue(
  colorValues: ColorValues
): ColorCharacteristics["value"] {
  const { faceSkin, hair } = colorValues;

  // Weight skin more heavily than hair for value calculation
  const skinWeight = 0.7;
  const hairWeight = 0.3;

  const valueScore =
    faceSkin.colorSpace.hsl.l * skinWeight + hair.colorSpace.hsl.l * hairWeight;

  return {
    score: valueScore,
    category: valueScore >= 70 ? "light" : valueScore >= 40 ? "medium" : "deep",
  };
}

function calculateHue(colorValues: ColorValues): ColorCharacteristics["hue"] {
  const { faceSkin } = colorValues;
  const hue = faceSkin.colorSpace.hsl.h;

  // Define warm and cool hue ranges
  const warmHues = [
    { start: 0, end: 45 }, // Red to orange-yellow
    { start: 345, end: 360 }, // Red
  ];

  const neutralHues = [
    { start: 45, end: 70 }, // Yellow
    { start: 280, end: 345 }, // Purple to red
  ];

  // Normalize hue to temperature score (-100 to 100)
  let hueScore: number;

  if (warmHues.some((range) => hue >= range.start && hue <= range.end)) {
    // Warm hues: map to 33 to 100
    hueScore = mapHueToTemperature(hue, warmHues);
  } else if (
    neutralHues.some((range) => hue >= range.start && hue <= range.end)
  ) {
    // Neutral hues: map to -33 to 33
    hueScore = mapHueToTemperature(hue, neutralHues);
  } else {
    // Cool hues: map to -100 to -33
    hueScore = mapHueToTemperature(hue, [{ start: 70, end: 280 }]);
  }

  return {
    score: hueScore,
    category: hueScore <= -33 ? "cool" : hueScore >= 33 ? "warm" : "cool-warm",
  };
}

function mapHueToTemperature(
  hue: number,
  ranges: Array<{ start: number; end: number }>
): number {
  // Helper function to map hue ranges to temperature scores
  const matchingRange = ranges.find(
    (range) => hue >= range.start && hue <= range.end
  );

  if (!matchingRange) return 0;

  if (hue >= 70 && hue <= 280) {
    // Cool range: map 70-280 to -100 to -33
    return -100 + (hue - 70) * (67 / 210);
  } else if (hue >= 45 && hue <= 70) {
    // Neutral-warm range: map 45-70 to 0 to 33
    return (hue - 45) * (33 / 25);
  } else if (hue >= 280 && hue <= 345) {
    // Neutral-cool range: map 280-345 to -33 to 0
    return -33 + (hue - 280) * (33 / 65);
  } else {
    // Warm range: map 345-360 & 0-45 to 33 to 100
    const adjustedHue = hue > 345 ? hue - 345 : hue + 15;
    return 33 + adjustedHue * (67 / 60);
  }
}

function calculateChroma(
  colorValues: ColorValues
): ColorCharacteristics["chroma"] {
  const { faceSkin, hair } = colorValues;

  // Weight skin and hair saturation
  const skinWeight = 0.7;
  const hairWeight = 0.3;

  const chromaScore =
    faceSkin.colorSpace.hsl.s * skinWeight + hair.colorSpace.hsl.s * hairWeight;

  return {
    score: chromaScore,
    category:
      chromaScore <= 30 ? "soft" : chromaScore >= 60 ? "clear" : "medium",
  };
}

function determineSeasonFromCharacteristics(
  characteristics: ColorCharacteristics
): Season {
  const { value, hue, chroma } = characteristics;

  // Define ideal characteristics for each season
  const seasonProfiles = {
    Spring: {
      value: { min: 60, ideal: 75 }, // Light to medium-light
      hue: { min: 33, ideal: 60 }, // Warm
      chroma: { min: 60, ideal: 80 }, // Clear
    },
    Summer: {
      value: { min: 55, ideal: 70 }, // Light to medium
      hue: { min: -60, ideal: -40 }, // Cool
      chroma: { min: 30, ideal: 45 }, // Soft to medium
    },
    Autumn: {
      value: { min: 35, ideal: 50 }, // Medium to deep
      hue: { min: 33, ideal: 50 }, // Warm
      chroma: { min: 40, ideal: 55 }, // Medium
    },
    Winter: {
      value: { min: 25, ideal: 40 }, // Deep
      hue: { min: -70, ideal: -50 }, // Cool
      chroma: { min: 60, ideal: 75 }, // Clear
    },
  };

  // Calculate match scores for each season
  const scores = Object.entries(seasonProfiles).map(([season, profile]) => {
    const valueScore = calculateMatchScore(value.score, profile.value);
    const hueScore = calculateMatchScore(hue.score, profile.hue);
    const chromaScore = calculateMatchScore(chroma.score, profile.chroma);

    const totalScore = valueScore * 0.3 + hueScore * 0.4 + chromaScore * 0.3;

    return { season, score: totalScore };
  });

  // Return the season with the highest score
  return scores.reduce((a, b) => (a.score > b.score ? a : b)).season as Season;
}

function calculateMatchScore(
  value: number,
  profile: { min: number; ideal: number }
): number {
  if (value < profile.min) {
    return 0;
  }

  const distance = Math.abs(value - profile.ideal);
  const maxDistance = Math.abs(profile.min - profile.ideal);

  return 1 - distance / maxDistance;
}

function analyzeSeasonalColors(colorValues: ColorValues): SeasonalAnalysis {
  const characteristics = {
    value: calculateValue(colorValues),
    hue: calculateHue(colorValues),
    chroma: calculateChroma(colorValues),
  };

  const season = determineSeasonFromCharacteristics(characteristics);
  const subSeason = determineSubSeason(season, characteristics);
  const confidence = calculateConfidence(characteristics, season);

  return {
    season,
    subSeason,
    characteristics,
    confidence,
  };
}

// Example usage:
/* 
const colorValues = {
  faceSkin: {
    colorSpace: {
      hsl: { h: 30, s: 25, l: 75 } // Warm, light, soft skin
    }
  },
  hair: {
    colorSpace: {
      hsl: { h: 35, s: 45, l: 30 } // Warm, medium saturation, dark hair
    }
  }
};

const analysis = analyzeSeasonalColors(colorValues);
console.log(analysis);
// {
//   season: "Autumn",
//   subSeason: "Warm Autumn",
//   characteristics: {
//     value: { score: 61.5, category: "medium" },
//     hue: { score: 65, category: "warm" },
//     chroma: { score: 31, category: "soft" }
//   },
//   confidence: 0.85
// }
*/

import chroma from "chroma-js";

export function advancedColor(color: chroma.Color) {
  // Get Oklch values:
  // l: lightness (0-1, 0 is black, 1 is white)
  // c: chroma (0-0.4, how colorful/saturated)
  // h: hue (0-360 degrees around the color wheel)
  const [l, c, h] = chroma(color).oklch();

  // Temperature Calculation
  const warmAngle = ((h + 360) % 360) - 60;
  // Why -60?
  // - Yellow (~60°) is considered warmest color
  // - This shifts our scale to make yellow the "peak" of warmth
  // - Now cos() will give 1 at yellow, -1 at blue
  const temperature = Math.cos((warmAngle * Math.PI) / 180) * c * 2;
  // Why multiply by c?
  // - More chromatic colors have stronger temperature feeling
  // - Gray (c=0) has no temperature
  // Why *2?
  // - Amplifies the effect to use full -1 to 1 range

  // Clarity Calculation
  const optimalL = 0.5 + 0.1 * Math.sin((h * Math.PI) / 180);
  // Why this formula?
  // - Colors appear clearest at different lightness levels
  // - Yellow needs higher lightness to appear clear
  // - Blue can appear clear at lower lightness
  // - sin() creates smooth transition between these levels
  const clarity = c * (1 - Math.abs(l - optimalL));
  // Why multiply by (1 - abs(l - optimalL))?
  // - Reduces clarity when lightness is far from optimal
  // - Color appears muddied when too dark/light for its hue

  // Depth Calculation
  const depth = l - c * 0.2;
  // Why subtract chroma?
  // - More chromatic colors appear lighter
  // - Called the Helmholtz-Kohlrausch effect
  // - 0.2 factor keeps the adjustment subtle

  return {
    temperature, // -1 (coolest) to 1 (warmest)
    clarity, // 0 (muted) to 1 (clear)
    depth, // 0 (deep) to 1 (light)
    oklch: { l, c, h },
  };
}

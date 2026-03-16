export interface SeasonColor {
  hex: string;
  name: string;
}

export interface SeasonPalette {
  description: string;
  primary: SeasonColor[];
  accent: SeasonColor[];
}

export const SEASON_PALETTES: Record<string, SeasonPalette> = {
  "Light Spring": {
    description:
      "Delicate and fresh — your best colors are soft, warm, and luminous.",
    primary: [
      { hex: "#F9E4B7", name: "Buttercream" },
      { hex: "#F4C2C2", name: "Peach Blush" },
      { hex: "#B5D5C5", name: "Mint" },
      { hex: "#F7CAC9", name: "Light Coral" },
    ],
    accent: [
      { hex: "#FFD700", name: "Warm Gold" },
      { hex: "#E8A598", name: "Salmon" },
      { hex: "#A8D8B9", name: "Sage" },
      { hex: "#F4D03F", name: "Sunflower" },
    ],
  },
  "Warm Spring": {
    description:
      "Vibrant and golden — rich warm tones bring out your natural glow.",
    primary: [
      { hex: "#E8925A", name: "Terracotta" },
      { hex: "#F4C430", name: "Saffron" },
      { hex: "#8DB600", name: "Yellow-Green" },
      { hex: "#E97451", name: "Burnt Sienna" },
    ],
    accent: [
      { hex: "#FFB347", name: "Apricot" },
      { hex: "#D2691E", name: "Chocolate" },
      { hex: "#9DC183", name: "Pistachio" },
      { hex: "#CC7722", name: "Ochre" },
    ],
  },
  "Bright Spring": {
    description:
      "Clear and vivid — high-contrast, saturated colors make you shine.",
    primary: [
      { hex: "#FF6B6B", name: "Coral Red" },
      { hex: "#FFD93D", name: "Bright Yellow" },
      { hex: "#6BCB77", name: "Vivid Green" },
      { hex: "#4D96FF", name: "Sky Blue" },
    ],
    accent: [
      { hex: "#FF922B", name: "Orange" },
      { hex: "#51CF66", name: "Spring Green" },
      { hex: "#FF6EB4", name: "Hot Pink" },
      { hex: "#FFA94D", name: "Marigold" },
    ],
  },
  "Light Summer": {
    description:
      "Soft and airy — muted, cool pastels that feel effortlessly elegant.",
    primary: [
      { hex: "#B8D4E3", name: "Powder Blue" },
      { hex: "#D4B8D8", name: "Lavender" },
      { hex: "#C5D5C5", name: "Sage Grey" },
      { hex: "#E8D5D0", name: "Blush Rose" },
    ],
    accent: [
      { hex: "#A8C0CC", name: "Steel Blue" },
      { hex: "#C3A0C8", name: "Lilac" },
      { hex: "#9DB5A5", name: "Eucalyptus" },
      { hex: "#D4A5A5", name: "Dusty Rose" },
    ],
  },
  "Cool Summer": {
    description:
      "Refined and cool — blue-based tones give you a polished, sophisticated look.",
    primary: [
      { hex: "#5B7FA6", name: "Slate Blue" },
      { hex: "#7B6E8A", name: "Mauve" },
      { hex: "#4A7C59", name: "Cool Green" },
      { hex: "#8B4F6B", name: "Berry" },
    ],
    accent: [
      { hex: "#8AAEC8", name: "Ice Blue" },
      { hex: "#C084B0", name: "Orchid" },
      { hex: "#6AA878", name: "Fern" },
      { hex: "#B07090", name: "Raspberry" },
    ],
  },
  "Soft Summer": {
    description:
      "Muted and harmonious — dusty, blended tones that create gentle beauty.",
    primary: [
      { hex: "#A0A8B8", name: "Blue Grey" },
      { hex: "#B8A8B0", name: "Dusty Mauve" },
      { hex: "#98B0A8", name: "Muted Teal" },
      { hex: "#C0B0A8", name: "Warm Taupe" },
    ],
    accent: [
      { hex: "#8898A8", name: "Denim" },
      { hex: "#A898A8", name: "Soft Plum" },
      { hex: "#88A898", name: "Jade" },
      { hex: "#B8A090", name: "Greige" },
    ],
  },
  "Soft Autumn": {
    description:
      "Gentle and earthy — warm muted shades that blend naturally with your coloring.",
    primary: [
      { hex: "#B8977A", name: "Camel" },
      { hex: "#A89070", name: "Khaki" },
      { hex: "#8A9870", name: "Olive" },
      { hex: "#C8A888", name: "Sand" },
    ],
    accent: [
      { hex: "#B88060", name: "Terracotta" },
      { hex: "#989070", name: "Moss" },
      { hex: "#C8B090", name: "Wheat" },
      { hex: "#A87860", name: "Copper" },
    ],
  },
  "Warm Autumn": {
    description:
      "Rich and golden — deep earthy tones with a warm, sun-kissed glow.",
    primary: [
      { hex: "#C46210", name: "Burnt Orange" },
      { hex: "#8B6914", name: "Dark Gold" },
      { hex: "#556B2F", name: "Dark Olive" },
      { hex: "#A0522D", name: "Sienna" },
    ],
    accent: [
      { hex: "#D4782A", name: "Pumpkin" },
      { hex: "#B8860B", name: "Dark Goldenrod" },
      { hex: "#6B8E23", name: "Olive Drab" },
      { hex: "#C17D3C", name: "Bronze" },
    ],
  },
  "Deep Autumn": {
    description:
      "Intense and dramatic — deep, rich earth tones with maximum warmth.",
    primary: [
      { hex: "#7B3F00", name: "Chocolate Brown" },
      { hex: "#800020", name: "Burgundy" },
      { hex: "#3D4F1C", name: "Forest Green" },
      { hex: "#8B4513", name: "Saddle Brown" },
    ],
    accent: [
      { hex: "#B8560A", name: "Rust" },
      { hex: "#9B1B30", name: "Deep Red" },
      { hex: "#4A5C2A", name: "Hunter Green" },
      { hex: "#A0522D", name: "Terra" },
    ],
  },
  "Deep Winter": {
    description:
      "Bold and striking — deep, cool jewel tones create powerful contrast.",
    primary: [
      { hex: "#0C1B33", name: "Midnight Blue" },
      { hex: "#4A0E2E", name: "Deep Plum" },
      { hex: "#0D3B2E", name: "Bottle Green" },
      { hex: "#1C1C1C", name: "Jet Black" },
    ],
    accent: [
      { hex: "#1B4F72", name: "Navy" },
      { hex: "#6C1A4A", name: "Eggplant" },
      { hex: "#1A5C3A", name: "Emerald" },
      { hex: "#8B0000", name: "Dark Red" },
    ],
  },
  "Cool Winter": {
    description:
      "Crisp and icy — pure, cool tones with a frosty elegance.",
    primary: [
      { hex: "#C8D8E8", name: "Ice Blue" },
      { hex: "#D8C8E8", name: "Soft Violet" },
      { hex: "#B8C8D8", name: "Steel" },
      { hex: "#E8D8E8", name: "Icy Pink" },
    ],
    accent: [
      { hex: "#4060A0", name: "Royal Blue" },
      { hex: "#8050A0", name: "Purple" },
      { hex: "#3080A0", name: "Cerulean" },
      { hex: "#C03060", name: "Deep Rose" },
    ],
  },
  "Bright Winter": {
    description:
      "Vivid and high-contrast — pure, saturated colors with a cool clarity.",
    primary: [
      { hex: "#FF0090", name: "Hot Pink" },
      { hex: "#0050FF", name: "Electric Blue" },
      { hex: "#00C050", name: "Emerald" },
      { hex: "#FF1030", name: "True Red" },
    ],
    accent: [
      { hex: "#8000FF", name: "Violet" },
      { hex: "#00D0D0", name: "Cyan" },
      { hex: "#FF8000", name: "Orange" },
      { hex: "#FFFFFF", name: "Pure White" },
    ],
  },
};

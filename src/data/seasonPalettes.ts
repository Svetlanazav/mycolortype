export interface SeasonColor {
  hex: string;
  name: string;
}

export interface SeasonPalette {
  description: string;
  primary: SeasonColor[];
  accent: SeasonColor[];
  forbidden: SeasonColor[];
  metals: SeasonColor[];
}

export const SEASON_PALETTES: Record<string, SeasonPalette> = {
  "True Spring": {
    description:
      "Warm and vibrant — rich golden tones bring out your natural glow.",
    primary: [
      { hex: "#FFFFF0", name: "Ivory" },
      { hex: "#FFDAB9", name: "Peach Cream" },
      { hex: "#FF6B47", name: "Coral" },
      { hex: "#FA8072", name: "Salmon" },
      { hex: "#FFCBA4", name: "Peach" },
      { hex: "#FFD700", name: "Golden Yellow" },
      { hex: "#C8A882", name: "Warm Beige" },
      { hex: "#FF5C6B", name: "Camellia" },
      { hex: "#C8B560", name: "Light Khaki" },
      { hex: "#40CCA8", name: "Warm Turquoise" },
      { hex: "#7FFFD4", name: "Light Aquamarine" },
      { hex: "#FFF8F0", name: "Warm White" },
      { hex: "#C19A6B", name: "Light Camel" },
    ],
    accent: [
      { hex: "#FFD700", name: "Golden Yellow" },
      { hex: "#FF6B47", name: "Coral" },
      { hex: "#40CCA8", name: "Warm Turquoise" },
      { hex: "#FF5C6B", name: "Camellia" },
    ],
    forbidden: [
      { hex: "#000000", name: "Black" },
      { hex: "#800020", name: "Burgundy" },
      { hex: "#808080", name: "Gray" },
    ],
    metals: [
      { hex: "#CFB53B", name: "Gold" },
      { hex: "#B76E79", name: "Rose Gold" },
    ],
  },
  "Light Spring": {
    description:
      "Delicate and fresh — soft, warm, and luminous pastels enhance your lightness.",
    primary: [
      { hex: "#FFF9F0", name: "Milk White" },
      { hex: "#FFE5CC", name: "Light Peach" },
      { hex: "#FBCEB1", name: "Apricot" },
      { hex: "#E6CCFF", name: "Warm Lavender" },
      { hex: "#C5E8FF", name: "Baby Blue" },
      { hex: "#F08080", name: "Light Coral" },
      { hex: "#AAFFC3", name: "Mint" },
      { hex: "#AFEEEE", name: "Light Turquoise" },
      { hex: "#FFFACD", name: "Pale Yellow" },
      { hex: "#DDA0DD", name: "Pale Lilac" },
    ],
    accent: [
      { hex: "#F08080", name: "Light Coral" },
      { hex: "#E6CCFF", name: "Warm Lavender" },
      { hex: "#AAFFC3", name: "Mint" },
      { hex: "#AFEEEE", name: "Light Turquoise" },
    ],
    forbidden: [
      { hex: "#000080", name: "Navy" },
      { hex: "#000000", name: "Black" },
      { hex: "#556B2F", name: "Dark Khaki" },
    ],
    metals: [
      { hex: "#EEC900", name: "Light Gold" },
      { hex: "#B76E79", name: "Rose Gold" },
    ],
  },
  "Bright Spring": {
    description:
      "Clear and vivid — high-contrast, saturated colors make you shine.",
    primary: [
      { hex: "#FF4500", name: "Bright Coral" },
      { hex: "#FF2400", name: "Scarlet" },
      { hex: "#00CED1", name: "Bright Turquoise" },
      { hex: "#FFD700", name: "Bright Yellow" },
      { hex: "#00FF7F", name: "Bright Green" },
      { hex: "#0080FF", name: "Bright Blue" },
      { hex: "#FFFFFF", name: "Pure White" },
      { hex: "#D2B48C", name: "Warm Beige" },
      { hex: "#FF69B4", name: "Hot Pink" },
      { hex: "#FF0000", name: "True Red" },
    ],
    accent: [
      { hex: "#FF4500", name: "Bright Coral" },
      { hex: "#00CED1", name: "Bright Turquoise" },
      { hex: "#FF69B4", name: "Hot Pink" },
      { hex: "#FF0000", name: "True Red" },
    ],
    forbidden: [
      { hex: "#F5F5DC", name: "Pastel tones" },
      { hex: "#808080", name: "Gray" },
      { hex: "#9E9E9E", name: "Muted Tones" },
    ],
    metals: [{ hex: "#CFB53B", name: "Gold" }],
  },
  "True Summer": {
    description:
      "Refined and cool — blue-based muted tones give you a polished, sophisticated look.",
    primary: [
      { hex: "#B57EDC", name: "Lavender" },
      { hex: "#DCAE96", name: "Dusty Rose" },
      { hex: "#B0C4DE", name: "Powder Blue" },
      { hex: "#778899", name: "Cool Gray Blue" },
      { hex: "#C9506A", name: "Muted Raspberry" },
      { hex: "#C2B9A7", name: "Greige" },
      { hex: "#F8F8FF", name: "Cool White" },
      { hex: "#8E4585", name: "Soft Plum" },
      { hex: "#6B8E7F", name: "Smoky Green" },
      { hex: "#FFB6C1", name: "Cool Pink" },
      { hex: "#B2EBD9", name: "Cool Mint" },
      { hex: "#80C5BE", name: "Soft Teal" },
    ],
    accent: [
      { hex: "#B57EDC", name: "Lavender" },
      { hex: "#C9506A", name: "Muted Raspberry" },
      { hex: "#8E4585", name: "Soft Plum" },
      { hex: "#80C5BE", name: "Soft Teal" },
    ],
    forbidden: [
      { hex: "#FFA500", name: "Orange" },
      { hex: "#000000", name: "Black" },
      { hex: "#FFFF00", name: "Bright Yellow" },
    ],
    metals: [
      { hex: "#C0C0C0", name: "Silver" },
      { hex: "#E8E4D0", name: "White Gold" },
      { hex: "#E8B4B8", name: "Light Rose Gold" },
    ],
  },
  "Light Summer": {
    description:
      "Soft and airy — muted, cool pastels that feel effortlessly elegant.",
    primary: [
      { hex: "#FAF0E6", name: "Off White" },
      { hex: "#E6E6FA", name: "Pale Lavender" },
      { hex: "#ADD8E6", name: "Light Blue" },
      { hex: "#FFB5C8", name: "Blush Pink" },
      { hex: "#C8A2C8", name: "Pale Lilac" },
      { hex: "#9ECCCF", name: "Light Sea" },
      { hex: "#CCF2E8", name: "Soft Mint" },
      { hex: "#D3D3D3", name: "Pearl Gray" },
    ],
    accent: [
      { hex: "#E6E6FA", name: "Pale Lavender" },
      { hex: "#FFB5C8", name: "Blush Pink" },
      { hex: "#9ECCCF", name: "Light Sea" },
      { hex: "#CCF2E8", name: "Soft Mint" },
    ],
    forbidden: [
      { hex: "#000080", name: "Navy" },
      { hex: "#000000", name: "Black" },
      { hex: "#FFA500", name: "Orange" },
    ],
    metals: [{ hex: "#C0C0C0", name: "Silver" }],
  },
  "Soft Summer": {
    description:
      "Muted and harmonious — dusty, blended tones that create gentle beauty.",
    primary: [
      { hex: "#B09898", name: "Misty Mauve" },
      { hex: "#8A9CB0", name: "Smoky Blue" },
      { hex: "#A898B0", name: "Hazy Lavender" },
      { hex: "#8A9A78", name: "Sage Green" },
      { hex: "#8B7BA8", name: "Deep Lavender" },
      { hex: "#C49A94", name: "Dusty Pink" },
      { hex: "#809B9B", name: "Gray Teal" },
      { hex: "#8B7D6B", name: "Taupe" },
    ],
    accent: [
      { hex: "#8A9CB0", name: "Smoky Blue" },
      { hex: "#8B7BA8", name: "Deep Lavender" },
      { hex: "#809B9B", name: "Gray Teal" },
      { hex: "#C49A94", name: "Dusty Pink" },
    ],
    forbidden: [
      { hex: "#FFFFFF", name: "Bright White" },
      { hex: "#FFA500", name: "Orange" },
      { hex: "#FF0000", name: "Bright Red" },
    ],
    metals: [{ hex: "#A8A9AD", name: "Matte Silver" }],
  },
  "True Autumn": {
    description:
      "Rich and golden — deep earthy tones with a warm, sun-kissed glow.",
    primary: [
      { hex: "#FF7518", name: "Pumpkin" },
      { hex: "#FFDB58", name: "Mustard" },
      { hex: "#808000", name: "Olive" },
      { hex: "#CB4154", name: "Brick Red" },
      { hex: "#B7410E", name: "Rust" },
      { hex: "#8B4513", name: "Warm Brown" },
      { hex: "#228B22", name: "Forest Green" },
      { hex: "#C19A6B", name: "Camel" },
      { hex: "#D2B48C", name: "Warm Beige" },
      { hex: "#614051", name: "Warm Eggplant" },
      { hex: "#CD7F32", name: "Bronze" },
      { hex: "#E2725B", name: "Terracotta" },
    ],
    accent: [
      { hex: "#FF7518", name: "Pumpkin" },
      { hex: "#B7410E", name: "Rust" },
      { hex: "#E2725B", name: "Terracotta" },
      { hex: "#CD7F32", name: "Bronze" },
    ],
    forbidden: [
      { hex: "#FFB6C1", name: "Cool Pink" },
      { hex: "#6495ED", name: "Cool Blue" },
      { hex: "#C0C0C0", name: "Silver" },
    ],
    metals: [
      { hex: "#CFB53B", name: "Gold" },
      { hex: "#CD7F32", name: "Bronze" },
      { hex: "#B87333", name: "Copper" },
    ],
  },
  "Soft Autumn": {
    description:
      "Gentle and earthy — warm muted shades that blend naturally with your coloring.",
    primary: [
      { hex: "#9A9A5A", name: "Hazy Olive" },
      { hex: "#DBBEA0", name: "Dusty Apricot" },
      { hex: "#704214", name: "Sepia" },
      { hex: "#AA8878", name: "Mushroom" },
      { hex: "#C8A84B", name: "Muted Mustard" },
      { hex: "#8A9A6A", name: "Muted Green" },
      { hex: "#C48070", name: "Dusty Terracotta" },
      { hex: "#9C8FA0", name: "Dusty Lavender" },
    ],
    accent: [
      { hex: "#C48070", name: "Dusty Terracotta" },
      { hex: "#C8A84B", name: "Muted Mustard" },
      { hex: "#8A9A6A", name: "Muted Green" },
      { hex: "#9A9A5A", name: "Hazy Olive" },
    ],
    forbidden: [
      { hex: "#000080", name: "Navy" },
      { hex: "#FF0000", name: "Bright Red" },
      { hex: "#000000", name: "Black" },
    ],
    metals: [
      { hex: "#B8A048", name: "Matte Gold" },
      { hex: "#CD7F32", name: "Bronze" },
    ],
  },
  "Dark Autumn": {
    description:
      "Intense and dramatic — deep, rich earth tones with maximum warmth.",
    primary: [
      { hex: "#3D1C02", name: "Dark Chocolate" },
      { hex: "#046307", name: "Deep Emerald" },
      { hex: "#6B1A2A", name: "Dark Warm Burgundy" },
      { hex: "#4B0082", name: "Deep Eggplant" },
      { hex: "#6B6B1A", name: "Rich Olive" },
      { hex: "#8B3100", name: "Dark Rust" },
      { hex: "#9B7E4A", name: "Dark Camel" },
      { hex: "#1B4A1B", name: "Forest" },
    ],
    accent: [
      { hex: "#046307", name: "Deep Emerald" },
      { hex: "#8B3100", name: "Dark Rust" },
      { hex: "#6B1A2A", name: "Dark Warm Burgundy" },
      { hex: "#4B0082", name: "Deep Eggplant" },
    ],
    forbidden: [
      { hex: "#FFB6C1", name: "Light Pink" },
      { hex: "#AED6F1", name: "Pastel Blue" },
    ],
    metals: [
      { hex: "#D4AF37", name: "Rich Gold" },
      { hex: "#8B4513", name: "Dark Copper" },
    ],
  },
  "True Winter": {
    description:
      "Crisp and icy — pure, cool tones with a frosty elegance and high contrast.",
    primary: [
      { hex: "#FFFFFF", name: "Pure White" },
      { hex: "#000000", name: "Black" },
      { hex: "#CC0000", name: "True Red" },
      { hex: "#4169E1", name: "Royal Blue" },
      { hex: "#D6ECFF", name: "Icy Blue" },
      { hex: "#FF00FF", name: "Hot Fuchsia" },
      { hex: "#0F52BA", name: "Sapphire" },
      { hex: "#50C878", name: "Emerald" },
      { hex: "#872657", name: "Cold Raspberry" },
      { hex: "#301934", name: "Deep Purple" },
      { hex: "#808080", name: "Cool Gray" },
    ],
    accent: [
      { hex: "#CC0000", name: "True Red" },
      { hex: "#FF00FF", name: "Hot Fuchsia" },
      { hex: "#50C878", name: "Emerald" },
      { hex: "#4169E1", name: "Royal Blue" },
    ],
    forbidden: [
      { hex: "#FFF8DC", name: "Warm Cream" },
      { hex: "#FFA500", name: "Orange" },
      { hex: "#F5F5DC", name: "Beige" },
    ],
    metals: [
      { hex: "#C0C0C0", name: "Silver" },
      { hex: "#E8E4D0", name: "White Gold" },
      { hex: "#E5E4E2", name: "Platinum" },
    ],
  },
  "Dark Winter": {
    description:
      "Bold and striking — deep, cool jewel tones create powerful contrast.",
    primary: [
      { hex: "#082567", name: "Dark Sapphire" },
      { hex: "#014421", name: "Deep Emerald" },
      { hex: "#000000", name: "Black" },
      { hex: "#4A0010", name: "Deep Burgundy" },
      { hex: "#2D0054", name: "Dark Purple" },
      { hex: "#1A3A2A", name: "Dark Forest" },
      { hex: "#8B0000", name: "Deep Red" },
      { hex: "#36454F", name: "Charcoal" },
    ],
    accent: [
      { hex: "#082567", name: "Dark Sapphire" },
      { hex: "#8B0000", name: "Deep Red" },
      { hex: "#014421", name: "Deep Emerald" },
      { hex: "#2D0054", name: "Dark Purple" },
    ],
    forbidden: [
      { hex: "#FFB6C1", name: "Light Pink" },
      { hex: "#D2B48C", name: "Warm Beige" },
    ],
    metals: [
      { hex: "#A8A9AD", name: "Dark Silver" },
      { hex: "#3D3C3A", name: "Hematite" },
    ],
  },
  "Bright Winter": {
    description:
      "Vivid and high-contrast — pure, saturated colors with a cool clarity.",
    primary: [
      { hex: "#00FFFF", name: "Bright Turquoise" },
      { hex: "#FF00FF", name: "Bright Magenta" },
      { hex: "#FFF44F", name: "Lemon Yellow" },
      { hex: "#0047AB", name: "Bright Cobalt" },
      { hex: "#FFFFFF", name: "Pure White" },
      { hex: "#000000", name: "Black" },
      { hex: "#00FF7F", name: "Bright Cool Green" },
      { hex: "#C71585", name: "Cool Raspberry" },
    ],
    accent: [
      { hex: "#00FFFF", name: "Bright Turquoise" },
      { hex: "#FF00FF", name: "Bright Magenta" },
      { hex: "#0047AB", name: "Bright Cobalt" },
      { hex: "#C71585", name: "Cool Raspberry" },
    ],
    forbidden: [
      { hex: "#9E9E9E", name: "Muted" },
      { hex: "#D2B48C", name: "Warm Tones" },
    ],
    metals: [
      { hex: "#C0C0C0", name: "Silver" },
      { hex: "#E8E4D0", name: "White Gold" },
    ],
  },
};

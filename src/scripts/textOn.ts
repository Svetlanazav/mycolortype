/**
 * Text colors for labels drawn on top of an analysed color.
 *
 * These swatches show whatever color the analysis found, so the label color
 * has to be derived rather than authored. The components used to switch on
 * `0.299r + 0.587g + 0.114b > 120`, which is not a contrast measure: mid-tones
 * such as rgb(171, 106, 124) sit just above the threshold, get dark text, and
 * land at 4.3:1 — and the muted second line, drawn at 50-70% opacity, fell as
 * low as 2.5:1. Picking by measured contrast instead keeps every label legible
 * whatever the photo produces.
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

const NEAR_BLACK: RGB = { r: 17, g: 24, b: 39 };
const WHITE: RGB = { r: 255, g: 255, b: 255 };

/** WCAG AA for normal-size text. */
const AA_NORMAL = 4.5;

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance({ r, g, b }: RGB): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function toCss({ r, g, b }: RGB): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function mix(fg: RGB, bg: RGB, alpha: number): RGB {
  return {
    r: fg.r * alpha + bg.r * (1 - alpha),
    g: fg.g * alpha + bg.g * (1 - alpha),
    b: fg.b * alpha + bg.b * (1 - alpha),
  };
}

/** Whichever of near-black / white reads better on `bg`. */
export function textOn(bg: RGB): string {
  const dark = contrastRatio(NEAR_BLACK, bg);
  const light = contrastRatio(WHITE, bg);
  return toCss(dark >= light ? NEAR_BLACK : WHITE);
}

/**
 * A softened version of `textOn` for secondary lines — faded as far towards the
 * background as it can go while still clearing AA, so the hierarchy survives
 * without the label becoming unreadable.
 */
export function mutedTextOn(bg: RGB): string {
  const base =
    contrastRatio(NEAR_BLACK, bg) >= contrastRatio(WHITE, bg)
      ? NEAR_BLACK
      : WHITE;

  for (let alpha = 1; alpha >= 0.4; alpha -= 0.05) {
    const candidate = mix(base, bg, alpha);
    if (contrastRatio(candidate, bg) < AA_NORMAL) {
      return toCss(mix(base, bg, Math.min(1, alpha + 0.05)));
    }
  }
  return toCss(mix(base, bg, 0.45));
}

/** Parse a `#rrggbb` string into RGB. */
export function hexToRgb(hex: string): RGB {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

/**
 * Diagnostic: shows what FaceColorAnalyzer actually samples from the test image.
 * Prints pixel statistics per region so we can see what's wrong.
 */
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

interface RGB { r: number; g: number; b: number }
interface HSV { h: number; s: number; v: number }

function rgbToHsv(c: RGB): HSV {
  const r = c.r / 255, g = c.g / 255, b = c.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), diff = max - min;
  let h = 0;
  if (diff !== 0) {
    if (max === r) h = ((g - b) / diff) % 6;
    else if (max === g) h = (b - r) / diff + 2;
    else h = (r - g) / diff + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : diff / max, v: max };
}

function toHex(c: RGB): string {
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`;
}

async function main() {
  const { data, info } = await sharp(join(root, "src/tests/fixtures/blue-eyes-test.jpg"))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const buf = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);

  const landmarks = JSON.parse(
    await readFile(join(root, "src/tests/fixtures/blue-eyes-landmarks.json"), "utf-8")
  ) as Array<{ x: number; y: number; z: number }>;

  function getPixel(x: number, y: number): RGB {
    const xi = Math.max(0, Math.min(W - 1, Math.floor(x)));
    const yi = Math.max(0, Math.min(H - 1, Math.floor(y)));
    const i = (yi * W + xi) * 4;
    return { r: buf[i]!, g: buf[i + 1]!, b: buf[i + 2]! };
  }

  // ── IRIS diagnostic ──
  console.log("=== IRIS DIAGNOSTIC ===");
  for (const [label, centerIdx, perimIdx] of [
    ["Left iris", 468, [469, 470, 471, 472]] as const,
    ["Right iris", 473, [474, 475, 476, 477]] as const,
  ]) {
    const center = landmarks[centerIdx]!;
    const cx = center.x * W, cy = center.y * H;
    console.log(`\n${label}: center pixel (${Math.round(cx)}, ${Math.round(cy)})`);
    console.log(`  Center pixel color: ${toHex(getPixel(cx, cy))}`);

    const allDistances = perimIdx.map((idx) => {
      const p = landmarks[idx]!;
      return Math.sqrt((p.x * W - cx) ** 2 + (p.y * H - cy) ** 2);
    });
    console.log(`  Per-landmark distances: ${allDistances.map(d => d.toFixed(1)).join(", ")}`);
    const irisRadius = Math.min(...perimIdx.map((idx) => {
      const p = landmarks[idx]!;
      return Math.sqrt((p.x * W - cx) ** 2 + (p.y * H - cy) ** 2);
    }));
    console.log(`  Iris radius: ${irisRadius.toFixed(1)}px`);

    const pupilR = irisRadius * 0.45;
    const outerR = irisRadius * 0.85;

    let total = 0, tooFark = 0, tooBright = 0, tooGrey = 0, valid = 0;
    const validColors: RGB[] = [];
    const allColors: RGB[] = [];

    const r = Math.ceil(outerR);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < pupilR || dist > outerR) continue;
        total++;
        const color = getPixel(cx + dx, cy + dy);
        allColors.push(color);
        const brightness = (color.r + color.g + color.b) / 3;
        if (brightness <= 40) { tooFark++; continue; }
        if (brightness >= 245) { tooBright++; continue; }
        if (rgbToHsv(color).s < 0.05) { tooGrey++; continue; }
        valid++;
        validColors.push(color);
      }
    }
    console.log(`  Ring pixels: ${total} total, ${tooFark} too dark, ${tooBright} too bright, ${tooGrey} too grey, ${valid} valid`);

    // Show brightness/saturation distribution of ALL ring pixels
    const allBrightness = allColors.map(c => (c.r + c.g + c.b) / 3);
    const allSaturation = allColors.map(c => rgbToHsv(c).s);
    console.log(`  All ring - brightness: min=${Math.min(...allBrightness).toFixed(0)} max=${Math.max(...allBrightness).toFixed(0)} avg=${(allBrightness.reduce((a,b)=>a+b,0)/allBrightness.length).toFixed(0)}`);
    console.log(`  All ring - saturation: min=${Math.min(...allSaturation).toFixed(2)} max=${Math.max(...allSaturation).toFixed(2)} avg=${(allSaturation.reduce((a,b)=>a+b,0)/allSaturation.length).toFixed(2)}`);

    if (validColors.length > 0) {
      // Show valid pixels stats
      const avgR = Math.round(validColors.reduce((s,c) => s + c.r, 0) / validColors.length);
      const avgG = Math.round(validColors.reduce((s,c) => s + c.g, 0) / validColors.length);
      const avgB = Math.round(validColors.reduce((s,c) => s + c.b, 0) / validColors.length);
      console.log(`  Valid avg: ${toHex({r:avgR,g:avgG,b:avgB})} (r:${avgR} g:${avgG} b:${avgB})`);

      // Top 40% saturated (what getDominantSaturatedColor does)
      const sorted = [...validColors].sort((a, b) => rgbToHsv(b).s - rgbToHsv(a).s);
      const topN = Math.max(3, Math.ceil(sorted.length * 0.4));
      const top = sorted.slice(0, topN);
      const tR = Math.round(top.reduce((s,c)=>s+c.r,0)/top.length);
      const tG = Math.round(top.reduce((s,c)=>s+c.g,0)/top.length);
      const tB = Math.round(top.reduce((s,c)=>s+c.b,0)/top.length);
      console.log(`  Top ${topN}/${validColors.length} saturated: ${toHex({r:tR,g:tG,b:tB})} (r:${tR} g:${tG} b:${tB})`);

      // Show some sample pixels
      console.log("  Sample valid pixels:");
      for (let i = 0; i < Math.min(10, validColors.length); i += 1) {
        const idx = Math.floor(i * validColors.length / 10);
        const c = validColors[idx]!;
        const hsv = rgbToHsv(c);
        console.log(`    ${toHex(c)} bright=${((c.r+c.g+c.b)/3).toFixed(0)} sat=${hsv.s.toFixed(2)} hue=${hsv.h}`);
      }
    }
  }

  // ── SKIN diagnostic ──
  console.log("\n=== SKIN DIAGNOSTIC ===");
  const skinIndices = [118, 119, 100, 36, 50, 329, 348, 347, 280, 266, 151, 108, 69, 109, 10, 338, 297, 337, 4, 195, 5];
  const skinColors: RGB[] = [];
  skinIndices.forEach((index) => {
    const point = landmarks[index]!;
    const px = point.x * W, py = point.y * H;
    const c = getPixel(px, py);
    console.log(`  [${index}] (${Math.round(px)},${Math.round(py)}) ${toHex(c)} bright=${((c.r+c.g+c.b)/3).toFixed(0)} hue=${rgbToHsv(c).h} sat=${rgbToHsv(c).s.toFixed(2)}`);
    skinColors.push(c);
  });

  // ── LIPS diagnostic ──
  console.log("\n=== LIPS DIAGNOSTIC ===");
  const outerLipIndices = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
  console.log("Outer lip landmark pixels:");
  outerLipIndices.forEach((idx) => {
    const p = landmarks[idx]!;
    const c = getPixel(p.x * W, p.y * H);
    console.log(`  [${idx}] (${Math.round(p.x * W)},${Math.round(p.y * H)}) ${toHex(c)}`);
  });

  // ── BROWS diagnostic ──
  console.log("\n=== BROWS DIAGNOSTIC ===");
  const browIndices = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46, 300, 293, 334, 296, 336, 285, 295, 282, 283, 276];
  browIndices.forEach((idx) => {
    const p = landmarks[idx]!;
    const c = getPixel(p.x * W, p.y * H);
    const bright = (c.r + c.g + c.b) / 3;
    console.log(`  [${idx}] (${Math.round(p.x * W)},${Math.round(p.y * H)}) ${toHex(c)} bright=${bright.toFixed(0)}`);
  });
}

main().catch(console.error);

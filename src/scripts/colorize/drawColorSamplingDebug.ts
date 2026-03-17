import { type NormalizedLandmark } from "@mediapipe/tasks-vision";

/**
 * Draws color-sampling regions on a canvas for debugging purposes.
 * Shows exactly where iris, lip, brow, and skin colors are extracted from.
 */
export function drawColorSamplingDebug(
  canvas: HTMLCanvasElement,
  landmarks: NormalizedLandmark[],
): void {
  const rawCtx = canvas.getContext("2d");
  if (!rawCtx || landmarks.length === 0) return;
  // Re-bind so TypeScript knows ctx is non-null inside nested functions
  const ctx = rawCtx;

  const w = canvas.width;
  const h = canvas.height;
  const px = (lm: NormalizedLandmark) => ({ x: lm.x * w, y: lm.y * h });

  // ── Helpers ────────────────────────────────────────────────────────────────

  function drawRing(
    cx: number,
    cy: number,
    innerR: number,
    outerR: number,
    color: string,
  ) {
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true); // hole
    ctx.fillStyle = color;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.strokeStyle = color.replace(/[\d.]+\)$/, "1)");
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawPolygon(
    indices: number[],
    fillColor: string,
    strokeColor: string,
  ) {
    if (indices.length === 0) return;
    ctx.beginPath();
    const first = px(landmarks[indices[0]!]!);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < indices.length; i++) {
      const p = px(landmarks[indices[i]!]!);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawDots(
    indices: number[],
    radius: number,
    color: string,
  ) {
    ctx.fillStyle = color;
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 0.5;
    indices.forEach((i) => {
      const p = px(landmarks[i]!);
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }

  // ── Iris rings ─────────────────────────────────────────────────────────────

  function drawIrisRing(
    centerIdx: number,
    perimeterIndices: number[],
    color: string,
  ) {
    const center = landmarks[centerIdx];
    if (!center) return;
    const cp = px(center);

    const irisRadius = Math.max(
      ...perimeterIndices.map((i) => {
        const p = px(landmarks[i]!);
        return Math.hypot(p.x - cp.x, p.y - cp.y);
      }),
    );
    const pupilRadius = irisRadius * 0.38;
    const outerRadius = irisRadius * 0.90; // matches sampleIrisRing outer bound

    drawRing(cp.x, cp.y, pupilRadius, outerRadius, color);

    // Center dot
    ctx.beginPath();
    ctx.arc(cp.x, cp.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fill();
  }

  // ── Skin sampling points ───────────────────────────────────────────────────

  const SKIN_SAMPLE_RADIUS = 5;
  const skinIndices = [
    118, 119, 100, 36, 50,          // left cheek
    329, 348, 347, 280, 266,         // right cheek
    151, 108, 69, 109, 10, 338, 297, 337, // forehead
    4, 195, 5,                       // nose tip
  ];

  // Draw skin sample circles
  ctx.fillStyle = "rgba(255, 220, 100, 0.35)";
  ctx.strokeStyle = "rgba(255, 200, 0, 0.9)";
  ctx.lineWidth = 1;
  skinIndices.forEach((i) => {
    const p = px(landmarks[i]!);
    ctx.beginPath();
    ctx.arc(p.x, p.y, SKIN_SAMPLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // ── Brow points ────────────────────────────────────────────────────────────

  const BROW_SAMPLE_RADIUS = 3;
  const browIndices = [
    70, 63, 105, 66, 107, 55, 65, 52, 53, 46,
    300, 293, 334, 296, 336, 285, 295, 282, 283, 276,
  ];

  ctx.fillStyle = "rgba(180, 100, 255, 0.45)";
  ctx.strokeStyle = "rgba(200, 130, 255, 0.95)";
  ctx.lineWidth = 0.8;
  browIndices.forEach((i) => {
    const p = px(landmarks[i]!);
    ctx.beginPath();
    ctx.arc(p.x, p.y, BROW_SAMPLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // ── Lip polygons ───────────────────────────────────────────────────────────

  const outerLip = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
  const innerLip = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191];

  drawPolygon(outerLip, "rgba(255, 80, 120, 0.35)", "rgba(255, 80, 120, 0.95)");
  drawPolygon(innerLip, "rgba(0,0,0,0.15)", "rgba(255, 160, 180, 0.7)");

  // ── Iris ───────────────────────────────────────────────────────────────────

  drawIrisRing(468, [469, 470, 471, 472], "rgba(80, 200, 255, 0.35)");
  drawIrisRing(473, [474, 475, 476, 477], "rgba(80, 200, 255, 0.35)");

  drawDots([469, 470, 471, 472, 474, 475, 476, 477], 1.5, "rgba(80,200,255,0.9)");

  // ── Legend ─────────────────────────────────────────────────────────────────

  const legend = [
    { color: "rgba(80, 200, 255, 0.8)",  label: "Iris" },
    { color: "rgba(255, 80, 120, 0.8)",  label: "Lips" },
    { color: "rgba(180, 100, 255, 0.8)", label: "Brows" },
    { color: "rgba(255, 200, 0, 0.8)",   label: "Skin" },
  ];

  const fontSize = Math.max(10, Math.round(w / 60));
  ctx.font = `${fontSize}px sans-serif`;
  const pad = 8;
  const lineH = fontSize + 6;
  const boxW = fontSize * 5.5;
  const boxH = pad * 2 + lineH * legend.length;
  const bx = w - boxW - pad;
  const by = pad;

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(bx, by, boxW, boxH);

  legend.forEach(({ color, label }, i) => {
    const y = by + pad + i * lineH;
    ctx.fillStyle = color;
    ctx.fillRect(bx + pad, y + 2, fontSize, fontSize - 2);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText(label, bx + pad + fontSize + 5, y + fontSize - 1);
  });
}

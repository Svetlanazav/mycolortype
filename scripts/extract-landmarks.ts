/**
 * Playwright script: extract MediaPipe FaceLandmarker landmarks from a JPEG.
 *
 * Usage:
 *   npx tsx scripts/extract-landmarks.ts [image-path] [output-path]
 *
 * Defaults:
 *   image-path  → src/tests/fixtures/blue-eyes-test.jpg
 *   output-path → src/tests/fixtures/blue-eyes-landmarks.json
 */

import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname ?? ".", "..");
const imagePath = resolve(root, process.argv[2] ?? "src/tests/fixtures/blue-eyes-test.jpg");
const outputPath = resolve(root, process.argv[3] ?? "src/tests/fixtures/blue-eyes-landmarks.json");

async function main() {
  const imageBuffer = await readFile(imagePath);
  const base64 = imageBuffer.toString("base64");
  const mimeType = imagePath.endsWith(".png") ? "image/png" : "image/jpeg";
  const dataUri = `data:${mimeType};base64,${base64}`;

  console.log(`Loading image: ${imagePath} (${imageBuffer.length} bytes)`);

  const browser = await chromium.launch({
    headless: false,
    args: ["--use-gl=angle", "--use-angle=swiftshader"],
  });
  const page = await browser.newPage();

  // Minimal HTML page that loads MediaPipe and detects landmarks
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
  <img id="photo" style="display:block" />
  <script type="module">
    import { FilesetResolver, FaceLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/+esm";

    window.__extractLandmarks = async (dataUri) => {
      const fileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );
      const landmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU",
        },
        outputFaceBlendshapes: false,
        runningMode: "IMAGE",
        numFaces: 1,
      });

      const img = document.getElementById("photo");
      img.src = dataUri;
      await new Promise((r) => { img.onload = r; });

      const result = landmarker.detect(img);
      landmarker.close();

      if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
        throw new Error("No face detected in image");
      }

      return result.faceLandmarks[0];
    };
  </script>
</body>
</html>`;

  await page.setContent(html, { waitUntil: "networkidle" });

  // Wait for the module to load
  await page.waitForFunction(() => typeof (window as any).__extractLandmarks === "function", {
    timeout: 30_000,
  });

  console.log("MediaPipe loaded, extracting landmarks...");

  const landmarks = await page.evaluate(async (uri: string) => {
    return await (window as any).__extractLandmarks(uri);
  }, dataUri);

  await browser.close();

  if (!Array.isArray(landmarks) || landmarks.length !== 478) {
    throw new Error(`Expected 478 landmarks, got ${Array.isArray(landmarks) ? landmarks.length : "non-array"}`);
  }

  await writeFile(outputPath, JSON.stringify(landmarks, null, 2));
  console.log(`Saved ${landmarks.length} landmarks to ${outputPath}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

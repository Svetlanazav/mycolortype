/**
 * Downscale a data-URL image so it survives the hand-off to the analysis page.
 *
 * The photo travels through `sessionStorage`, which Chrome caps at roughly 5 MB
 * per origin. A full-resolution phone photo (12 MP) base64-encodes to 4-8 MB, so
 * storing it raw threw `QuotaExceededError` and — because the throw happened
 * before the navigation — the "Start Analysis" button silently did nothing.
 *
 * 1600px on the long edge is far more than the analysis needs: the MediaPipe
 * segmenter runs at 256x256 and face landmarks are normalised, so nothing
 * downstream benefits from the extra pixels.
 */

const DEFAULT_MAX_EDGE = 1600;
const DEFAULT_QUALITY = 0.85;

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the selected image"));
    img.src = dataUrl;
  });
}

/**
 * Re-encode `dataUrl` as JPEG, scaled so neither edge exceeds `maxEdge`.
 * Images already within bounds are still re-encoded, which is what shrinks
 * an oversized PNG or an uncompressed camera capture.
 */
export async function compressImage(
  dataUrl: string,
  maxEdge: number = DEFAULT_MAX_EDGE,
  quality: number = DEFAULT_QUALITY,
): Promise<string> {
  const img = await loadImage(dataUrl);

  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process the selected image");

  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Store an image in sessionStorage, shrinking further if the browser still
 * refuses it. Throws only when even the smallest variant will not fit.
 */
export async function storeImageForAnalysis(
  key: string,
  dataUrl: string,
): Promise<void> {
  const attempts: Array<[number, number]> = [
    [DEFAULT_MAX_EDGE, DEFAULT_QUALITY],
    [1024, 0.8],
    [640, 0.7],
  ];

  let lastError: unknown = null;

  for (const [maxEdge, quality] of attempts) {
    try {
      sessionStorage.setItem(key, await compressImage(dataUrl, maxEdge, quality));
      return;
    } catch (err: unknown) {
      lastError = err;
      // Anything other than a quota problem will not be fixed by shrinking.
      const isQuota =
        err instanceof DOMException &&
        (err.name === "QuotaExceededError" ||
          err.name === "NS_ERROR_DOM_QUOTA_REACHED");
      if (!isQuota) throw err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not store the image for analysis");
}

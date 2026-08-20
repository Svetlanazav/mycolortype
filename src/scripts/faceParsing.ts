/**
 * Main-thread client for the face-parsing worker.
 *
 * All model loading and inference happens in `faceParsing.worker.ts`; this
 * module only marshals pixels across and resolves the reply. Keeping the
 * ~8s SegFormer inference off the main thread is the whole point — see the
 * worker's header comment.
 */

import type {
  FaceParsingColors,
  FaceParsingRequest,
  FaceParsingResponse,
} from "./faceParsing.worker";

export type { FaceParsingColors };

let worker: Worker | null = null;
let loadPromise: Promise<void> | null = null;
let loaded = false;
let nextId = 0;

/** Pending `analyze` calls, keyed by request id. */
const pending = new Map<
  number,
  { resolve: (colors: FaceParsingColors) => void; reject: (err: Error) => void }
>();

let resolveLoad: (() => void) | null = null;
let rejectLoad: ((err: Error) => void) | null = null;

function post(worker: Worker, message: FaceParsingRequest, transfer?: Transferable[]): void {
  if (transfer) {
    worker.postMessage(message, transfer);
  } else {
    worker.postMessage(message);
  }
}

function handleMessage(event: MessageEvent<FaceParsingResponse>): void {
  const msg = event.data;

  switch (msg.type) {
    case "loaded":
      loaded = true;
      resolveLoad?.();
      return;
    case "loadError":
      rejectLoad?.(new Error(msg.message));
      return;
    case "result":
      pending.get(msg.id)?.resolve(msg.colors);
      pending.delete(msg.id);
      return;
    case "analyzeError":
      pending.get(msg.id)?.reject(new Error(msg.message));
      pending.delete(msg.id);
      return;
  }
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./faceParsing.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.addEventListener("message", handleMessage);
  }
  return worker;
}

/**
 * Start downloading and initialising the model in the worker.
 * Resolves once the model is ready; safe to call repeatedly.
 */
export function loadFaceParser(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise<void>((resolve, reject) => {
    resolveLoad = resolve;
    rejectLoad = reject;
    post(getWorker(), { type: "load" });
  });
  return loadPromise;
}

export function isFaceParserLoaded(): boolean {
  return loaded;
}

/**
 * Run face-parsing on the given canvas and return dominant colors for
 * skin, hair, lips, and brows. Returns null if the model failed to load.
 *
 * The canvas pixels are copied and transferred to the worker, so the caller's
 * canvas is left untouched.
 */
export async function analyzeFaceWithParsing(
  canvas: HTMLCanvasElement,
): Promise<FaceParsingColors | null> {
  try {
    await loadFaceParser();
  } catch {
    return null;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  // Copy so the transfer does not neuter the caller's ImageData buffer.
  const buffer = imageData.data.slice().buffer;
  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

  const id = nextId++;
  const result = new Promise<FaceParsingColors>((resolve, reject) => {
    pending.set(id, { resolve, reject });
  });

  post(
    getWorker(),
    {
      type: "analyze",
      id,
      dataUrl,
      buffer,
      width: imageData.width,
      height: imageData.height,
    },
    [buffer],
  );

  return result;
}

import {
  ImageSegmenter,
  FilesetResolver,
  ImageSegmenterResult,
  FaceLandmarker,
  type FaceLandmarkerResult,
  DrawingUtils,
} from "@mediapipe/tasks-vision";
import {
  colorizeImgMaskedObjects,
  colorizeMaskedObjects as colorizeVideoMaskedObjects,
} from "./transform";
// import { analyzeImageCategories } from "./avrcolor";
import { analyzeImageCategoriesEnhanced as analyzeImageCategories } from "./avrcolorenhanced";
import { determineSeasonalPalette } from "./seasonanalysis";

// Get DOM elements
const video = document.getElementById("webcam") as HTMLVideoElement;
const canvasElement = document.getElementById("canvas") as HTMLCanvasElement;
const imageBlendShapes = document.getElementById("image-blend-shapes");
const canvasCtx = canvasElement.getContext("2d");
const demosSection: HTMLElement = document.getElementById("demos")!;
let enableWebcamButton: HTMLButtonElement;
let webcamRunning: Boolean = false;
let runningMode: "IMAGE" | "VIDEO" = "IMAGE";
let faceLandmarker: FaceLandmarker;

let imageSegmenter: ImageSegmenter;
let labels: Array<string>;

const createImageSegmenter = async () => {
  const filesetresolver = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
  );

  imageSegmenter = await ImageSegmenter.createFromOptions(filesetresolver, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite",
      delegate: "GPU",
    },
    runningMode: runningMode,
    outputCategoryMask: true,
    outputConfidenceMasks: false,
  });
  faceLandmarker = await FaceLandmarker.createFromOptions(filesetresolver, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
      delegate: "GPU",
    },
    outputFaceBlendshapes: true,
    runningMode,
    numFaces: 1,
  });

  labels = imageSegmenter.getLabels();
  demosSection.classList.remove("invisible");
};
createImageSegmenter();

const imageContainers: HTMLCollectionOf<Element> =
  document.getElementsByClassName("segmentOnClick");

// Add click event listeners for the img elements.
for (let i = 0; i < imageContainers.length; i++) {
  imageContainers[i]!.getElementsByTagName("img")![0]!.addEventListener(
    "click",
    handleClick
  );
}

/**
 * Demo 1: Segmented images on click and display results.
 */

let canvasClick: HTMLCanvasElement;
async function handleClick(event: any) {
  // Do not segmented if imageSegmenter hasn't loaded
  if (imageSegmenter === undefined) {
    return;
  }
  canvasClick = event.target.parentElement.getElementsByTagName("canvas")[0];
  canvasClick.classList.remove("removed");
  canvasClick.width = event.target.naturalWidth;
  canvasClick.height = event.target.naturalHeight;
  const cxt = canvasClick.getContext("2d")!;
  cxt.clearRect(0, 0, canvasClick.width, canvasClick.height);
  cxt.drawImage(event.target, 0, 0, canvasClick.width, canvasClick.height);
  event.target.style.opacity = 0;
  // if VIDEO mode is initialized, set runningMode to IMAGE
  if (runningMode === "VIDEO") {
    runningMode = "IMAGE";
    await imageSegmenter.setOptions({
      runningMode: runningMode,
    });
  }

  const { promise: imageSegmenterCallbackHasBeenCalled, resolve } =
    Promise.withResolvers<void>();
  // imageSegmenter.segment() when resolved will call the callback function.
  imageSegmenter.segment(event.target, (result) => {
    processImageSegmenterResult(result);
    resolve();
  });

  await imageSegmenterCallbackHasBeenCalled;

  const faceLandmarkerResult = faceLandmarker.detect(event.target);
  processFaceLandmarkerResult(faceLandmarkerResult);
}

function processFaceLandmarkerResult(result: FaceLandmarkerResult) {
  result;
  event.target!.parentNode.appendChild(canvasClick);
  const ctx = canvasClick.getContext("2d");
  const drawingUtils = new DrawingUtils(ctx!);
  for (const landmarks of result.faceLandmarks) {
    drawingUtils.drawConnectors(
      landmarks,
      FaceLandmarker.FACE_LANDMARKS_TESSELATION,
      { color: "#C0C0C070", lineWidth: 1 }
    );
    drawingUtils.drawConnectors(
      landmarks,
      FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
      { color: "#FF3030" }
    );
    drawingUtils.drawConnectors(
      landmarks,
      FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
      { color: "#FF3030" }
    );
    drawingUtils.drawConnectors(
      landmarks,
      FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
      { color: "#30FF30" }
    );
    drawingUtils.drawConnectors(
      landmarks,
      FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
      { color: "#30FF30" }
    );
    drawingUtils.drawConnectors(
      landmarks,
      FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
      { color: "#E0E0E0" }
    );
    drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, {
      color: "#E0E0E0",
    });
    drawingUtils.drawConnectors(
      landmarks,
      FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
      { color: "#FF3030" }
    );
    drawingUtils.drawConnectors(
      landmarks,
      FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
      { color: "#30FF30" }
    );
  }
  drawBlendShapes(imageBlendShapes!, result.faceBlendshapes);
}

function processImageSegmenterResult(result: ImageSegmenterResult) {
  const cxt = canvasClick.getContext("2d")!;
  const { width, height } = result.categoryMask;
  let imageData = cxt.getImageData(0, 0, width, height).data;
  canvasClick.width = width;
  canvasClick.height = height;
  const enhancedCategoryColors = analyzeImageCategories(
    result,
    new Uint8ClampedArray(imageData.buffer.slice(0))
  );
  window["img1"] = enhancedCategoryColors;
  window["img_season"] = determineSeasonalPalette(enhancedCategoryColors);
  const [uint8Array, category] = colorizeImgMaskedObjects(
    result,
    imageData,
    labels
  );
  const dataNew = new ImageData(uint8Array, width, height);
  cxt.putImageData(dataNew, 0, 0);
  const p: HTMLElement =
    event.target.parentNode.getElementsByClassName("classification")[0];
  p.classList.remove("removed");
  p.innerText = "Category: " + category;
}

function callbackForVideo(result: ImageSegmenterResult) {
  let imageData = canvasCtx.getImageData(
    0,
    0,
    video.videoWidth,
    video.videoHeight
  ).data;
  const uint8Array = colorizeVideoMaskedObjects(
    result,
    new Uint8ClampedArray(imageData.buffer.slice(0))
  );
  window["colors"] = analyzeImageCategories(
    result,
    new Uint8ClampedArray(imageData.buffer.slice(0))
  );
  const dataNew = new ImageData(
    new Uint8ClampedArray(imageData.buffer.slice(0)),
    video.videoWidth,
    video.videoHeight
  );
  canvasCtx.putImageData(dataNew, 0, 0);
  if (webcamRunning === true) {
    window.requestAnimationFrame(predictWebcam);
  }
}

function drawBlendShapes(el: HTMLElement, blendShapes: any[]) {
  if (!blendShapes.length) {
    return;
  }

  console.log(blendShapes[0]);

  let htmlMaker = "";
  blendShapes[0].categories.map((shape) => {
    htmlMaker += `
      <li class="blend-shapes-item">
        <span class="blend-shapes-label">${
          shape.displayName || shape.categoryName
        }</span>
        <span class="blend-shapes-value" style="width: calc(${
          +shape.score * 100
        }% - 120px)">${(+shape.score).toFixed(4)}</span>
      </li>
    `;
  });

  el.innerHTML = htmlMaker;
}
/********************************************************************
// Demo 2: Continuously grab image from webcam stream and segmented it.
********************************************************************/

// Check if webcam access is supported.
function hasGetUserMedia() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// Get segmentation from the webcam
let lastWebcamTime = -1;
async function predictWebcam() {
  if (video.currentTime === lastWebcamTime) {
    if (webcamRunning === true) {
      window.requestAnimationFrame(predictWebcam);
    }
    return;
  }
  lastWebcamTime = video.currentTime;
  canvasCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
  // Do not segmented if imageSegmenter hasn't loaded
  if (imageSegmenter === undefined) {
    return;
  }
  // if image mode is initialized, create a new segmented with video runningMode
  if (runningMode === "IMAGE") {
    runningMode = "VIDEO";
    await imageSegmenter.setOptions({
      runningMode: runningMode,
    });
  }
  let startTimeMs = performance.now();

  // Start segmenting the stream.
  imageSegmenter.segmentForVideo(video, startTimeMs, callbackForVideo);
}

// Enable the live webcam view and start imageSegmentation.
async function enableCam(event) {
  if (imageSegmenter === undefined) {
    return;
  }

  if (webcamRunning === true) {
    webcamRunning = false;
    enableWebcamButton.innerText = "ENABLE SEGMENTATION";
  } else {
    webcamRunning = true;
    enableWebcamButton.innerText = "DISABLE SEGMENTATION";
  }

  // getUsermedia parameters.
  const constraints = {
    video: true,
  };

  // Activate the webcam stream.
  video.srcObject = await navigator.mediaDevices.getUserMedia(constraints);
  video.addEventListener("loadeddata", predictWebcam);
}

// If webcam supported, add event listener to button.
if (hasGetUserMedia()) {
  enableWebcamButton = document.getElementById(
    "webcamButton"
  ) as HTMLButtonElement;
  enableWebcamButton.addEventListener("click", enableCam);
} else {
  console.warn("getUserMedia() is not supported by your browser");
}

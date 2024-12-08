// Copyright 2023 The MediaPipe Authors.

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//      http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
  ImageSegmenter,
  FilesetResolver,
  ImageSegmenterResult,
} from "@mediapipe/tasks-vision";
import {
  colorizeImgMaskedObjects,
  colorizeMaskedObjects as colorizeVideoMaskedObjects,
} from "./transform";

// Get DOM elements
const video = document.getElementById("webcam") as HTMLVideoElement;
const canvasElement = document.getElementById("canvas") as HTMLCanvasElement;
const canvasCtx = canvasElement.getContext("2d");
const demosSection: HTMLElement = document.getElementById("demos")!;
let enableWebcamButton: HTMLButtonElement;
let webcamRunning: Boolean = false;
let runningMode: "IMAGE" | "VIDEO" = "IMAGE";

let imageSegmenter: ImageSegmenter;
let labels: Array<string>;

const createImageSegmenter = async () => {
  const audio = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2/wasm"
  );

  imageSegmenter = await ImageSegmenter.createFromOptions(audio, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite",
      delegate: "GPU",
    },
    runningMode: runningMode,
    outputCategoryMask: true,
    outputConfidenceMasks: false,
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

  // imageSegmenter.segment() when resolved will call the callback function.
  imageSegmenter.segment(event.target, callback);
}

function callback(result: ImageSegmenterResult) {
  const cxt = canvasClick.getContext("2d")!;
  const { width, height } = result.categoryMask;
  let imageData = cxt.getImageData(0, 0, width, height).data;
  canvasClick.width = width;
  canvasClick.height = height;
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
  const uint8Array = colorizeVideoMaskedObjects(result, imageData);
  const dataNew = new ImageData(
    uint8Array,
    video.videoWidth,
    video.videoHeight
  );
  canvasCtx.putImageData(dataNew, 0, 0);
  if (webcamRunning === true) {
    window.requestAnimationFrame(predictWebcam);
  }
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

import { ImageSegmenterResult } from "@mediapipe/tasks-vision";
import {
  colorizeImgMaskedObjects,
  colorizeMaskedObjects as colorizeVideoMaskedObjects,
} from "./transform";
// import { analyzeImageCategories } from "./avrcolor";
import { analyzeImageCategoriesEnhanced as analyzeImageCategories } from "./avrcolorenhanced";
import { determineSeasonalPalette } from "./seasonanalysis";
import { FaceColorAnalyzer } from "./facecolor";
import { displayColorSwatches } from "./displaycolors";
import {
  loadImageSegmenter,
  ImageSegmenterControl,
} from "./colorize/ImageSegmenter";
import { WebcamController } from "./colorize/WebcamController";
import { assert } from "./colorize/assert";
import { WebcamButton } from "./colorize/WebcamButton";
import { drawBlendShapes } from "./colorize/drawBlendShapes";
import { drawLandmarksOnCanvas } from "./colorize/drawLandmarksOnCanvas";
import { img2canvas } from "./colorize/img2canvas";

main();

function main() {
  const ctrl = new ImageSegmenterControl("IMAGE");
  loadImageSegmenter(ctrl);
  const handleClick = init(ctrl);

  const imageContainers: HTMLCollectionOf<Element> =
    document.getElementsByClassName("segmentOnClick");

  // Add click event listeners for the img elements.
  for (let i = 0; i < imageContainers.length; i++) {
    imageContainers[i]!.getElementsByTagName("img")![0]!.addEventListener(
      "click",
      handleClick
    );
  }

  const webcamController = new WebcamController();

  // Enable the live webcam view and start imageSegmentation.
  WebcamButton({
    onClick: async function enableCam(
      this: HTMLButtonElement,
      event: MouseEvent
    ) {
      if (!ctrl.loaded) {
        return;
      }
      if (webcamController.webcamRunning === true) {
        webcamController.webcamRunning = false;
        this.innerText = "ENABLE SEGMENTATION";
      } else {
        webcamController.webcamRunning = true;
        this.innerText = "DISABLE SEGMENTATION";
      }
      // Activate the webcam stream.
      webcamController.init(
        document.getElementById("webcam") as HTMLVideoElement
      );
    },
  });

  webcamController.addJob(async (video) => {
    const canvasElement = document.getElementById(
      "canvas"
    ) as HTMLCanvasElement;
    const canvasCtx = canvasElement.getContext("2d");
    assert(canvasCtx !== null, "canvasCtx is null");
    // draw the video frame to the canvas element
    canvasCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
    // Do not segmented if imageSegmenter hasn't loaded
    if (!ctrl.loaded) {
      return;
    }
    // Start segmenting the stream.
    await ctrl.setRunningMode({
      mode: "VIDEO",
      videoFrame: video,
      timestamp: performance.now(),
      callback: (result: ImageSegmenterResult) => {
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
        const state = window as { [key: string]: any };
        state["colors"] = analyzeImageCategories(
          result,
          new Uint8ClampedArray(imageData.buffer.slice(0))
        );
        const dataNew = new ImageData(
          new Uint8ClampedArray(imageData.buffer.slice(0)),
          video.videoWidth,
          video.videoHeight
        );
        canvasCtx.putImageData(dataNew, 0, 0);
        if (webcamController.webcamRunning === true) {
          window.requestAnimationFrame(webcamController.predictWebcam);
        }
      },
    });
  });
}
function init(ctrl: ImageSegmenterControl) {
  /**
   * Demo 1: Segmented images on click and display results.
   */
  async function handleClick(this: HTMLImageElement, event: MouseEvent) {
    const image = event.target as HTMLImageElement;
    assert(image !== null, "event.target is not an HTMLImageElement");
    if (!ctrl.loaded) {
      return;
    }
    const canvasClick = image.parentElement!.getElementsByTagName("canvas")[0]!;
    img2canvas(image, canvasClick);
    canvasClick.classList.remove("removed");
    image.style.opacity = "0";

    const { promise: imageSegmenterCallbackHasBeenCalled, resolve } =
      Promise.withResolvers<void>();

    await ctrl.setRunningMode({
      mode: "IMAGE",
      image: image,
      callback: (result) => {
        processImageSegmenterResult(event, canvasClick, result);
        resolve();
      },
    });

    await imageSegmenterCallbackHasBeenCalled;

    const faceLandmarkerResult = ctrl.faceLandmarker.detect(image);
    drawLandmarksOnCanvas(canvasClick, faceLandmarkerResult);
    drawBlendShapes(
      document.getElementById("image-blend-shapes")!,
      faceLandmarkerResult.faceBlendshapes
    );

    const canvas2 = document.createElement("canvas");
    img2canvas(image, canvas2);
    document.body.appendChild(canvas2);
    const cxt2 = canvas2.getContext("2d")!;
    const colorAnalyzer = new FaceColorAnalyzer(canvas2, cxt2!);
    const faceColors = colorAnalyzer.analyzeFaceColors(
      faceLandmarkerResult.faceLandmarks[0]!
    );
    displayColorSwatches(
      faceColors,
      document.getElementById("results-container")!
    );

    // console.log("Face Colors:", {
    //   leftIrisColor: `rgb(${faceColors.leftIris.r}, ${faceColors.leftIris.g}, ${faceColors.leftIris.b})`,
    //   rightIrisColor: `rgb(${faceColors.rightIris.r}, ${faceColors.rightIris.g}, ${faceColors.rightIris.b})`,
    //   lipsColor: `rgb(${faceColors.lips.r}, ${faceColors.lips.g}, ${faceColors.lips.b})`,
    //   skinColor: `rgb(${faceColors.skin.r}, ${faceColors.skin.g}, ${faceColors.skin.b})`,
    // });
  }

  function processImageSegmenterResult(
    event: MouseEvent,
    canvasClick: HTMLCanvasElement,
    result: ImageSegmenterResult
  ) {
    const cxt = canvasClick.getContext("2d")!;
    const { width, height } = result.categoryMask as {
      width: number;
      height: number;
    };
    let imageData = cxt.getImageData(0, 0, width, height).data;
    canvasClick.width = width;
    canvasClick.height = height;
    const enhancedCategoryColors = analyzeImageCategories(
      result,
      new Uint8ClampedArray(imageData.buffer.slice(0))
    );
    const state = window as { [key: string]: any };
    state["img1"] = enhancedCategoryColors;
    state["img_season"] = determineSeasonalPalette(enhancedCategoryColors);
    const [uint8Array, category] = colorizeImgMaskedObjects(
      result,
      imageData,
      ctrl.imageSegmenter.getLabels()
    );
    cxt.putImageData(new ImageData(uint8Array, width, height), 0, 0);
    const p = (
      (event.target! as HTMLElement).parentNode! as HTMLElement
    ).getElementsByClassName("classification")[0] as HTMLElement;
    p.classList.remove("removed");
    p.innerText = "Category: " + category;
  }
  return handleClick;
}

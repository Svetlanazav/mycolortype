import { ImageSegmenterResult } from "@mediapipe/tasks-vision";
import {
  colorizeImgMaskedObjects,
  colorizeMaskedObjects as colorizeVideoMaskedObjects,
} from "./transform";
import { analyzeImageCategoriesEnhanced as analyzeImageCategories } from "./avrcolorenhanced";
import { determineSeasonalPalette } from "./seasonanalysis";
import { FaceColorAnalyzer } from "./facecolor";
import { displayColorSwatches } from "./displaycolors";
import { loadFaceParser, analyzeFaceWithParsing } from "./faceParsing";
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

// Preload the face-parsing model in the background so it's ready when needed
loadFaceParser().catch(() => {
  // Non-fatal: face-parsing will not be available, MediaPipe results will be used
});

function main() {
  const ctrl = new ImageSegmenterControl("IMAGE");
  loadImageSegmenter(ctrl);
  const handleClick = init(ctrl);

  const imageContainers: HTMLCollectionOf<Element> =
    document.getElementsByClassName("segmentOnClick");

  for (let i = 0; i < imageContainers.length; i++) {
    imageContainers[i]!.getElementsByTagName("img")![0]!.addEventListener(
      "click",
      handleClick,
    );
  }

  const webcamController = new WebcamController();

  WebcamButton({
    onClick: async function enableCam(
      this: HTMLButtonElement,
      _event: MouseEvent,
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
      webcamController.init(
        document.getElementById("webcam") as HTMLVideoElement,
      );
    },
  });

  webcamController.addJob(async (video) => {
    const canvasElement = document.getElementById(
      "canvas",
    ) as HTMLCanvasElement;
    const canvasCtx = canvasElement.getContext("2d");
    assert(canvasCtx !== null, "canvasCtx is null");
    canvasCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
    if (!ctrl.loaded) {
      return;
    }
    await ctrl.setRunningMode({
      mode: "VIDEO",
      videoFrame: video,
      timestamp: performance.now(),
      callback: (result: ImageSegmenterResult) => {
        const imageData = canvasCtx.getImageData(
          0,
          0,
          video.videoWidth,
          video.videoHeight,
        ).data;
        colorizeVideoMaskedObjects(
          result,
          new Uint8ClampedArray(imageData.buffer.slice(0)),
        );
        window.dispatchEvent(
          new CustomEvent("analysis:colors", {
            detail: analyzeImageCategories(
              result,
              new Uint8ClampedArray(imageData.buffer.slice(0)),
            ),
          }),
        );
        const dataNew = new ImageData(
          new Uint8ClampedArray(imageData.buffer.slice(0)),
          video.videoWidth,
          video.videoHeight,
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

    window.dispatchEvent(
      new CustomEvent("analysis:start", {
        detail: { types: ["img1", "img_season"] },
      }),
    );

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
      faceLandmarkerResult.faceBlendshapes,
    );

    const canvas2 = document.createElement("canvas");
    img2canvas(image, canvas2);
    const cxt2 = canvas2.getContext("2d")!;
    const colorAnalyzer = new FaceColorAnalyzer(canvas2, cxt2);
    const faceColors = colorAnalyzer.analyzeFaceColors(
      faceLandmarkerResult.faceLandmarks[0]!,
    );

    const resultsContainer = document.getElementById("results-container")!;

    // Show MediaPipe results immediately
    displayColorSwatches(faceColors, resultsContainer);

    // Async: refine lips/skin/hair/brows via face-parsing (better accuracy)
    // When done, update the swatches in-place (iris stays from MediaPipe)
    analyzeFaceWithParsing(canvas2)
      .then((parsingColors) => {
        if (!parsingColors) return;
        displayColorSwatches(
          {
            ...faceColors,
            lips:  parsingColors.lips,
            skin:  parsingColors.skin,
            brows: parsingColors.brows,
          },
          resultsContainer,
        );
      })
      .catch(() => {
        // Parsing failed — MediaPipe results remain visible
      });
  }

  function processImageSegmenterResult(
    event: MouseEvent,
    canvasClick: HTMLCanvasElement,
    result: ImageSegmenterResult,
  ) {
    const cxt = canvasClick.getContext("2d")!;
    if (!result.categoryMask) {
      return;
    }
    const { width, height } = result.categoryMask as {
      width: number;
      height: number;
    };
    const imageData = cxt.getImageData(0, 0, width, height).data;
    canvasClick.width = width;
    canvasClick.height = height;
    const enhancedCategoryColors = analyzeImageCategories(
      result,
      new Uint8ClampedArray(imageData.buffer.slice(0)),
    );
    window.dispatchEvent(
      new CustomEvent("analysis:img1", { detail: enhancedCategoryColors }),
    );
    window.dispatchEvent(
      new CustomEvent("analysis:img_season", {
        detail: determineSeasonalPalette(enhancedCategoryColors),
      }),
    );
    const [uint8Array, category] = colorizeImgMaskedObjects(
      result,
      imageData,
      ctrl.imageSegmenter.getLabels(),
    );
    cxt.putImageData(new ImageData(new Uint8ClampedArray(uint8Array.buffer as ArrayBuffer), width, height), 0, 0);
    const p = (
      (event.target! as HTMLElement).parentNode! as HTMLElement
    ).getElementsByClassName("classification")[0] as HTMLElement;
    p.classList.remove("removed");
    p.innerText = "Category: " + category;
  }
  return handleClick;
}

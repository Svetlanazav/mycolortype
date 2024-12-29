import {
  FilesetResolver,
  FaceLandmarker,
  ImageSegmenter,
  type ImageSegmenterCallback,
} from "@mediapipe/tasks-vision";

type RunningMode = "IMAGE" | "VIDEO";

export class ImageSegmenterControl {
  public filesetResolver!: FilesetResolver;
  public imageSegmenter!: ImageSegmenter;
  public faceLandmarker!: FaceLandmarker;
  public loaded = false;
  constructor(private _runningMode: RunningMode) {}
  init(
    filesetResolver: FilesetResolver,
    imageSegmenter: ImageSegmenter,
    faceLandmarker: FaceLandmarker
  ) {
    this.filesetResolver = filesetResolver;
    this.imageSegmenter = imageSegmenter;
    this.faceLandmarker = faceLandmarker;
    this.loaded = true;
  }
  get runningMode() {
    return this._runningMode;
  }
  async setRunningMode(
    options:
      | {
          mode: "VIDEO";
          videoFrame: TexImageSource;
          timestamp: number;
          callback: ImageSegmenterCallback;
        }
      | {
          mode: "IMAGE";
          image: TexImageSource;
          callback: ImageSegmenterCallback;
        }
  ) {
    if (this.runningMode === options.mode) return;
    const mode = options.mode;
    this._runningMode = mode;

    await Promise.all([
      this.imageSegmenter.setOptions({ runningMode: mode }),
      this.faceLandmarker.setOptions({ runningMode: mode }),
    ]);

    switch (options.mode) {
      case "IMAGE": {
        this.imageSegmenter.segment(options.image, options.callback);
        return;
      }
      case "VIDEO": {
        this.imageSegmenter.segmentForVideo(
          options.videoFrame,
          options.timestamp,
          options.callback
        );
        break;
      }
    }
  }
}

export const loadImageSegmenter = async (ctrl: ImageSegmenterControl) => {
  const filesetresolver = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
  );
  const [imageSegmenter, faceLandmarker] = await Promise.all([
    ImageSegmenter.createFromOptions(filesetresolver, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite",
        delegate: "GPU",
      },
      runningMode: ctrl.runningMode,
      outputCategoryMask: true,
      outputConfidenceMasks: false,
    }),
    FaceLandmarker.createFromOptions(filesetresolver, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
        delegate: "GPU",
      },
      outputFaceBlendshapes: true,
      runningMode: ctrl.runningMode,
      numFaces: 1,
    }),
  ]);
  ctrl.init(filesetresolver, imageSegmenter, faceLandmarker);
  return ctrl;
};

import type { init } from "astro/virtual-modules/prefetch.js";

export class WebcamController {
  public webcamRunning = false;
  public video!: HTMLVideoElement;
  private lastWebcamTime = -1;
  private listeners: Array<(video: HTMLVideoElement) => void> = [];
  addJob(listener: (video: HTMLVideoElement) => Promise<void>) {
    this.listeners.push(listener);
    return () => {
      // remove listener
      this.listeners.splice(this.listeners.indexOf(listener), 1);
    };
  }
  predictWebcam = async () => {
    if (this.video.currentTime === this.lastWebcamTime) {
      if (this.webcamRunning === true) {
        window.requestAnimationFrame(this.predictWebcam);
      }
      return;
    }
    this.lastWebcamTime = this.video.currentTime;

    for (const listener of this.listeners) {
      listener(this.video);
    }
  };

  async init(video: HTMLVideoElement) {
    this.video = video;
    this.video.srcObject = await navigator.mediaDevices.getUserMedia({
      video: true,
    });
    this.video.addEventListener("loadeddata", this.predictWebcam);
  }
}

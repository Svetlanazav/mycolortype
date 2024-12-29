export function img2canvas(image: HTMLImageElement, canvas: HTMLCanvasElement) {
  const { naturalWidth: width, naturalHeight: height } = image;
  canvas.width = width;
  canvas.height = height;
  const cxt = canvas.getContext("2d")!;
  cxt.clearRect(0, 0, width, height);
  cxt.drawImage(image, 0, 0, width, height);
}

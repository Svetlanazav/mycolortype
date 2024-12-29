export function WebcamButton({
  onClick,
}: {
  onClick: (this: HTMLButtonElement, ev: MouseEvent) => any;
}) {
  let enableWebcamButton: HTMLButtonElement;
  // If webcam supported, add event listener to button.
  if (hasGetUserMedia()) {
    enableWebcamButton = document.getElementById(
      "webcamButton"
    ) as HTMLButtonElement;
    enableWebcamButton.addEventListener("click", onClick);
  } else {
    console.warn("getUserMedia() is not supported by your browser");
  }
}

// Check if webcam access is supported.
function hasGetUserMedia() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

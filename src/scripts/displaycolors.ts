interface RGB {
  r: number;
  g: number;
  b: number;
}
export function displayColorSwatches(
  colors: {
    leftIris: RGB;
    rightIris: RGB;
    lips: RGB;
    skin: RGB;
    eyeColor: RGB;
  },
  containerElement: HTMLElement // Add this parameter
) {
  // Create color swatches
  const swatchContainer = document.createElement("div");
  swatchContainer.style.display = "flex";
  swatchContainer.style.gap = "10px";
  swatchContainer.style.margin = "10px";

  const features = ["Left Iris", "Right Iris", "Lips", "Skin", "eyeColor"];
  const colorValues = [
    colors.leftIris,
    colors.rightIris,
    colors.lips,
    colors.skin,
    colors.eyeColor,
  ];
  console.log(colorValues);
  features.forEach((feature, index) => {
    const swatch = document.createElement("div");
    const color = colorValues[index]!;

    swatch.style.width = "50px";
    swatch.style.height = "50px";
    swatch.style.backgroundColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
    swatch.style.border = "1px solid black";
    swatch.title = feature;

    swatchContainer.appendChild(swatch);
  });

  // Add to the specified container
  containerElement.appendChild(swatchContainer);
}

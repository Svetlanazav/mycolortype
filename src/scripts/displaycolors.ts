import type { FaceColors } from "./facecolor";

export function displayColorSwatches(
  colors: FaceColors,
  containerElement: HTMLElement,
) {
  // Clear previous results before rendering
  containerElement.innerHTML = "";

  const swatchContainer = document.createElement("div");
  swatchContainer.style.display = "flex";
  swatchContainer.style.flexWrap = "wrap";
  swatchContainer.style.gap = "10px";
  swatchContainer.style.margin = "10px";

  const features: Array<{ label: string; color: { r: number; g: number; b: number } }> = [
    { label: "Left Iris", color: colors.leftIris },
    { label: "Right Iris", color: colors.rightIris },
    { label: "Eye Color", color: colors.eyeColor },
    { label: "Lips", color: colors.lips },
    { label: "Brows", color: colors.brows },
    { label: "Skin", color: colors.skin },
  ];

  features.forEach(({ label, color }) => {
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.alignItems = "center";
    wrapper.style.gap = "4px";

    const swatch = document.createElement("div");
    swatch.style.width = "50px";
    swatch.style.height = "50px";
    swatch.style.backgroundColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
    swatch.style.border = "1px solid rgba(255,255,255,0.2)";
    swatch.style.borderRadius = "6px";
    swatch.title = label;

    const labelEl = document.createElement("span");
    labelEl.style.fontSize = "10px";
    labelEl.style.color = "#9ca3af";
    labelEl.textContent = label;

    wrapper.appendChild(swatch);
    wrapper.appendChild(labelEl);
    swatchContainer.appendChild(wrapper);
  });

  containerElement.appendChild(swatchContainer);
}

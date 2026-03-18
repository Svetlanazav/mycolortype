import { useState, useEffect } from "react";
import type { FaceColors } from "../scripts/facecolor";

type Status = "idle" | "loading" | "done";

interface RGB {
  r: number;
  g: number;
  b: number;
}

function toHex({ r, g, b }: RGB): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function luminance({ r, g, b }: RGB): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function rgbString({ r, g, b }: RGB): string {
  return `rgb(${r}, ${g}, ${b})`;
}

/** Large swatch card with hex overlay and label */
function ColorCard({
  color,
  label,
  size = "md",
}: {
  color: RGB;
  label: string;
  size?: "sm" | "md" | "lg";
}) {
  const hex = toHex(color);
  const lum = luminance(color);
  const textColor = lum > 120 ? "text-gray-900" : "text-white";
  const subTextColor = lum > 120 ? "text-gray-700" : "text-white/70";
  const heights = { sm: "h-16", md: "h-20", lg: "h-24" };

  return (
    <div className="rounded-xl overflow-hidden shadow-md">
      <div
        className={`${heights[size]} w-full flex flex-col items-center justify-center relative`}
        style={{ backgroundColor: rgbString(color) }}
      >
        <span className={`text-sm font-mono font-bold ${textColor}`}>
          {hex}
        </span>
        <span className={`text-[10px] font-mono ${subTextColor}`}>
          {color.r}, {color.g}, {color.b}
        </span>
      </div>
      <div className="bg-gray-800/80 px-3 py-2 text-center">
        <p className="text-xs font-medium text-gray-300">{label}</p>
      </div>
    </div>
  );
}

/** Side-by-side iris comparison */
function IrisPair({
  left,
  right,
  combined,
}: {
  left: RGB;
  right: RGB;
  combined: RGB;
}) {
  const hex = toHex(combined);
  const lum = luminance(combined);
  const textColor = lum > 120 ? "text-gray-900" : "text-white";
  const subTextColor = lum > 120 ? "text-gray-700" : "text-white/70";

  return (
    <div className="rounded-xl overflow-hidden shadow-md">
      {/* Combined eye color — main display */}
      <div
        className="h-20 w-full flex flex-col items-center justify-center"
        style={{ backgroundColor: rgbString(combined) }}
      >
        <span className={`text-sm font-mono font-bold ${textColor}`}>
          {hex}
        </span>
        <span className={`text-[10px] font-mono ${subTextColor}`}>
          {combined.r}, {combined.g}, {combined.b}
        </span>
      </div>

      {/* Left / Right iris strip */}
      <div className="flex">
        <div
          className="flex-1 h-8 flex items-center justify-center"
          style={{ backgroundColor: rgbString(left) }}
        >
          <span
            className={`text-[10px] font-mono ${luminance(left) > 120 ? "text-gray-700" : "text-white/70"}`}
          >
            L {toHex(left)}
          </span>
        </div>
        <div className="w-px bg-gray-900" />
        <div
          className="flex-1 h-8 flex items-center justify-center"
          style={{ backgroundColor: rgbString(right) }}
        >
          <span
            className={`text-[10px] font-mono ${luminance(right) > 120 ? "text-gray-700" : "text-white/70"}`}
          >
            R {toHex(right)}
          </span>
        </div>
      </div>

      <div className="bg-gray-800/80 px-3 py-2 text-center">
        <p className="text-xs font-medium text-gray-300">Eye color</p>
      </div>
    </div>
  );
}

export function FaceColorResults() {
  const [colors, setColors] = useState<FaceColors | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    function onStart(e: Event) {
      const types = (e as CustomEvent<{ types: string[] }>).detail?.types;
      if (!types || types.includes("face_colors")) {
        setStatus("loading");
      }
    }
    function onResult(e: Event) {
      setColors((e as CustomEvent<FaceColors>).detail);
      setStatus("done");
    }
    window.addEventListener("analysis:start", onStart);
    window.addEventListener("analysis:face_colors", onResult);
    return () => {
      window.removeEventListener("analysis:start", onStart);
      window.removeEventListener("analysis:face_colors", onResult);
    };
  }, []);

  if (status === "idle") {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <p className="text-gray-500 text-xs">
          Click the photo to detect face colors
        </p>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="flex flex-col gap-4 w-full animate-pulse">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl overflow-hidden">
              <div className="h-20 bg-gray-700" />
              <div className="bg-gray-800 px-3 py-2">
                <div className="h-3 bg-gray-700 rounded w-16 mx-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!colors) return null;

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Eyes — large combined swatch with L/R strip */}
      <IrisPair
        left={colors.leftIris}
        right={colors.rightIris}
        combined={colors.eyeColor}
      />

      {/* Skin, Lips, Brows — 3-column grid */}
      <div className="grid grid-cols-3 gap-3">
        <ColorCard color={colors.skin} label="Skin" />
        <ColorCard color={colors.lips} label="Lips" />
        <ColorCard color={colors.brows} label="Brows" />
      </div>
    </div>
  );
}

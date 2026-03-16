import { useEffect, useState } from "react";
import type { ColorAnalysis } from "../scripts/avrcolorenhanced";

const CATEGORY_LABEL: Record<string, string> = {
  hair: "Hair",
  bodySkin: "Body skin",
  faceSkin: "Face skin",
};

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

type Status = "idle" | "loading" | "done";

export function AnalysisResults({ type }: { type: string }) {
  const [colors, setColors] = useState<[string, ColorAnalysis][]>([]);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    function onStart() {
      setStatus("loading");
    }
    function onResult(e: Event) {
      const detail = (e as CustomEvent<Record<string, ColorAnalysis>>).detail;
      setColors(
        Object.entries(detail).map(
          ([key, value]) => [key, value] as [string, ColorAnalysis]
        )
      );
      setStatus("done");
    }
    window.addEventListener("analysis:start", onStart);
    window.addEventListener(`analysis:${type}`, onResult);
    return () => {
      window.removeEventListener("analysis:start", onStart);
      window.removeEventListener(`analysis:${type}`, onResult);
    };
  }, [type]);

  if (status === "idle") {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <p className="text-gray-500 text-sm">Click the photo to see color breakdown</p>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="flex flex-col gap-3 w-full max-w-sm">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl overflow-hidden flex items-stretch h-16 animate-pulse">
            <div className="w-16 shrink-0 bg-gray-700" />
            <div className="bg-gray-800 flex-1 px-4 py-3 flex flex-col gap-2 justify-center">
              <div className="h-2.5 bg-gray-700 rounded w-24" />
              <div className="h-1.5 bg-gray-700 rounded w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 w-full max-w-sm">
      {colors.map(([key, { color, confidence, shadowPercentage }]) => {
        const { r, g, b } = color;
        const hex = toHex(r, g, b);
        const lum = luminance(r, g, b);
        const textColor = lum > 140 ? "#1a1a1a" : "#ffffff";
        const confidencePct = Math.round(confidence * 100);

        return (
          <div
            key={key}
            className="rounded-xl overflow-hidden shadow-md flex items-stretch"
          >
            {/* Color swatch */}
            <div
              className="w-16 shrink-0 flex items-center justify-center text-xs font-mono font-bold"
              style={{ backgroundColor: hex, color: textColor }}
            >
              {hex}
            </div>

            {/* Info */}
            <div className="bg-gray-800 flex-1 px-4 py-3">
              <p className="text-sm font-semibold text-white mb-2">
                {CATEGORY_LABEL[key] ?? key}
              </p>
              <div className="flex flex-col gap-1">
                {/* Confidence */}
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="w-20 shrink-0">Confidence</span>
                  <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-rose rounded-full"
                      style={{ width: `${confidencePct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right">{confidencePct}%</span>
                </div>
                {/* Shadow */}
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="w-20 shrink-0">Shadow</span>
                  <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gray-500 rounded-full"
                      style={{ width: `${Math.round(shadowPercentage)}%` }}
                    />
                  </div>
                  <span className="w-8 text-right">
                    {Math.round(shadowPercentage)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

import { useEffect, useState } from "react";
import type { ColorAnalysis } from "../scripts/avrcolorenhanced";

const CATEGORY_LABEL: Record<string, string> = {
  hair: "Hair",
  bodySkin: "Body skin",
  faceSkin: "Face skin",
  clothes: "Clothes",
  others: "Other",
};

const CATEGORY_ICON: Record<string, string> = {
  hair: "✂",
  bodySkin: "🤲",
  faceSkin: "👤",
  clothes: "👕",
  others: "◻",
};

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function confidenceLabel(pct: number): { text: string; color: string } {
  if (pct >= 80) return { text: "High", color: "text-emerald-400" };
  if (pct >= 50) return { text: "Medium", color: "text-amber-400" };
  return { text: "Low", color: "text-red-400" };
}

type Status = "idle" | "loading" | "done";

export function AnalysisResults({ type }: { type: string }) {
  const [colors, setColors] = useState<[string, ColorAnalysis][]>([]);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    function onStart(e: Event) {
      const types = (e as CustomEvent<{ types: string[] }>).detail?.types;
      if (!types || types.includes(type)) {
        setStatus("loading");
      }
    }
    function onResult(e: Event) {
      const detail = (e as CustomEvent<Record<string, ColorAnalysis>>).detail;
      setColors(
        Object.entries(detail)
          // Categories the segmenter found no pixels for come back as black at
          // 0% confidence — that is "absent", not a color worth a swatch.
          .filter(([, value]) => value.pixelCount > 0)
          .map(([key, value]) => [key, value] as [string, ColorAnalysis]),
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
        <p className="text-gray-500 text-sm">
          Click the photo to see color breakdown
        </p>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="flex flex-col gap-3 w-full max-w-md">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl overflow-hidden flex items-stretch h-24 animate-pulse"
          >
            <div className="w-24 shrink-0 bg-gray-700" />
            <div className="bg-gray-800 flex-1 px-4 py-3 flex flex-col gap-2 justify-center">
              <div className="h-3 bg-gray-700 rounded w-20" />
              <div className="h-2 bg-gray-700 rounded w-full" />
              <div className="h-2 bg-gray-700 rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 w-full max-w-md">
      {colors.map(([key, { color, confidence, shadowPercentage }]) => {
        const { r, g, b } = color;
        const hex = toHex(r, g, b);
        const lum = luminance(r, g, b);
        const textColor = lum > 120 ? "#1a1a1a" : "#ffffff";
        const subTextColor = lum > 120 ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.6)";
        const confidencePct = Math.round(confidence * 100);
        const { text: confLabel, color: confColor } =
          confidenceLabel(confidencePct);
        const shadowPct = Math.round(shadowPercentage);

        return (
          <div
            key={key}
            className="rounded-xl overflow-hidden shadow-md flex items-stretch"
          >
            {/* Large color swatch with hex + RGB */}
            <div
              className="w-24 shrink-0 flex flex-col items-center justify-center gap-0.5 px-2"
              style={{ backgroundColor: hex, color: textColor }}
            >
              <span className="text-xs opacity-60">
                {CATEGORY_ICON[key] ?? ""}
              </span>
              <span className="text-sm font-mono font-bold">{hex}</span>
              <span
                className="text-[10px] font-mono"
                style={{ color: subTextColor }}
              >
                {r}, {g}, {b}
              </span>
            </div>

            {/* Info panel */}
            <div className="bg-gray-800 flex-1 px-4 py-3 flex flex-col justify-center gap-2">
              <p className="text-sm font-semibold text-white">
                {CATEGORY_LABEL[key] ?? key}
              </p>

              {/* Confidence */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 w-16 shrink-0 uppercase tracking-wider">
                  Confidence
                </span>
                <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${confidencePct}%`,
                      backgroundColor:
                        confidencePct >= 80
                          ? "#34d399"
                          : confidencePct >= 50
                            ? "#fbbf24"
                            : "#f87171",
                    }}
                  />
                </div>
                <span
                  className={`text-xs font-medium w-14 text-right ${confColor}`}
                >
                  {confidencePct}% {confLabel}
                </span>
              </div>

              {/* Shadow */}
              {shadowPct > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 w-16 shrink-0 uppercase tracking-wider">
                    Shadow
                  </span>
                  <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gray-500 rounded-full"
                      style={{ width: `${shadowPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 w-14 text-right">
                    {shadowPct}%
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

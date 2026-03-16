import { useState, useEffect } from "react";
import type { SeasonalCharacteristics } from "../scripts/seasonanalysis";
import { AnalysisPreview } from "./AnalysisPreviewContainer";
import { SEASON_PALETTES } from "../data/seasonPalettes";

type Status = "idle" | "loading" | "done";

export function SeasonPaletteResults() {
  const [data, setData] = useState<SeasonalCharacteristics | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    function onStart(e: Event) {
      const types = (e as CustomEvent<{ types: string[] }>).detail?.types;
      if (!types || types.includes("img_season")) {
        setStatus("loading");
      }
    }
    function onResult(e: Event) {
      setData((e as CustomEvent<SeasonalCharacteristics>).detail);
      setStatus("done");
    }
    window.addEventListener("analysis:start", onStart);
    window.addEventListener("analysis:img_season", onResult);
    return () => {
      window.removeEventListener("analysis:start", onStart);
      window.removeEventListener("analysis:img_season", onResult);
    };
  }, []);

  if (status === "idle") return null;

  if (status === "loading") {
    return (
      <div className="w-full max-w-4xl mx-auto p-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-64 mb-4" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="w-20 h-20 rounded-lg bg-gray-200" />
              <div className="h-3 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const palette = SEASON_PALETTES[data.subSeason];
  if (!palette) return null;

  return (
    <div className="border-t border-gray-800 mt-4">
      <div className="p-4 text-xs text-gray-500 uppercase tracking-widest font-medium">
        Recommended palette · {data.subSeason}
      </div>
      <AnalysisPreview
        seasonalStyle={data.subSeason}
        primaryColors={palette.primary}
        accentColors={palette.accent}
      />
    </div>
  );
}

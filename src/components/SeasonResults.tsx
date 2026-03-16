import { useState, useEffect } from "react";
import type { SeasonalCharacteristics } from "../scripts/seasonanalysis";

const SEASON_COLORS: Record<string, string> = {
  Spring: "#F9C784",
  Summer: "#A8C8E8",
  Autumn: "#C17F41",
  Winter: "#7B9BC8",
};

const LABEL: Record<string, string> = {
  contrast: "Contrast",
  undertone: "Undertone",
  intensity: "Intensity",
  value: "Value",
};

type Status = "idle" | "loading" | "done";

export function SeasonResults({ type }: { type: string }) {
  const [data, setData] = useState<SeasonalCharacteristics | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    function onStart(e: Event) {
      const types = (e as CustomEvent<{ types: string[] }>).detail?.types;
      if (!types || types.includes(type)) {
        setStatus("loading");
      }
    }
    function onResult(e: Event) {
      setData((e as CustomEvent<SeasonalCharacteristics>).detail);
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
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-xl">
          🖼️
        </div>
        <p className="text-gray-400 text-sm">Click the photo to start analysis</p>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <div className="w-8 h-8 rounded-full border-2 border-gray-600 border-t-white animate-spin" />
        <p className="text-gray-400 text-sm">Analysing your colors…</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { season, subSeason, characteristics, confidence } = data;
  const accentColor = SEASON_COLORS[season] ?? "#9D8189";
  const confidencePct = Math.round(confidence * 100);

  return (
    <div className="rounded-2xl overflow-hidden shadow-lg bg-gray-900 text-white max-w-sm w-full">
      {/* Header */}
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{ backgroundColor: accentColor }}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest opacity-75">
            Your season
          </p>
          <h2 className="text-2xl font-bold text-gray-900">{season}</h2>
        </div>
        <span className="text-xs font-medium bg-white/30 text-gray-900 px-3 py-1 rounded-full">
          {subSeason}
        </span>
      </div>

      {/* Characteristics */}
      <div className="px-6 py-4 grid grid-cols-2 gap-3">
        {(
          Object.entries(characteristics) as [
            keyof typeof characteristics,
            string,
          ][]
        ).map(([key, value]) => (
          <div key={key} className="bg-gray-800 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-400 mb-1">{LABEL[key] ?? key}</p>
            <p className="text-sm font-semibold capitalize">{value}</p>
          </div>
        ))}
      </div>

      {/* Confidence bar */}
      <div className="px-6 pb-5">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Confidence</span>
          <span>{confidencePct}%</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${confidencePct}%`, backgroundColor: accentColor }}
          />
        </div>
      </div>
    </div>
  );
}

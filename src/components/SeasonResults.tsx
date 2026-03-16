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

export function SeasonResults({ type }: { type: string }) {
  const [data, setData] = useState<SeasonalCharacteristics | null>(null);

  useEffect(() => {
    function onEvent(e: Event) {
      setData((e as CustomEvent<SeasonalCharacteristics>).detail);
    }
    window.addEventListener(`analysis:${type}`, onEvent);
    return () => window.removeEventListener(`analysis:${type}`, onEvent);
  }, [type]);

  if (!data) {
    return (
      <p className="text-gray-400 text-sm italic">Waiting for analysis…</p>
    );
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

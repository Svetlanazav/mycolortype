import { useState, useEffect } from "react";
import type { FaceColors } from "../scripts/facecolor";

type Status = "idle" | "loading" | "done";

const FEATURES: Array<{ key: keyof FaceColors; label: string }> = [
  { key: "leftIris", label: "Left iris" },
  { key: "rightIris", label: "Right iris" },
  { key: "eyeColor", label: "Eye color" },
  { key: "lips", label: "Lips" },
  { key: "brows", label: "Brows" },
  { key: "skin", label: "Skin" },
];

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
        <p className="text-gray-500 text-xs">Click the photo to detect face colors</p>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <div className="w-6 h-6 rounded-full border-2 border-gray-600 border-t-white animate-spin" />
        <p className="text-gray-400 text-xs">Detecting colors…</p>
      </div>
    );
  }

  if (!colors) return null;

  return (
    <div className="grid grid-cols-3 gap-3 w-full">
      {FEATURES.map(({ key, label }) => {
        const c = colors[key];
        const hex = `#${c.r.toString(16).padStart(2, "0")}${c.g.toString(16).padStart(2, "0")}${c.b.toString(16).padStart(2, "0")}`;
        return (
          <div
            key={key}
            className="rounded-xl overflow-hidden bg-gray-800 flex flex-col"
          >
            <div
              className="h-14 w-full"
              style={{ backgroundColor: `rgb(${c.r},${c.g},${c.b})` }}
            />
            <div className="px-3 py-2">
              <p className="text-xs text-gray-400">{label}</p>
              <p className="text-xs font-mono text-gray-300 mt-0.5">{hex}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

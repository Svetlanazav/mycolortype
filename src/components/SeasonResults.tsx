import { useState, useEffect } from "react";
import type { SeasonalCharacteristics } from "../scripts/seasonanalysis";

export function SeasonResults({ type }: { type: string }) {
  const [colors, setColors] = useState<SeasonalCharacteristics>();
  useEffect(() => {
    const id = setInterval(() => {
      const analysisResults = window[type];
      if (!analysisResults) {
        return;
      }
      setColors(analysisResults);
    }, 1000);
    return () => clearInterval(id);
  }, []);
  if (!colors) {
    return <p>No SeasonResults results yet</p>;
  }
  return <div>{JSON.stringify(colors, null, 2)}</div>;
}

import { useEffect, useState } from "react";

export function AnalysisResults({ type }: { type: string }) {
  const [colors, setColors] = useState(
    [] as [
      string,
      {
        r: number;
        g: number;
        b: number;
      },
    ][]
  );
  useEffect(() => {
    const id = setInterval(() => {
      const analysisResults = window[type];
      if (!analysisResults) {
        return;
      }
      setColors(
        Object.entries(analysisResults).map(([key, value]) => [key, value])
      );
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div>
      <h1>Analysis Results</h1>
      {colors.length === 0 && <p>No results yet</p>}
      <div className="container">
        {colors.map(([key, value]) => (
          <div
            key={key}
            style={{
              backgroundColor: `rgb(${value.r}, ${value.g}, ${value.b})`,
            }}
          >
            <p>
              Category: <strong>{key}</strong>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

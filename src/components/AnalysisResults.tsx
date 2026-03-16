import { useEffect, useState } from "react";
import type { ColorAnalysis } from "../scripts/avrcolorenhanced";

export function AnalysisResults({ type }: { type: string }) {
  const [colors, setColors] = useState([] as [string, ColorAnalysis][]);
  useEffect(() => {
    const id = setInterval(() => {
      const analysisResults = (window as unknown as Record<string, unknown>)[type];
      if (!analysisResults) {
        return;
      }
      setColors(
        Object.entries(analysisResults as Record<string, ColorAnalysis>).map(([key, value]) => [key, value] as [string, ColorAnalysis])
      );
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div>
      <h1>Analysis Results</h1>
      {colors.length === 0 && <p>No results yet</p>}
      <div className="container">
        {colors.map(
          ([
            key,
            { color: value, shadowPercentage, confidence },
          ]) => (
            <div
              key={key}
              style={{
                backgroundColor: `rgb(${value.r}, ${value.g}, ${value.b})`,
              }}
            >
              <p>
                confidence: {confidence}
                shadowPercentage: {shadowPercentage}
                Category: <strong>{key}</strong>
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// export function AnalysisResults2({ type }: { type: string }) {
//   const [colors, setColors] = useState(
//     [] as [
//       string,
//       {
//         r: number;
//         g: number;
//         b: number;
//       },
//     ][]
//   );
//   useEffect(() => {
//     const id = setInterval(() => {
//       const analysisResults = (window as unknown as Record<string, unknown>)[type];
//       if (!analysisResults) {
//         return;
//       }
//       setColors(
//         Object.entries(analysisResults).map(([key, value]) => [key, value])
//       );
//     }, 1000);
//     return () => clearInterval(id);
//   }, []);
//   return (
//     <div>
//       <h1>Analysis Results</h1>
//       {colors.length === 0 && <p>No results yet</p>}
//       <div className="container">
//         {colors.map(([key, value]) => (
//           <div
//             key={key}
//             style={{
//               backgroundColor: `rgb(${value.r}, ${value.g}, ${value.b})`,
//             }}
//           >
//             <p>
//               Category: <strong>{key}</strong>
//             </p>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

import React from "react";

interface Color {
  hex: string;
  name: string;
}

interface ColorPaletteProps {
  colors: Color[];
}

interface AnalysisContainerProps {
  seasonalStyle: string;
  primaryColors: Color[];
  accentColors: Color[];
  // Add other props as needed
}

const ColorPalette: React.FC<ColorPaletteProps> = ({ colors }) => (
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
    {colors.map((color, index) => (
      <div key={index} className="flex flex-col items-center">
        <div
          className="w-20 h-20 rounded-lg shadow-md mb-2"
          style={{ backgroundColor: color.hex }}
        />
        <span className="text-sm text-gray-600">{color.name}</span>
        <span className="text-xs text-gray-400">{color.hex}</span>
      </div>
    ))}
  </div>
);

// const samplePalette = [
//   { hex: "#F5E6E8", name: "Soft Pink" },
//   { hex: "#D5C3C6", name: "Dusty Rose" },
//   { hex: "#B6A3A7", name: "Mauve" },
//   { hex: "#947276", name: "Rose Brown" },
// ];
export const AnalysisPreview: React.FC<AnalysisContainerProps> = ({
  seasonalStyle,
  primaryColors,
  accentColors,
}) => {
  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-gray-50">
      <div className="space-y-8">
        {/* Season Style Section */}
        {/* {JSON.stringify({
          seasonalStyle,
          primaryColors,
          accentColors,
        })} */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="md:flex-1 md:pr-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                Your Seasonal Style: {seasonalStyle}
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Your color palette aligns with Spring characteristics, featuring
                warm and bright undertones. This palette is characterized by
                clear, warm, and fresh colors that reflect the vibrant energy of
                spring. These colors will naturally enhance your features and
                bring out your natural radiance.
              </p>
            </div>
            <div className="mt-6 md:mt-0">
              <img
                src="https://i.pinimg.com/236x/84/51/df/8451df4c3d69ee6555f60a4ca042ae95.jpg"
                alt="Spring season style representation"
                className="w-60 h-60 object-cover rounded-lg shadow-md"
              />
            </div>
          </div>
        </div>

        {/* Color Palette Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">
            Your Recommended Colors
          </h2>
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-4">
                Primary Colors
              </h3>
              <ColorPalette colors={primaryColors} />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-4">
                Accent Colors
              </h3>
              <ColorPalette
                colors={accentColors.map((color) => ({
                  ...color,
                  hex: color.hex + "99",
                }))}
              />
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-gray-100">
            <h3 className="text-lg font-medium text-gray-700 mb-2">
              Tips for Using Your Colors
            </h3>
            <ul className="text-gray-600 space-y-2">
              <li>
                • Use primary colors for main pieces like dresses, suits, or
                coats
              </li>
              <li>
                • Incorporate accent colors through accessories and layering
                pieces
              </li>
              <li>
                • Mix and match within your palette for harmonious combinations
              </li>
              <li>• Consider the intensity of colors based on the occasion</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

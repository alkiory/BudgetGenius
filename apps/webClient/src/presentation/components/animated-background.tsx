import React from "react";

interface AnimatedBackgroundProps {
  gradientColors?: string[]; // Colores del gradiente
  particleColor?: string; // Color de las partículas
  particleCount?: number; // Número de partículas
}

export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({
  gradientColors = ["from-purple-200", "via-pink-500", "to-cyan-300"], // Colores por defecto
  particleColor = "bg-white", // Color de partículas por defecto
  particleCount = 30, // Número de partículas por defecto
}) => {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      {/* Fondo animado */}
      <div
        className={`absolute inset-0 bg-gradient-to-r ${gradientColors.join(
          " ",
        )} animate-gradient`}
      ></div>

      {/* Partículas */}
      <div className="absolute inset-0">
        {[...Array(particleCount)].map((_, i) => (
          <div
            key={i}
            className={`absolute w-2 h-2 ${particleColor} rounded-full animate-particle`}
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          ></div>
        ))}
      </div>
    </div>
  );
};

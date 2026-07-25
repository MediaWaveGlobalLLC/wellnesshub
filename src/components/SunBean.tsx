"use client";

import { motion } from "framer-motion";

/*
  Isotipo "Sol naciente sobre grano de café" — motivo central del logo de Siembra.
  Los rayos se despliegan al cargar, como un sol saliendo sobre el grano.
  (Elemento decorativo inspirado en el isotipo oficial; el logo real se usa como imagen.)
*/
export function SunBean({
  className = "",
  color = "currentColor",
  size = 120,
}: {
  className?: string;
  color?: string;
  size?: number;
}) {
  const rays = Array.from({ length: 9 }); // abanico de rayos sobre el horizonte

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      fill="none"
      aria-hidden="true"
    >
      {/* Rayos que se despliegan */}
      {rays.map((_, i) => {
        const angle = -90 + (i - 4) * 20; // de -170° a -10°
        const rad = (angle * Math.PI) / 180;
        const x1 = 60 + Math.cos(rad) * 34;
        const y1 = 62 + Math.sin(rad) * 34;
        const x2 = 60 + Math.cos(rad) * 50;
        const y2 = 62 + Math.sin(rad) * 50;
        return (
          <motion.line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.15 + i * 0.06, ease: "easeOut" }}
          />
        );
      })}

      {/* Sol naciente (semicírculo sobre el horizonte) */}
      <motion.path
        d="M 38 62 A 22 22 0 0 1 82 62"
        stroke={color}
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />

      {/* Línea de horizonte */}
      <motion.line
        x1="16"
        y1="62"
        x2="104"
        y2="62"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
      />

      {/* Grano de café debajo (elipse con curva central) */}
      <motion.g
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.5, ease: "easeOut" }}
      >
        <ellipse
          cx="60"
          cy="86"
          rx="16"
          ry="21"
          stroke={color}
          strokeWidth="3.5"
          fill="none"
          transform="rotate(18 60 86)"
        />
        <path
          d="M 53 68 C 62 78, 58 94, 67 104"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          transform="rotate(18 60 86)"
        />
      </motion.g>
    </svg>
  );
}

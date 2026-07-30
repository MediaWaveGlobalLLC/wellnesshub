/*
  Isotipo "Sol naciente sobre grano de café" — motivo central del logo de Siembra.
  (Elemento decorativo inspirado en el isotipo oficial; el logo real se usa como
  imagen desde public/brand/logos/.)

  Sin animación de trazo y sin "use client": es un dibujo, no una interacción, y
  se renderiza en el servidor. La versión anterior animaba cada línea con
  framer-motion partiendo de opacidad 0; como esa animación no llegaba a
  ejecutarse, el isotipo no se veía en ninguna parte del sitio.
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
  const rayos = Array.from({ length: 9 }); // abanico sobre el horizonte

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      fill="none"
      aria-hidden="true"
    >
      {rayos.map((_, i) => {
        const angulo = -90 + (i - 4) * 20; // de -170° a -10°
        const rad = (angulo * Math.PI) / 180;
        return (
          <line
            key={i}
            x1={60 + Math.cos(rad) * 34}
            y1={62 + Math.sin(rad) * 34}
            x2={60 + Math.cos(rad) * 50}
            y2={62 + Math.sin(rad) * 50}
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
          />
        );
      })}

      {/* Sol naciente sobre el horizonte */}
      <path
        d="M 38 62 A 22 22 0 0 1 82 62"
        stroke={color}
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Línea de horizonte */}
      <line x1="16" y1="62" x2="104" y2="62" stroke={color} strokeWidth="3" strokeLinecap="round" />

      {/* Grano de café */}
      <g>
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
      </g>
    </svg>
  );
}

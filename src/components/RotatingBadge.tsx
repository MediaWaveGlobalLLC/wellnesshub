"use client";

/*
  Sello circular giratorio — texto en círculo alrededor del isotipo.
  Motivo de "estampilla de café" que rota lentamente.
*/
export function RotatingBadge({
  text,
  size = 150,
  className = "",
  color = "currentColor",
  duration = 26,
}: {
  text: string;
  size?: number;
  className?: string;
  color?: string;
  duration?: number;
}) {
  const id = `circ-${text.length}-${size}`;
  return (
    <div className={className} style={{ width: size, height: size }} aria-hidden="true">
      <div className="animate-spin-slow relative h-full w-full" style={{ animationDuration: `${duration}s` }}>
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <defs>
            <path id={id} d="M 50,50 m -37,0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" />
          </defs>
          <text
            fill={color}
            fontSize="8.2"
            letterSpacing="2.4"
            fontWeight="600"
            style={{ textTransform: "uppercase" }}
          >
            <textPath href={`#${id}`}>{text}</textPath>
          </text>
        </svg>
      </div>
    </div>
  );
}

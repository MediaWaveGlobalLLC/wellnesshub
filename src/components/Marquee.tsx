"use client";

import { ReactNode } from "react";

/*
  Cinta continua (marquee) — atributos de la marca desfilando.
  Duplica el contenido para el loop infinito sin saltos.
*/
export function Marquee({
  children,
  className = "",
  reverse = false,
}: {
  children: ReactNode;
  className?: string;
  reverse?: boolean;
}) {
  return (
    <div className={`overflow-hidden whitespace-nowrap ${className}`}>
      <div
        className="flex w-max animate-marquee items-center"
        style={reverse ? { animationDirection: "reverse" } : undefined}
      >
        <div className="flex items-center">{children}</div>
        <div className="flex items-center" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}

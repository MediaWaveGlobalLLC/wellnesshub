"use client";

import { useRef, type ReactNode } from "react";

/*
  Tarjeta con inclinación 3D que sigue al cursor.
  Se usa para la tarjeta del Club Siembra (la "membresía" física).

  El brillo radial que recorría la tarjeta se eliminó: docs/01 prohíbe gradientes
  y pide sombra «suave y cálida; nunca glow». La profundidad la aporta ahora la
  inclinación y --shadow-warm.

  La inclinación se aplica escribiendo el transform directamente sobre el nodo,
  sin framer-motion. Es un realce de puntero: si no se ejecuta, la tarjeta se ve
  igual, plana. Con puntero grueso (táctil) no se activa.
*/
export function TiltCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const inclinar = (e: React.MouseEvent) => {
    const nodo = ref.current;
    if (!nodo || !window.matchMedia("(hover: hover)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const caja = nodo.getBoundingClientRect();
    const x = (e.clientX - caja.left) / caja.width;
    const y = (e.clientY - caja.top) / caja.height;
    nodo.style.transform = `perspective(1100px) rotateX(${(0.5 - y) * 20}deg) rotateY(${(x - 0.5) * 24}deg)`;
  };

  const reposar = () => {
    const nodo = ref.current;
    if (nodo) nodo.style.transform = "";
  };

  return (
    <div className={className}>
      <div
        ref={ref}
        onMouseMove={inclinar}
        onMouseLeave={reposar}
        style={{ transformStyle: "preserve-3d", transition: "transform 220ms ease-out" }}
        className="relative"
      >
        {children}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Reveal al hacer scroll.
 *
 * El contenido es visible desde el primer render. La animación se añade cuando
 * el bloque entra en pantalla, y si el JavaScript no llega a ejecutarse no pasa
 * nada: sigue viéndose.
 *
 * La versión anterior hacía lo contrario —framer-motion con `initial` en
 * opacidad 0— y eso serializa un `style="opacity:0"` en el HTML del servidor.
 * Cuando la animación no corría, la página quedaba en blanco con todo el texto
 * presente en el DOM. Pasó en producción.
 *
 * La clase se añade sobre el nodo en vez de por estado: es una sincronización
 * con el DOM, no información que React necesite para renderizar, y así no se
 * dispara un re-render por cada bloque que aparece.
 */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
}: {
  children: ReactNode;
  /** Retardo en segundos, para escalonar bloques hermanos. */
  delay?: number;
  /** Desplazamiento inicial en píxeles. */
  y?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo || typeof IntersectionObserver === "undefined") return;

    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          nodo.classList.add("reveal-visible");
          observador.disconnect();
        }
      },
      { rootMargin: "-60px" }
    );

    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("reveal", className)}
      style={
        {
          "--entrada-y": `${y}px`,
          animationDelay: delay ? `${delay}s` : undefined,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}

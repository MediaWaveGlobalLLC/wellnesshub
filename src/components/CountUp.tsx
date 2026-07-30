"use client";

import { useEffect, useRef, useState } from "react";

/*
  Número que cuenta hacia arriba cuando entra en pantalla.

  El valor final se renderiza desde el principio y solo se sustituye por la
  cuenta si el navegador puede animarla. Antes usaba `useInView` de
  framer-motion, que nunca reportaba visibilidad, así que las tres métricas de
  la home se quedaban en "0+" de forma permanente.
*/
export function CountUp({
  value,
  suffix = "",
  duration = 1600,
  className = "",
}: {
  value: number;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  // Arranca en el valor final: si el efecto no corre, el dato es correcto.
  const [mostrado, setMostrado] = useState(value);

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo || typeof IntersectionObserver === "undefined") return;

    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducido) return;

    let raf = 0;
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting) return;
        observador.disconnect();

        const inicio = performance.now();
        const paso = (ahora: number) => {
          const p = Math.min((ahora - inicio) / duration, 1);
          const suavizado = p === 1 ? 1 : 1 - Math.pow(2, -10 * p); // easeOutExpo
          setMostrado(Math.round(suavizado * value));
          if (p < 1) raf = requestAnimationFrame(paso);
        };
        setMostrado(0);
        raf = requestAnimationFrame(paso);
      },
      { rootMargin: "-40px" }
    );

    observador.observe(nodo);
    return () => {
      observador.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {mostrado}
      <span>{suffix}</span>
    </span>
  );
}

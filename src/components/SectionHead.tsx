"use client";

import { ReactNode } from "react";
import { Reveal } from "@/components/Reveal";

/*
  Encabezado de sección editorial: eyebrow con filete + título display grande.
  Alineado a la izquierda por defecto (rompe el patrón centrado genérico).
  `ghost` es un texto gigante de contorno opcional que flota detrás.
*/
export function SectionHead({
  eyebrow,
  title,
  ghost,
  align = "left",
  dark = false,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  ghost?: string;
  align?: "left" | "center";
  dark?: boolean;
  children?: ReactNode;
}) {
  const accent = dark ? "text-matcha" : "text-terracota";
  const titleColor = dark ? "text-leche" : "text-espresso";

  return (
    <div className="relative mb-14">
      {ghost && (
        <span
          aria-hidden
          className={`text-outline pointer-events-none absolute -top-10 select-none font-display text-[7rem] font-bold leading-none opacity-[0.07] sm:text-[11rem] ${
            align === "center" ? "left-1/2 -translate-x-1/2" : "-left-2"
          } ${dark ? "text-leche" : "text-espresso"}`}
        >
          {ghost}
        </span>
      )}
      <Reveal>
        <div
          className={`flex items-center gap-4 ${
            align === "center" ? "justify-center" : ""
          }`}
        >
          <span className={`h-px w-10 ${dark ? "bg-matcha" : "bg-terracota"}`} />
          <p className={`text-xs font-bold uppercase tracking-[0.32em] ${accent}`}>
            {eyebrow}
          </p>
          {align === "center" && (
            <span className={`h-px w-10 ${dark ? "bg-matcha" : "bg-terracota"}`} />
          )}
        </div>
        <h2
          className={`mt-5 font-display text-4xl font-medium leading-[1.05] tracking-tight sm:text-6xl ${titleColor} ${
            align === "center" ? "text-center" : "max-w-3xl"
          }`}
        >
          {title}
        </h2>
        {children && <div className="mt-6">{children}</div>}
      </Reveal>
    </div>
  );
}

"use client";

import { useTransition } from "react";

import { cerrarSesion } from "@/lib/auth/acciones";

/**
 * Cerrar sesión.
 *
 * `cerrarSesion()` existía en `src/lib/auth/acciones.ts` desde la Fase 2 y NO
 * LA LLAMABA NADIE: se podía entrar y no había ninguna forma de salir salvo
 * borrar las cookies a mano. En un local donde la gente abre su cuenta desde el
 * móvil de otra persona, o desde una tablet del mostrador, eso no es un detalle
 * de comodidad.
 *
 * Es un `<form>` con server action y no un `onClick` con fetch: así funciona
 * aunque el JavaScript no haya hidratado todavía, que es justo cuando alguien
 * con prisa lo pulsa.
 */
export function BotonSalir({
  className,
  etiqueta = "Cerrar sesión",
}: {
  className?: string;
  etiqueta?: string;
}) {
  const [pendiente, iniciar] = useTransition();

  return (
    <form action={() => iniciar(async () => void (await cerrarSesion()))}>
      <button
        type="submit"
        disabled={pendiente}
        className={
          className ??
          "text-sm font-semibold text-text-muted underline underline-offset-4 transition-colors hover:text-terracota disabled:opacity-50"
        }
      >
        {pendiente ? "…" : etiqueta}
      </button>
    </form>
  );
}

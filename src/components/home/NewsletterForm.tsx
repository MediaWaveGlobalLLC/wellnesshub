"use client";

import { useActionState } from "react";
import { suscribirse, type ResultadoSuscripcion } from "@/lib/newsletter/acciones";

/**
 * Captación de correo del bloque de comunidad — mockup 04.
 *
 * `<form action>` + useActionState: funciona aunque no cargue el JavaScript.
 */
export function NewsletterForm() {
  const [estado, accion, enviando] = useActionState<ResultadoSuscripcion | null, FormData>(
    suscribirse,
    null
  );

  if (estado?.ok) {
    return (
      <p role="status" className="text-sm font-semibold text-leche">
        {estado.mensaje}
      </p>
    );
  }

  return (
    <form action={accion} className="space-y-2" noValidate>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="newsletter-email" className="sr-only">
          Tu correo electrónico
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="Tu email"
          aria-invalid={estado && !estado.ok ? true : undefined}
          aria-describedby={estado && !estado.ok ? "newsletter-error" : undefined}
          className="h-[50px] flex-1 rounded-sm border border-leche/40 bg-leche px-4 text-espresso placeholder:text-text-muted focus:border-espresso focus:outline-none focus:ring-2 focus:ring-espresso/30"
        />
        <button
          type="submit"
          disabled={enviando}
          className="h-[50px] shrink-0 rounded-sm bg-forest px-6 text-[0.72rem] font-bold uppercase tracking-[0.12em] text-avena transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {enviando ? "Enviando…" : "Quiero ser parte"}
        </button>
      </div>

      {estado && !estado.ok && (
        <p id="newsletter-error" role="alert" className="text-sm text-leche">
          {estado.mensaje}
        </p>
      )}
    </form>
  );
}

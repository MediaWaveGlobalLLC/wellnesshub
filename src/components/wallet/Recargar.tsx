"use client";

import { useState, useTransition } from "react";

import { Card } from "@/components/ui/Surface";
import { CheckIcon } from "@/components/icons";
import { recargarSaldo } from "@/lib/recarga/acciones";

/**
 * Recargar saldo con tarjeta.
 *
 * Tres importes fijos en vez de un campo libre: son dos toques en un móvil, y
 * un campo vacío obliga a decidir una cifra desde cero, que es justo donde la
 * gente abandona.
 *
 * El importe NO viaja como precio: se manda cuál de los tres y el servidor lo
 * comprueba contra su propia lista antes de construir la sesión de Stripe. Una
 * petición manipulada pide otro importe, no paga menos.
 *
 * El de $20 iba marcado «Con café» por la promoción de bienvenida, retirada por
 * la dueña el 1 de agosto de 2026 (`0025_sin_cafe_bienvenida.sql`). Sigue
 * primero por ser el más bajo, que es el orden natural, no por la promoción.
 */

/**
 * Los mismos que `IMPORTES` del servicio, repetidos aquí a propósito.
 *
 * Ese módulo es `server-only` —crea el cliente de Stripe— y este componente
 * corre en el navegador. Importarlo arrastraría la clave secreta al bundle; el
 * centinela lo impediría, pero rompiendo el build. Lo que se duplica son tres
 * cifras de escaparate, y el servidor sigue siendo quien manda.
 */
const IMPORTES = [
  { centavos: 2000, etiqueta: "$20" },
  { centavos: 5000, etiqueta: "$50" },
  { centavos: 10000, etiqueta: "$100" },
];

export function Recargar() {
  const [pendiente, iniciar] = useTransition();
  const [elegido, setElegido] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function recargar(centavos: number) {
    setError(null);
    setElegido(centavos);
    iniciar(async () => {
      const r = await recargarSaldo({ centavos });
      if (r.ok) {
        // Al Checkout de Stripe. El saldo no sube hasta que su webhook lo
        // confirme: volver de esta pantalla no acredita nada.
        window.location.href = r.checkoutUrl;
      } else {
        setError(r.error);
        setElegido(null);
      }
    });
  }

  return (
    <Card className="p-6">
      <h2 className="font-display text-2xl text-espresso">Recargar saldo</h2>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">
        Se paga con tarjeta y el crédito entra en tu cuenta en cuanto se confirma el pago.
      </p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {IMPORTES.map((i) => (
          <button
            key={i.centavos}
            type="button"
            disabled={pendiente}
            onClick={() => recargar(i.centavos)}
            aria-label={`Recargar ${i.etiqueta}`}
            className={[
              // `px-2` en móvil se midió para que «Con café» entrara en una
              // línea a 375px. Ese rótulo ya no está, pero el `px-2` se queda:
              // los tres botones siguen igual de cómodos y cambiarlo sería
              // mover el diseño sin que nadie lo haya pedido.
              "flex flex-col items-center justify-center rounded-lg border px-2 py-5 transition-colors sm:px-4",
              "disabled:cursor-not-allowed disabled:opacity-60",
              elegido === i.centavos
                ? "border-terracota bg-surface-muted"
                : "border-border bg-surface hover:border-terracota/50",
            ].join(" ")}
          >
            <span className="font-display text-2xl text-espresso">{i.etiqueta}</span>
          </button>
        ))}
      </div>

      {pendiente && (
        <p role="status" className="mt-4 flex items-center gap-1.5 text-sm text-text-muted">
          <CheckIcon size={15} />
          Abriendo el pago seguro…
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}
    </Card>
  );
}

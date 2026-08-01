"use client";

import { useState, useTransition } from "react";

import { Card } from "@/components/ui/Surface";
import { CheckIcon } from "@/components/icons";
import { recargarSaldo } from "@/lib/recarga/acciones";

/**
 * Recargar saldo con tarjeta.
 *
 * Tres importes fijos en vez de un campo libre: son dos toques en un móvil, y
 * el de $20 es exactamente el de la promoción que anuncia la portada, así que
 * va primero y marcado. Un campo vacío obliga a decidir una cifra desde cero,
 * que es justo donde la gente abandona.
 *
 * El importe NO viaja como precio: se manda cuál de los tres y el servidor lo
 * comprueba contra su propia lista antes de construir la sesión de Stripe. Una
 * petición manipulada pide otro importe, no paga menos.
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
  { centavos: 2000, etiqueta: "$20", promo: true },
  { centavos: 5000, etiqueta: "$50", promo: false },
  { centavos: 10000, etiqueta: "$100", promo: false },
];

export function Recargar({ esPrimera }: { esPrimera: boolean }) {
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

      {esPrimera && (
        <p className="mt-3 border-l-2 border-terracota bg-surface-muted px-4 py-3 text-sm leading-relaxed text-espresso">
          <strong>Tu primera recarga de $20 o más lleva café gratis.</strong> Te aparecerá en Mis
          puntos, con su código, para pedirlo en el mostrador.
        </p>
      )}

      <div className="mt-5 grid grid-cols-3 gap-3">
        {IMPORTES.map((i) => (
          <button
            key={i.centavos}
            type="button"
            disabled={pendiente}
            onClick={() => recargar(i.centavos)}
            aria-label={`Recargar ${i.etiqueta}`}
            className={[
              "flex flex-col items-center justify-center rounded-lg border px-4 py-5 transition-colors",
              "disabled:cursor-not-allowed disabled:opacity-60",
              elegido === i.centavos
                ? "border-terracota bg-surface-muted"
                : "border-border bg-surface hover:border-terracota/50",
            ].join(" ")}
          >
            <span className="font-display text-2xl text-espresso">{i.etiqueta}</span>
            {i.promo && esPrimera && (
              <span className="mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-terracota">
                Con café
              </span>
            )}
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

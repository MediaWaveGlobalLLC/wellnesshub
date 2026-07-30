import { formatearDolares } from "@/lib/loyalty";
import type { MovimientoWallet } from "@/lib/services/wallet-service";

/**
 * Una línea del ledger — mockup 03, "Historial de créditos".
 *
 * Muestra siempre el saldo resultante: es lo que hace auditable el historial y
 * permite a cualquiera cuadrar la cuenta sin confiar en el balance almacenado.
 */
export function MovimientoFila({ movimiento }: { movimiento: MovimientoWallet }) {
  const positivo = movimiento.amountCents > 0;

  return (
    <li className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
      {/* El signo es el dato: círculo con + o −, como en el mockup. */}
      <span
        aria-hidden
        className={`circle mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          positivo ? "bg-forest text-avena" : "bg-terracota text-surface"
        }`}
      >
        {positivo ? "+" : "−"}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-espresso">
          {movimiento.descripcion ?? movimiento.etiqueta}
        </p>
        <p className="mt-0.5 text-xs text-text-muted">
          {new Intl.DateTimeFormat("es-PR", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZone: "America/Puerto_Rico",
          }).format(new Date(movimiento.fecha))}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className={`text-sm font-semibold ${positivo ? "text-olive" : "text-terracota"}`}>
          {positivo ? "+" : "−"}
          {formatearDolares(Math.abs(movimiento.amountCents))}
        </p>
        <p className="mt-0.5 text-xs text-text-muted">
          Saldo {formatearDolares(movimiento.balanceAfterCents)}
        </p>
      </div>
    </li>
  );
}

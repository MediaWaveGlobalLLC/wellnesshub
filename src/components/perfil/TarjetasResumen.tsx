import Link from "next/link";
import { Card, ProgressBar } from "@/components/ui/Surface";
import { LeafIcon, WalletIcon } from "@/components/icons";
import { formatearDolares, formatearPuntos, type ProgresoMembresia } from "@/lib/loyalty";

/**
 * Los dos módulos prioritarios del mockup 02.
 *
 * El mockup los pinta como "MI MEMBRESÍA" y "CRÉDITOS DISPONIBLES", pero mete
 * los puntos en la segunda tarjeta con la línea "1.350 pts · Equivalen a $135".
 * Eso funde dos sistemas que `docs/00` separa de forma explícita: los puntos son
 * una recompensa sin valor monetario y el crédito es dinero de tienda.
 *
 * Se conserva la composición —dos bloques, Forest y Terracota, misma altura— y
 * se corrige el contenido: los puntos viven en la tarjeta de membresía, que es
 * donde ya estaba la barra de progreso, y la terracota muestra el saldo real.
 */

export function TarjetaMembresia({ membresia }: { membresia: ProgresoMembresia }) {
  const { actual, siguiente, puntos, faltan, meta } = membresia;

  return (
    <Card tono="forest" className="flex flex-col justify-between p-6">
      <div>
        <div className="flex items-start justify-between gap-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-avena/70">
            Mi membresía
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-avena/30 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-avena">
            <LeafIcon size={14} />
            Nivel {actual.label}
          </span>
        </div>

        {actual.description && (
          <p className="mt-4 text-sm leading-relaxed text-avena/80">{actual.description}</p>
        )}

        <p className="mt-3 text-sm text-avena/80">
          {siguiente ? (
            <>
              Siguiente nivel:{" "}
              <strong className="font-semibold text-avena">
                {formatearPuntos(faltan)} pts más
              </strong>{" "}
              para Nivel {siguiente.label}.
            </>
          ) : (
            <>Estás en el nivel más alto. Gracias por crecer con nosotros.</>
          )}
        </p>
      </div>

      <div className="mt-6">
        <ProgressBar
          valor={puntos}
          total={meta || puntos || 1}
          etiqueta={`${formatearPuntos(puntos)} / ${formatearPuntos(meta || puntos)} pts`}
        />
      </div>
    </Card>
  );
}

export function TarjetaCredito({ centavos }: { centavos: number }) {
  return (
    <Card tono="terracota" className="relative flex flex-col justify-between overflow-hidden p-6">
      <div>
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-leche/75">
          Crédito disponible
        </p>
        <p className="mt-4 font-display text-4xl leading-none text-leche sm:text-[2.75rem]">
          {formatearDolares(centavos)}
        </p>
        <p className="mt-2 text-sm text-leche/80">
          Saldo de tienda para usar en café, matcha y productos.
        </p>
      </div>

      <Link
        href="/wallet"
        className="mt-6 inline-flex w-fit items-center gap-2 rounded-sm border border-leche/40 px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-leche transition-colors hover:bg-leche hover:text-terracota"
      >
        <WalletIcon size={15} />
        Ver movimientos
      </Link>
    </Card>
  );
}

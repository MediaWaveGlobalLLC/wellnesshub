import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/Surface";
import { EmptyState } from "@/components/states";
import { GraficaBarras, GraficaLinea } from "@/components/admin/graficas/Grafica";
import { exigirDuena } from "@/lib/services/admin-service";
import { obtenerResumen } from "@/lib/services/admin-consultas";
import {
  esRangoValido,
  RANGOS,
  seriesDe,
  total,
  type ClaveRango,
} from "@/lib/services/metricas";
import { formatearDolares, formatearPuntos } from "@/lib/loyalty";

export const metadata: Metadata = {
  title: "Métricas · Administración",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Centavos → "$48.50". Para los ejes, donde no cabe el nombre de la moneda. */
const DINERO = (v: number) => formatearDolares(v);
const NUMERO = (v: number) => formatearPuntos(v);

function Seccion({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-display text-xl text-espresso">{titulo}</h2>
      <p className="mt-1 text-sm leading-relaxed text-text-muted">{descripcion}</p>
      <div className="mt-5">{children}</div>
    </Card>
  );
}

/** /admin/metricas — el negocio en el tiempo. Solo la dueña. */
export default async function MetricasPage({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string }>;
}) {
  if (!(await exigirDuena())) notFound();

  const { rango: pedido } = await searchParams;
  const rango: ClaveRango = esRangoValido(pedido) ? pedido : "30d";

  const [resumen, series] = await Promise.all([
    obtenerResumen(),
    seriesDe(
      [
        "altas",
        "credito_emitido",
        "credito_canjeado",
        "giftcards_gmv",
        "puntos_emitidos",
        "puntos_canjeados",
      ],
      rango
    ),
  ]);

  const altas = series.altas!;
  const emitido = series.credito_emitido!;
  const canjeado = series.credito_canjeado!;
  const gmv = series.giftcards_gmv!;
  const puntosDados = series.puntos_emitidos!;
  const puntosGastados = series.puntos_canjeados!;

  const hayAlgo = [altas, emitido, canjeado, gmv].some((s) => total(s) > 0);

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-espresso">Métricas</h1>
          <p className="mt-1 text-sm text-text-muted">
            Todo lo que se puede calcular con los datos que ya existen.
          </p>
        </div>

        {/* Selector por enlace: cada rango tiene su URL y se puede compartir. */}
        <nav aria-label="Rango de fechas" className="flex flex-wrap gap-4">
          {(Object.keys(RANGOS) as ClaveRango[]).map((r) => (
            <Link
              key={r}
              href={r === "30d" ? "/admin/metricas" : `/admin/metricas?rango=${r}`}
              aria-current={r === rango ? "page" : undefined}
              className={
                r === rango
                  ? "text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-espresso underline decoration-terracota decoration-2 underline-offset-[6px]"
                  : "text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-text-muted transition-colors hover:text-espresso"
              }
            >
              {RANGOS[r].etiqueta}
            </Link>
          ))}
        </nav>
      </div>

      {!hayAlgo ? (
        <Card className="mt-6 p-8">
          <EmptyState
            titulo="Todavía no hay movimiento"
            descripcion="En cuanto haya altas, gift cards o ajustes de crédito, las gráficas se llenan solas. No hace falta configurar nada."
          />
        </Card>
      ) : (
        <div className="mt-6 space-y-5">
          <Seccion
            titulo="Comunidad"
            descripcion={`${total(altas)} cuenta${total(altas) === 1 ? "" : "s"} nueva${total(altas) === 1 ? "" : "s"} en el periodo. De los ${resumen.miembros} miembros, ${resumen.perfilVisitado} han llegado a entrar en su perfil.`}
          >
            <GraficaBarras serie={altas} titulo="Cuentas nuevas por periodo" formato={NUMERO} />
          </Seccion>

          <Seccion
            titulo="Crédito de tienda"
            descripcion={`Entraron ${formatearDolares(total(emitido))} y se gastaron ${formatearDolares(total(canjeado))}. Hoy quedan ${formatearDolares(resumen.saldoTotalCents)} sin usar.`}
          >
            <GraficaLinea serie={emitido} titulo="Crédito que entra" formato={DINERO} />
            <div className="mt-6">
              <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-text-muted">
                Crédito gastado
              </p>
              <GraficaBarras serie={canjeado} titulo="Crédito que sale" formato={DINERO} />
            </div>
          </Seccion>

          <Seccion
            titulo="Gift cards"
            descripcion={`${formatearDolares(total(gmv))} cobrados en el periodo. Sin canjear hay ${formatearDolares(resumen.giftcardsBreakageCents)} en ${resumen.giftcardsSinCanjear} tarjeta${resumen.giftcardsSinCanjear === 1 ? "" : "s"}.`}
          >
            <GraficaBarras serie={gmv} titulo="Ingresos por gift cards" formato={DINERO} />
          </Seccion>

          <Seccion
            titulo="Lealtad"
            descripcion={`Se dieron ${formatearPuntos(total(puntosDados))} puntos y se canjearon ${formatearPuntos(total(puntosGastados))}. Quedan ${formatearPuntos(resumen.puntosTotal)} acumulados.`}
          >
            <GraficaLinea serie={puntosDados} titulo="Puntos otorgados" formato={NUMERO} />
          </Seccion>
        </div>
      )}

      <Card tono="avena" className="mt-5 p-5">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-espresso">
          Lo que aquí no se ve
        </p>
        <p className="mt-2 text-sm leading-relaxed text-espresso/80">
          <strong>Las ventas del local no aparecen</strong> porque la web no está conectada al punto
          de venta. Tampoco hay visitas todavía. Todo lo de arriba sale de lo que pasa en la web:
          cuentas, crédito, gift cards y puntos.
        </p>
      </Card>
    </>
  );
}

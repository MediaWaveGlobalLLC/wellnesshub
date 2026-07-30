import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, Badge } from "@/components/ui/Surface";
import { EmptyState } from "@/components/states";
import { Paginacion } from "@/components/admin/ui/Paginacion";
import { exigirDuena } from "@/lib/services/admin-service";
import { listarAuditoria, type Persona } from "@/lib/services/admin-consultas";
import { formatearDolares, formatearPuntos } from "@/lib/loyalty";

export const metadata: Metadata = {
  title: "Auditoría · Administración",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ETIQUETA_ACCION: Record<string, string> = {
  wallet_adjustment: "Ajuste de crédito",
  points_adjustment: "Ajuste de puntos",
  gift_card_issued: "Gift card emitida",
  gift_card_redeemed: "Gift card canjeada",
};

const ACCIONES = Object.keys(ETIQUETA_ACCION);

function fecha(iso: string): string {
  return new Intl.DateTimeFormat("es-PR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/Puerto_Rico",
  }).format(new Date(iso));
}

/**
 * Nombres legibles y formato correcto para los valores del antes/después.
 *
 * Antes se volcaban crudos y se leía `balance_cents: 2500`. Quien audita un
 * ajuste de dinero no debería tener que dividir entre cien mentalmente para
 * saber si fueron 25 dólares o 2.500.
 */
const CAMPO: Record<string, { etiqueta: string; formato: (v: unknown) => string }> = {
  balance_cents: { etiqueta: "Saldo", formato: (v) => formatearDolares(Number(v)) },
  amount_cents: { etiqueta: "Importe", formato: (v) => formatearDolares(Number(v)) },
  points_balance: { etiqueta: "Puntos", formato: (v) => formatearPuntos(Number(v)) },
  points: { etiqueta: "Ajuste", formato: (v) => formatearPuntos(Number(v)) },
};

function Delta({ datos, titulo }: { datos: Record<string, unknown> | null; titulo: string }) {
  if (!datos || Object.keys(datos).length === 0) return null;
  return (
    <div>
      <p className="text-[0.65rem] uppercase tracking-[0.12em] text-text-muted">{titulo}</p>
      <ul className="mt-1 space-y-0.5">
        {Object.entries(datos).map(([k, v]) => {
          const campo = CAMPO[k];
          return (
            <li key={k} className="font-display text-sm text-espresso">
              {campo ? `${campo.etiqueta}: ${campo.formato(v)}` : `${k}: ${String(v)}`}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Quién. Es el dato que faltaba y el que da sentido a todo el registro. */
function Quien({ persona }: { persona: Persona | null }) {
  if (!persona) return <span className="text-text-muted">el sistema</span>;
  return (
    <span className="text-espresso">
      {persona.nombre}
      {persona.email && <span className="text-text-muted"> · {persona.email}</span>}
    </span>
  );
}

/** /admin/auditoria — el rastro completo (`docs/00`). Solo la dueña. */
export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string; accion?: string }>;
}) {
  /*
    `notFound()` y no `redirect("/")`: un empleado no debería descubrir que esta
    sección existe. Un 403 confirma que hay algo detrás; un 404, no.
  */
  if (!(await exigirDuena())) notFound();

  const { pagina, accion } = await searchParams;
  const numeroPagina = Number.parseInt(pagina ?? "1", 10) || 1;
  const filtro = accion && ACCIONES.includes(accion) ? accion : undefined;

  const { entradas, total, porPagina } = await listarAuditoria(numeroPagina, 50, filtro);

  return (
    <>
      <p className="text-sm leading-relaxed text-text-muted">
        Cada ajuste manual, emisión y canje queda aquí con quién lo hizo, su motivo, su antes y su
        después. Es inmutable: no hay forma de editar ni borrar una entrada desde la aplicación.
      </p>

      {/* Filtro por GET, como el buscador de usuarios: el enlace es compartible. */}
      <form method="get" className="mt-5 flex flex-wrap items-center gap-3">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-text-muted">
          Acción
        </span>
        <Link
          href="/admin/auditoria"
          className={`text-xs ${!filtro ? "font-semibold text-espresso underline decoration-terracota decoration-2 underline-offset-4" : "text-text-muted"}`}
        >
          Todas
        </Link>
        {ACCIONES.map((a) => (
          <Link
            key={a}
            href={`/admin/auditoria?accion=${a}`}
            className={`text-xs ${filtro === a ? "font-semibold text-espresso underline decoration-terracota decoration-2 underline-offset-4" : "text-text-muted"}`}
          >
            {ETIQUETA_ACCION[a]}
          </Link>
        ))}
      </form>

      {entradas.length === 0 ? (
        <Card className="mt-6 p-8">
          <EmptyState
            titulo={filtro ? "Nada con ese filtro" : "Sin actividad registrada"}
            descripcion={
              filtro
                ? "Prueba con otra acción o quita el filtro."
                : "En cuanto se aplique un ajuste o se emita una gift card aparecerá aquí."
            }
          />
        </Card>
      ) : (
        <>
          <ul className="mt-6 space-y-3">
            {entradas.map((e) => (
              <li key={e.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge tono={e.accion.includes("adjustment") ? "aviso" : "exito"}>
                          {ETIQUETA_ACCION[e.accion] ?? e.accion}
                        </Badge>
                        <span className="text-xs text-text-muted">{fecha(e.fecha)}</span>
                      </div>

                      <p className="mt-2.5 text-sm">
                        <span className="text-text-muted">Por </span>
                        <Quien persona={e.actor} />
                        {e.objetivo && (
                          <>
                            <span className="text-text-muted"> sobre la cuenta de </span>
                            <Quien persona={e.objetivo} />
                          </>
                        )}
                      </p>

                      {e.motivo && (
                        <p className="mt-2 text-sm leading-relaxed text-espresso">{e.motivo}</p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-6">
                        <Delta datos={e.antes} titulo="Antes" />
                        <Delta datos={e.despues} titulo="Después" />
                      </div>

                      {e.requestId && (
                        <p className="mt-3 text-[0.65rem] text-text-muted">
                          request: {e.requestId}
                        </p>
                      )}
                    </div>

                    {e.objetivo && (
                      <Link
                        href={`/admin/usuarios/${e.objetivo.id}`}
                        className="shrink-0 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-primary-hover underline underline-offset-4"
                      >
                        Ver cuenta
                      </Link>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          <Paginacion
            pagina={numeroPagina}
            porPagina={porPagina}
            total={total}
            base="/admin/auditoria"
            parametros={{ accion: filtro }}
          />
        </>
      )}
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, Badge } from "@/components/ui/Surface";
import { EmptyState } from "@/components/states";
import { exigirAdmin } from "@/lib/services/admin-service";
import { listarAuditoria } from "@/lib/services/admin-consultas";

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

/** Muestra el antes/después sin pretender interpretarlo. */
function Delta({ datos, titulo }: { datos: Record<string, unknown> | null; titulo: string }) {
  if (!datos || Object.keys(datos).length === 0) return null;
  return (
    <div>
      <p className="text-[0.65rem] uppercase tracking-[0.12em] text-text-muted">{titulo}</p>
      <ul className="mt-1 space-y-0.5">
        {Object.entries(datos).map(([k, v]) => (
          <li key={k} className="font-display text-sm text-espresso">
            {k}: {String(v)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** /admin/auditoria — el rastro completo (`docs/00`). */
export default async function AuditoriaPage() {
  if (!(await exigirAdmin())) redirect("/");

  const entradas = await listarAuditoria();

  return (
    <>
      <p className="text-sm leading-relaxed text-text-muted">
        Cada ajuste manual, emisión y canje queda aquí con su motivo, su antes y su después. Es
        inmutable: no hay forma de editar ni borrar una entrada desde la aplicación.
      </p>

      {entradas.length === 0 ? (
        <Card className="mt-6 p-8">
          <EmptyState
            titulo="Sin actividad registrada"
            descripcion="En cuanto se aplique un ajuste o se emita una gift card aparecerá aquí."
          />
        </Card>
      ) : (
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

                    {e.motivo && (
                      <p className="mt-3 text-sm leading-relaxed text-espresso">{e.motivo}</p>
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
                      href={`/admin/usuarios/${e.objetivo}`}
                      className="shrink-0 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-terracota underline underline-offset-4"
                    >
                      Ver cuenta
                    </Link>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

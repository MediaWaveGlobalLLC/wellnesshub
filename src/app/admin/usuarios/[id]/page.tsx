import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Card, Badge } from "@/components/ui/Surface";
import { EmptyState } from "@/components/states";
import { AjusteForm } from "@/components/admin/AjusteForm";
import { BotonesRegla } from "@/components/admin/lealtad/BotonesRegla";
import { actorPuede, exigirAdmin } from "@/lib/services/admin-service";
import { obtenerFicha, type Movimiento } from "@/lib/services/admin-consultas";
import { listarReglas } from "@/lib/services/lealtad-admin";
import { usuarioIdSchema } from "@/lib/validation/admin";
import { formatearDolares, formatearPuntos } from "@/lib/loyalty";
import { formatearTelefono } from "@/lib/telefono";

export const metadata: Metadata = {
  title: "Usuario · Administración",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function fecha(iso: string): string {
  return new Intl.DateTimeFormat("es-PR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Puerto_Rico",
  }).format(new Date(iso));
}

function TablaMovimientos({
  movimientos,
  unidad,
}: {
  movimientos: Movimiento[];
  unidad: "dinero" | "puntos";
}) {
  if (movimientos.length === 0) {
    return <EmptyState titulo="Sin movimientos" descripcion="Esta cuenta aún no registra nada." />;
  }

  const fmt = (n: number) =>
    unidad === "dinero" ? formatearDolares(Math.abs(n)) : `${formatearPuntos(Math.abs(n))} pts`;

  return (
    <ul className="divide-y divide-border">
      {movimientos.map((m) => {
        const positivo = m.cantidad > 0;
        return (
          <li key={m.id} className="flex items-start gap-4 py-3.5 first:pt-0">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-espresso">
                {m.descripcion ?? m.tipo}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                {fecha(m.fecha)} · {m.tipo}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className={`text-sm font-semibold ${positivo ? "text-olive" : "text-terracota"}`}>
                {positivo ? "+" : "−"}
                {fmt(m.cantidad)}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                {unidad === "dinero"
                  ? formatearDolares(m.saldoDespues)
                  : `${formatearPuntos(m.saldoDespues)} pts`}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default async function FichaUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await exigirAdmin();
  if (!actor) redirect("/");

  const { id } = await params;

  /*
    Validar el id ANTES de consultar. Sin esto, `/admin/usuarios/hola` llegaba a
    Postgres tal cual y reventaba con un `22P02: invalid input syntax for type
    uuid` sin capturar; como tampoco había `error.tsx`, acababa en la pantalla
    de error genérica de Next. Un id que no es un id es un 404, no un fallo.
  */
  if (!usuarioIdSchema.safeParse(id).success) notFound();

  // El mostrador ve el saldo actual —lo necesita para responder «¿cuánto
  // tengo?»— pero no el historial de movimientos, que dice dónde y cuándo
  // gasta una persona.
  const verLedger = actorPuede(actor, "ver_ledger");
  const puedeAjustar = actorPuede(actor, "ajustar_saldo");
  const puedeAplicar = actorPuede(actor, "aplicar_regla");

  const [ficha, reglas] = await Promise.all([
    obtenerFicha(id),
    // Solo las que se pueden dar a mano: las automáticas ya las da el sistema y
    // darlas otra vez duplicaría el bono.
    puedeAplicar ? listarReglas() : Promise.resolve([]),
  ]);
  if (!ficha) notFound();

  const manuales = reglas.filter((r) => r.aplicacion === "manual" && r.activa);

  return (
    <>
      <Link
        href="/admin/usuarios"
        className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-terracota underline underline-offset-4"
      >
        ← Volver a usuarios
      </Link>

      <Card className="mt-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl text-espresso">{ficha.nombre}</h2>
            <p className="mt-1 text-sm text-text-muted">{ficha.email ?? "sin correo"}</p>
            {ficha.telefono && (
              <p className="text-sm text-text-muted">{formatearTelefono(ficha.telefono)}</p>
            )}
            <p className="mt-2 font-display text-lg text-espresso">{ficha.memberId}</p>
            <p className="mt-1 text-xs text-text-muted">Alta: {fecha(ficha.alta)}</p>
          </div>

          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.12em] text-text-muted">Crédito</p>
              <p className="font-display text-2xl text-espresso">
                {formatearDolares(ficha.saldoCents)}
              </p>
            </div>
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.12em] text-text-muted">Puntos</p>
              <p className="font-display text-2xl text-espresso">
                {formatearPuntos(ficha.puntos)}
              </p>
            </div>
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.12em] text-text-muted">Nivel</p>
              <div className="mt-1">
                <Badge tono="exito">{ficha.nivel}</Badge>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {puedeAplicar && (
        <Card className="mt-6 p-6">
          <h3 className="font-display text-lg text-espresso">Dar puntos de una regla</h3>
          <p className="mt-1 text-sm leading-relaxed text-text-muted">
            Los puntos los pone la regla, no tú. Queda en la auditoría con el concepto.
          </p>
          <div className="mt-5">
            <BotonesRegla userId={ficha.id} reglas={manuales} />
          </div>
        </Card>
      )}

      {puedeAjustar && (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <Card className="p-6">
            <h3 className="font-display text-lg text-espresso">Ajustar crédito</h3>
            <p className="mt-1 text-sm text-text-muted">Dinero de tienda, en dólares.</p>
            <div className="mt-5">
              <AjusteForm userId={ficha.id} tipo="wallet" />
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-display text-lg text-espresso">Ajustar puntos</h3>
            <p className="mt-1 text-sm text-text-muted">
              Lealtad. No tiene valor monetario ni toca el crédito.
            </p>
            <div className="mt-5">
              <AjusteForm userId={ficha.id} tipo="puntos" />
            </div>
          </Card>
        </div>
      )}

      {verLedger && (
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="font-display text-lg text-espresso">Movimientos de crédito</h3>
          <div className="mt-5">
            <TablaMovimientos movimientos={ficha.movimientosWallet} unidad="dinero" />
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-display text-lg text-espresso">Movimientos de puntos</h3>
          <div className="mt-5">
            <TablaMovimientos movimientos={ficha.movimientosPuntos} unidad="puntos" />
          </div>
        </Card>
      </div>
      )}
    </>
  );
}

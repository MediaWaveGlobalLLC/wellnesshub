import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, Badge } from "@/components/ui/Surface";
import { EmptyState } from "@/components/states";
import { exigirAdmin } from "@/lib/services/admin-service";
import { buscarUsuarios } from "@/lib/services/admin-consultas";
import { formatearDolares, formatearPuntos } from "@/lib/loyalty";
import { formatearTelefono } from "@/lib/telefono";

export const metadata: Metadata = {
  title: "Usuarios · Administración",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** /admin/usuarios — búsqueda por nombre, correo, teléfono o member ID (`docs/00`). */
export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!(await exigirAdmin())) redirect("/");

  const { q } = await searchParams;
  const consulta = (q ?? "").trim();
  const usuarios = await buscarUsuarios(consulta);

  return (
    <>
      {/* GET y no POST: la búsqueda es idempotente y así el enlace es compartible. */}
      <form method="get" className="flex flex-wrap gap-3">
        <label htmlFor="q" className="sr-only">
          Buscar por nombre, correo, teléfono o ID de miembro
        </label>
        <input
          id="q"
          name="q"
          defaultValue={consulta}
          placeholder="Nombre, correo, teléfono o SMB-000123"
          className="min-h-[var(--control-height)] flex-1 rounded-lg border border-border bg-surface px-4 text-espresso placeholder:text-text-muted/60 focus:border-terracota focus:outline-none"
        />
        <button
          type="submit"
          className="btn-pill bg-terracota px-7 text-[0.72rem] font-bold uppercase tracking-[0.12em] text-leche transition-colors hover:bg-primary-hover"
        >
          Buscar
        </button>
      </form>

      <p className="mt-3 text-xs text-text-muted">
        {consulta
          ? `${usuarios.length} resultado${usuarios.length === 1 ? "" : "s"} para «${consulta}»`
          : "Mostrando las cuentas más recientes."}
      </p>

      {usuarios.length === 0 ? (
        <Card className="mt-6 p-8">
          <EmptyState
            titulo="Sin resultados"
            descripcion="Prueba con el correo completo, el teléfono o el ID de miembro."
          />
        </Card>
      ) : (
        <ul className="mt-6 space-y-3">
          {usuarios.map((u) => (
            <li key={u.id}>
              <Link href={`/admin/usuarios/${u.id}`} className="block">
                <Card className="p-5 transition-colors hover:border-terracota/40">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-display text-lg text-espresso">{u.nombre}</p>
                      <p className="mt-0.5 truncate text-sm text-text-muted">
                        {u.email ?? "sin correo"}
                        {u.telefono ? ` · ${formatearTelefono(u.telefono)}` : ""}
                      </p>
                      <p className="mt-1 font-display text-sm text-text-muted">{u.memberId}</p>
                    </div>

                    <div className="flex items-center gap-5">
                      <div className="text-right">
                        <p className="text-[0.65rem] uppercase tracking-[0.12em] text-text-muted">
                          Puntos
                        </p>
                        <p className="font-display text-lg text-espresso">
                          {formatearPuntos(u.puntos)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[0.65rem] uppercase tracking-[0.12em] text-text-muted">
                          Crédito
                        </p>
                        <p className="font-display text-lg text-espresso">
                          {formatearDolares(u.saldoCents)}
                        </p>
                      </div>
                      <Badge tono="exito">{u.nivel}</Badge>
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

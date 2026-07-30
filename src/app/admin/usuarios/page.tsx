import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, Badge } from "@/components/ui/Surface";
import { EmptyState } from "@/components/states";
import { Celda, Fila, Tabla } from "@/components/admin/ui/Tabla";
import { Paginacion } from "@/components/admin/ui/Paginacion";
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
  searchParams: Promise<{ q?: string; pagina?: string }>;
}) {
  if (!(await exigirAdmin())) redirect("/");

  const { q, pagina } = await searchParams;
  const consulta = (q ?? "").trim();
  // Una página que no es número cae a la primera, en vez de propagar un NaN
  // hasta el OFFSET de la consulta.
  const numeroPagina = Number.parseInt(pagina ?? "1", 10) || 1;
  const { usuarios, total, porPagina } = await buscarUsuarios(consulta, numeroPagina);

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
          className="btn-pill bg-terracota px-7 text-[0.72rem] font-bold uppercase tracking-[0.12em] text-surface transition-colors hover:bg-primary-hover"
        >
          Buscar
        </button>
      </form>

      <p className="mt-3 text-xs text-text-muted">
        {consulta
          ? `${total} resultado${total === 1 ? "" : "s"} para «${consulta}»`
          : `${total} cuenta${total === 1 ? "" : "s"}, de la más reciente a la más antigua.`}
      </p>

      {usuarios.length === 0 ? (
        <Card className="mt-6 p-8">
          <EmptyState
            titulo="Sin resultados"
            descripcion="Prueba con el correo completo, el teléfono o el ID de miembro."
          />
        </Card>
      ) : (
        <Card className="mt-6 p-5 sm:p-6">
          <Tabla
            descripcion={`Cuentas de socios${consulta ? ` que coinciden con ${consulta}` : ""}`}
            columnas={[
              { clave: "socio", titulo: "Socio" },
              { clave: "contacto", titulo: "Contacto", secundaria: true },
              { clave: "nivel", titulo: "Nivel", secundaria: true },
              { clave: "puntos", titulo: "Puntos", numerica: true },
              { clave: "credito", titulo: "Crédito", numerica: true },
            ]}
          >
            {usuarios.map((u) => (
              <Fila key={u.id}>
                <Celda principal>
                  <Link
                    href={`/admin/usuarios/${u.id}`}
                    className="underline decoration-terracota decoration-2 underline-offset-4 transition-colors hover:text-primary-hover"
                  >
                    {u.nombre}
                  </Link>
                  <span className="mt-0.5 block font-display text-xs text-text-muted">
                    {u.memberId}
                  </span>
                </Celda>
                <Celda secundaria>
                  <span className="block truncate">{u.email ?? "sin correo"}</span>
                  {u.telefono && (
                    <span className="mt-0.5 block text-xs">{formatearTelefono(u.telefono)}</span>
                  )}
                </Celda>
                <Celda secundaria>
                  <Badge tono="exito">{u.nivel}</Badge>
                </Celda>
                <Celda numerica>{formatearPuntos(u.puntos)}</Celda>
                <Celda numerica>{formatearDolares(u.saldoCents)}</Celda>
              </Fila>
            ))}
          </Tabla>

          <Paginacion
            pagina={numeroPagina}
            porPagina={porPagina}
            total={total}
            base="/admin/usuarios"
            parametros={{ q: consulta || undefined }}
          />
        </Card>
      )}
    </>
  );
}

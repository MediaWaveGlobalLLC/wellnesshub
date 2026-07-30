import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Alert, Badge, Card } from "@/components/ui/Surface";
import { EmptyState } from "@/components/states";
import { Celda, Fila, Tabla } from "@/components/admin/ui/Tabla";
import { Paginacion } from "@/components/admin/ui/Paginacion";
import { actorPuede, exigirDuena } from "@/lib/services/admin-service";
import { listarNewsletter } from "@/lib/services/operaciones";
import { DescargaIcon, LupaIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Lista de correo · Administración",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const POR_PAGINA = 50;

function fecha(iso: string): string {
  return new Intl.DateTimeFormat("es-PR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Puerto_Rico",
  }).format(new Date(iso));
}

/**
 * /admin/newsletter — la lista que llevaba desde `0007` sin poderse mirar.
 *
 * La tabla tiene política de INSERT público y ninguna de SELECT: se llevan
 * recogiendo correos que solo se veían entrando al panel de Supabase.
 */
export default async function NewsletterPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pagina?: string }>;
}) {
  const actor = await exigirDuena();
  if (!actor) notFound();
  if (!actorPuede(actor, "ver_newsletter")) notFound();

  const { q, pagina } = await searchParams;
  const consulta = (q ?? "").trim();
  const n = Number(pagina ?? 1);
  const paginaActual = Number.isFinite(n) && n > 0 ? Math.trunc(n) : 1;

  const { suscriptores, total } = await listarNewsletter(consulta, paginaActual, POR_PAGINA);

  const activos = suscriptores.filter((s) => !s.bajaAt).length;

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-espresso">Lista de correo</h1>
          <p className="mt-1 text-sm text-text-muted">
            {total} correo{total === 1 ? "" : "s"} recogido{total === 1 ? "" : "s"}
            {consulta ? " que coinciden con la búsqueda" : ""}.
          </p>
        </div>

        {/*
          La exportación es un enlace normal a una ruta que responde con
          `Content-Disposition: attachment`. Sin JavaScript, sin construir el
          fichero en el navegador y sin traerse la lista entera a la página solo
          para poder descargarla.
        */}
        <a
          href={consulta ? `/api/admin/newsletter?q=${encodeURIComponent(consulta)}` : "/api/admin/newsletter"}
          className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-primary-hover underline underline-offset-4"
        >
          <DescargaIcon size={15} />
          Descargar CSV
        </a>
      </div>

      <Alert titulo="Esto es un fichero de datos personales">
        <p>
          Son correos que la gente dejó para recibir novedades, nada más. No se pueden usar para
          otra cosa ni pasarse a terceros, y quien pida la baja tiene que dejar de recibirlas. El
          CSV que descargues sale de aquí y pasa a estar bajo tu custodia.
        </p>
      </Alert>

      <form method="get" className="mt-5 flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <label
            htmlFor="q"
            className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-muted"
          >
            Buscar un correo
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
              <LupaIcon size={16} />
            </span>
            <input
              id="q"
              name="q"
              defaultValue={consulta}
              placeholder="parte del correo"
              className="min-h-[var(--control-height)] w-full rounded-lg border border-border bg-surface pl-11 pr-4 text-espresso placeholder:text-text-muted/60 transition-colors duration-200 focus:border-terracota focus:outline-none"
            />
          </div>
        </div>
        <button
          type="submit"
          className="min-h-[var(--control-height)] rounded-lg bg-terracota px-6 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-surface transition-colors hover:bg-primary-hover"
        >
          Buscar
        </button>
      </form>

      {suscriptores.length === 0 ? (
        <Card className="mt-6 p-8">
          <EmptyState
            titulo={consulta ? "Sin resultados" : "Todavía no hay nadie suscrito"}
            descripcion={
              consulta
                ? "Ningún correo coincide con esa búsqueda."
                : "El bloque de la portada y el de comunidad recogen los correos aquí."
            }
          />
        </Card>
      ) : (
        <Card className="mt-6 p-5 sm:p-6">
          <p className="mb-4 text-xs text-text-muted">
            {activos} de los {suscriptores.length} de esta página siguen suscritos.
          </p>

          <Tabla
            descripcion="Personas suscritas a las novedades"
            columnas={[
              { clave: "email", titulo: "Correo" },
              { clave: "origen", titulo: "De dónde", secundaria: true },
              { clave: "alta", titulo: "Se apuntó", secundaria: true },
              { clave: "estado", titulo: "Estado", numerica: true },
            ]}
          >
            {suscriptores.map((s) => (
              <Fila key={s.email}>
                <Celda principal>{s.email}</Celda>
                <Celda secundaria>{s.origen}</Celda>
                <Celda secundaria>{fecha(s.altaAt)}</Celda>
                <Celda numerica>
                  {s.bajaAt ? (
                    <Badge tono="peligro">Se dio de baja</Badge>
                  ) : (
                    <Badge tono="exito">Suscrito</Badge>
                  )}
                </Celda>
              </Fila>
            ))}
          </Tabla>

          <Paginacion
            pagina={paginaActual}
            porPagina={POR_PAGINA}
            total={total}
            base="/admin/newsletter"
            parametros={consulta ? { q: consulta } : {}}
          />
        </Card>
      )}
    </>
  );
}

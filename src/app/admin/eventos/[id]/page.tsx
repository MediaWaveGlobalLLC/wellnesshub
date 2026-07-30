import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge, Card } from "@/components/ui/Surface";
import { ListaAsistencia } from "@/components/admin/eventos/ListaAsistencia";
import { actorPuede, exigirAdmin } from "@/lib/services/admin-service";
import { listarEventos, listarReservas } from "@/lib/services/operaciones";
import { usuarioIdSchema } from "@/lib/validation/admin";

export const metadata: Metadata = {
  title: "Lista de asistencia · Administración",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function cuando(iso: string): string {
  return new Intl.DateTimeFormat("es-PR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Puerto_Rico",
  }).format(new Date(iso));
}

/** /admin/eventos/[id] — quién viene y quién vino. */
export default async function ListaAsistenciaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await exigirAdmin();
  if (!actor) notFound();
  if (!actorPuede(actor, "ver_eventos")) notFound();

  const { id } = await params;

  // Se valida la forma antes de consultar: un id que no es UUID hace que
  // Postgres lance un 22P02 sin capturar, y la página muere con un error feo en
  // vez de con un 404.
  const parsed = usuarioIdSchema.safeParse(id);
  if (!parsed.success) notFound();

  const [{ todos }, reservas] = await Promise.all([listarEventos(), listarReservas(parsed.data)]);
  const evento = todos.find((e) => e.id === parsed.data);
  if (!evento) notFound();

  const ocupadas = evento.confirmadas + evento.asistieron;

  return (
    <>
      <Link
        href="/admin/eventos"
        className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-primary-hover underline underline-offset-4"
      >
        ← Todos los eventos
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl text-espresso">
            {evento.titulo}
            <Badge tono={evento.publicado ? "exito" : "neutro"}>
              {evento.publicado ? "En la web" : "Borrador"}
            </Badge>
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {cuando(evento.iniciaAt)} · {evento.lugar}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-4">
        <Dato etiqueta="Plazas ocupadas" valor={`${ocupadas}${evento.aforo !== null ? ` / ${evento.aforo}` : ""}`} />
        <Dato etiqueta="Asistieron" valor={String(evento.asistieron)} />
        <Dato etiqueta="No vinieron" valor={String(evento.ausentes)} />
        <Dato etiqueta="Cancelaron" valor={String(evento.canceladas)} />
      </div>

      <Card className="mt-5 p-5 sm:p-6">
        <h2 className="font-display text-xl text-espresso">Lista</h2>
        <p className="mt-1 text-sm text-text-muted">
          Ordenada por nombre, que es como se busca a alguien en la puerta. Cada marca queda
          auditada; volver a pulsar la deshace.
        </p>
        <div className="mt-4">
          <ListaAsistencia
            reservas={reservas}
            puedeMarcar={actorPuede(actor, "marcar_asistencia")}
          />
        </div>
      </Card>
    </>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <Card className="p-4">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
        {etiqueta}
      </p>
      <p className="mt-1 font-display text-2xl leading-none text-espresso">{valor}</p>
    </Card>
  );
}

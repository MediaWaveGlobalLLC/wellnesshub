import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SubpaginaShell } from "@/components/perfil/SubpaginaShell";
import { BotonReserva } from "@/components/perfil/BotonReserva";
import { Card, Badge } from "@/components/ui/Surface";
import { EmptyState } from "@/components/states";
import { CalendarIcon, CupIcon, PinIcon } from "@/components/icons";
import { crearClienteServidor } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "Eventos y talleres",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ZONA = "America/Puerto_Rico";

function fechaLarga(iso: string): string {
  const t = new Intl.DateTimeFormat("es-PR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: ZONA,
  }).format(new Date(iso));
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function hora(iso: string): string {
  return new Intl.DateTimeFormat("es-PR", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: ZONA,
  }).format(new Date(iso));
}

export default async function EventosPage() {
  if (!supabaseConfigurado()) redirect("/iniciar-sesion?siguiente=%2Fperfil%2Feventos");

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/iniciar-sesion?siguiente=%2Fperfil%2Feventos");

  // Solo eventos publicados: la política RLS ya los filtra.
  const [{ data: eventos }, { data: reservas }] = await Promise.all([
    supabase
      .from("events")
      .select("id, slug, title, description, starts_at, ends_at, location, capacity")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(30),
    supabase.from("event_bookings").select("event_id, status"),
  ]);

  const confirmadas = new Set(
    (reservas ?? []).filter((r) => r.status === "confirmada").map((r) => r.event_id)
  );

  const proximos = eventos ?? [];
  const misReservas = proximos.filter((e) => confirmadas.has(e.id));

  return (
    <SubpaginaShell
      titulo="Eventos y talleres"
      descripcion="Reserva tu plaza en las experiencias de la comunidad SIEMBRA."
    >
      {misReservas.length > 0 && (
        <section className="mb-12">
          <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
            Tus reservas
          </h2>
          <ul className="mt-4 space-y-3">
            {misReservas.map((e) => (
              <li key={e.id}>
                <Card tono="forest" className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div>
                    <p className="font-display text-lg text-avena">{e.title}</p>
                    <p className="mt-1 text-sm text-avena/75">
                      {fechaLarga(e.starts_at)} · {hora(e.starts_at)}
                      {e.ends_at ? ` – ${hora(e.ends_at)}` : ""}
                    </p>
                  </div>
                  <Badge tono="aviso">Confirmada</Badge>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
          Próximas experiencias
        </h2>

        {proximos.length === 0 ? (
          <div className="mt-4">
            <Card className="p-8">
              <EmptyState
                titulo="No hay eventos programados"
                descripcion="Publicamos talleres, catas y sesiones de bienestar cada mes. Vuelve pronto o síguenos para enterarte."
                accion={{ href: "/comunidad", texto: "Ver la comunidad" }}
              />
            </Card>
          </div>
        ) : (
          <ul className="mt-4 grid gap-4 lg:grid-cols-2">
            {proximos.map((e) => (
              <li key={e.id}>
                <Card className="flex h-full flex-col justify-between p-6">
                  <div>
                    <p className="font-display text-xl text-espresso">{e.title}</p>
                    {e.description && (
                      <p className="mt-2 text-sm leading-relaxed text-text-muted">{e.description}</p>
                    )}
                    <ul className="mt-4 space-y-1.5 text-sm text-text-muted">
                      <li className="flex items-center gap-2">
                        <CalendarIcon size={15} /> {fechaLarga(e.starts_at)}
                      </li>
                      <li className="flex items-center gap-2">
                        <CupIcon size={15} /> {hora(e.starts_at)}
                        {e.ends_at ? ` – ${hora(e.ends_at)}` : ""}
                      </li>
                      <li className="flex items-center gap-2">
                        <PinIcon size={15} /> {e.location}
                      </li>
                    </ul>
                  </div>

                  <div className="mt-6">
                    <BotonReserva eventId={e.id} reservado={confirmadas.has(e.id)} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </SubpaginaShell>
  );
}

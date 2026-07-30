import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Card, Badge } from "@/components/ui/Surface";
import { Reveal } from "@/components/Reveal";
import { EmptyState } from "@/components/states";
import { crearClienteServidor } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { BRAND_ASSETS } from "@/lib/brand-assets.generated";
import { CalendarIcon, CupIcon, PinIcon, LeafIcon, HeartIcon, StarIcon } from "@/components/icons";
import {
  EXPERIENCIA_DIA,
  WELLNESS_PROGRAM,
  SPORTS_PROGRAM,
  CALENDARIO,
  AMBIENTAL,
  FRASES,
} from "@/lib/site";

/**
 * /comunidad — ruta del contrato (`config/route-contracts.json`).
 *
 * `docs/02` la define como "eventos y talleres". Reúne los eventos reales de la
 * base con la programación del deck oficial: el día en SIEMBRA, los programas
 * de bienestar y deporte, el calendario anual y el compromiso ambiental.
 *
 * Todo el contenido sale de `src/lib/site.ts`, transcrito del deck y del menú
 * oficiales. Cero texto inventado.
 */
export const metadata: Metadata = {
  title: "Comunidad",
  description:
    "Talleres, encuentros y programación de bienestar de SIEMBRA en Condado, Puerto Rico.",
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

export default async function ComunidadPage() {
  // Eventos publicados y futuros. RLS ya filtra los borradores.
  let eventos: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    starts_at: string;
    ends_at: string | null;
    location: string;
  }[] = [];

  if (supabaseConfigurado()) {
    const supabase = await crearClienteServidor();
    const { data } = await supabase
      .from("events")
      .select("id, slug, title, description, starts_at, ends_at, location")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(8);
    eventos = data ?? [];
  }

  return (
    <>
      {/* Hero */}
      <section className="grain bg-leche pb-14 pt-32 sm:pt-36">
        <div className="mx-auto grid max-w-[var(--container-content)] items-center gap-10 px-5 sm:px-8 lg:grid-cols-2 lg:gap-14">
          <div className="entrada entrada-1">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
              Comunidad
            </p>
            <h1 className="mt-4 font-display text-[clamp(2.5rem,5.5vw,4rem)] leading-[1.05] text-espresso">
              No construimos clientes.
              <br />
              <em className="font-display italic text-terracota">Construimos comunidad.</em>
            </h1>
            <p className="mt-5 max-w-md leading-relaxed text-text-muted">
              Talleres, encuentros y hábitos compartidos. Un espacio donde el café y el matcha son
              la excusa para reunirnos.
            </p>
          </div>

          <div className="entrada entrada-2 relative aspect-[4/3] overflow-hidden rounded-lg">
            <Image
              src={BRAND_ASSETS.siembraToteCupsMugNapkinsPromo.src}
              alt="Productos de SIEMBRA sobre piedra, con luz natural"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* Próximos eventos — datos reales */}
      <section className="bg-surface py-14 sm:py-20">
        <div className="mx-auto max-w-[var(--container-content)] px-5 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
                Próximas experiencias
              </p>
              <h2 className="mt-3 font-display text-3xl text-espresso">Reserva tu plaza</h2>
            </div>
            <Link
              href="/perfil/eventos"
              className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-espresso underline decoration-terracota decoration-2 underline-offset-4"
            >
              Gestionar mis reservas
            </Link>
          </div>

          {eventos.length === 0 ? (
            <Card className="mt-8 p-8">
              <EmptyState
                titulo="Todavía no hay fechas publicadas"
                descripcion="Publicamos talleres, catas y sesiones de bienestar cada mes. Suscríbete desde la home para enterarte."
                accion={{ href: "/", texto: "Volver a la home" }}
              />
            </Card>
          ) : (
            <ul className="mt-8 grid gap-4 lg:grid-cols-2">
              {eventos.map((e) => (
                <li key={e.id}>
                  <Card className="h-full p-6">
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
                    <Link
                      href="/perfil/eventos"
                      className="mt-5 inline-block text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-terracota underline underline-offset-4"
                    >
                      Reservar
                    </Link>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Un día en SIEMBRA — deck pág. 10 */}
      <section className="grain bg-leche py-14 sm:py-20">
        <div className="mx-auto max-w-[var(--container-content)] px-5 sm:px-8">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
            Un día en SIEMBRA
          </p>
          <h2 className="mt-3 font-display text-3xl text-espresso">
            Desde el amanecer hasta el atardecer.
          </h2>

          <ol className="mt-8 space-y-0">
            {EXPERIENCIA_DIA.map((h, i) => (
              <li key={h.hora}>
                <Reveal delay={i * 0.05}>
                  <div className="flex gap-6 border-b border-border py-5 last:border-0">
                    <p className="w-24 shrink-0 font-display text-lg text-terracota">{h.hora}</p>
                    <div>
                      <p className="font-semibold text-espresso">{h.es}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-text-muted">{h.descEs}</p>
                    </div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Programas — deck págs. 12 y 13 */}
      <section className="bg-forest py-14 text-avena sm:py-20">
        <div className="mx-auto grid max-w-[var(--container-content)] gap-10 px-5 sm:px-8 lg:grid-cols-2 lg:gap-14">
          <div>
            <p className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-avena/70">
              <HeartIcon size={16} /> Bienestar
            </p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {WELLNESS_PROGRAM.map((p) => (
                <li
                  key={p.es}
                  className="rounded-sm border border-avena/25 px-3.5 py-1.5 text-sm text-avena/90"
                >
                  {p.es}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-avena/70">
              <StarIcon size={16} /> Deporte
            </p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {SPORTS_PROGRAM.map((p) => (
                <li
                  key={p.es}
                  className="rounded-sm border border-avena/25 px-3.5 py-1.5 text-sm text-avena/90"
                >
                  {p.es}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Calendario anual — deck pág. 14 */}
      <section className="grain bg-surface py-14 sm:py-20">
        <div className="mx-auto max-w-[var(--container-content)] px-5 sm:px-8">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
            Calendario anual
          </p>
          <h2 className="mt-3 font-display text-3xl text-espresso">Doce meses, doce motivos.</h2>

          <ul className="mt-8 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {CALENDARIO.map((c) => (
              <li key={c.mes.es} className="flex gap-4 border-b border-border pb-3">
                <span className="w-24 shrink-0 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-terracota">
                  {c.mes.es}
                </span>
                <span className="text-sm text-espresso">{c.evento.es}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Compromiso ambiental — deck pág. 18 */}
      <section className="grain bg-leche py-14 sm:py-20">
        <div className="mx-auto max-w-[var(--container-content)] px-5 sm:px-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,20rem)_1fr] lg:gap-14">
            <div>
              <p className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
                <LeafIcon size={16} /> Compromiso ambiental
              </p>
              <h2 className="mt-3 font-display text-2xl leading-tight text-espresso">
                Cuidar el lugar donde nos reunimos.
              </h2>
            </div>

            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {AMBIENTAL.map((a) => (
                <li key={a.es}>
                  <Badge>{a.es}</Badge>
                </li>
              ))}
            </ul>
          </div>

          <blockquote className="mt-14 border-l-2 border-terracota pl-6">
            <p className="font-display text-2xl italic leading-snug text-espresso sm:text-3xl">
              “{FRASES.comunidad.es}”
            </p>
          </blockquote>
        </div>
      </section>
    </>
  );
}

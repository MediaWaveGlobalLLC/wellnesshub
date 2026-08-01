import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/Surface";
import { crearClienteServidor } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { obtenerDashboard } from "@/lib/services/profile-service";
import { canjesPendientes, listarRecompensas } from "@/lib/services/recompensas";
import { CanjesPendientes, Recompensas } from "@/components/puntos/Recompensas";
import { formatearPuntos } from "@/lib/loyalty";
import { BRAND_ASSETS } from "@/lib/brand-assets.generated";

/**
 * /puntos — `05-cuenta-movil-reference.png`.
 *
 * La pantalla que la referencia pone detrás del icono de la hoja: cuántos
 * puntos tienes, cuánto falta para el siguiente escalón y de qué formas se
 * ganan.
 *
 * «Canjea tus puntos» sale del catálogo que la dueña gestiona en el panel
 * (`0020_recompensas.sql`). Si no hay ninguna recompensa publicada, la sección
 * no se pinta: una cuadrícula vacía prometería algo que no está.
 */
export const metadata: Metadata = {
  title: "Mis puntos",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Fotos para las formas de ganar puntos.
 *
 * Solo hay foto para tres de las siete reglas, y son justo las tres de la
 * referencia. Las demás se listan en texto debajo: `docs/01` prohíbe rellenar
 * con imágenes inventadas o de banco, así que una regla sin foto se enseña sin
 * foto.
 */
const FOTO_REGLA: Record<string, { src: string; alt: string }> = {
  bebida: { src: BRAND_ASSETS.siembraIcedCoffeePromo.src, alt: "Café helado de SIEMBRA" },
  tienda: { src: BRAND_ASSETS.siembraBagToteCupMockup.src, alt: "Tote y vaso de SIEMBRA" },
  por_dolar: {
    src: BRAND_ASSETS.siembraMatchaGlassMugPromo.src,
    alt: "Matcha en vaso de cristal",
  },
};

/**
 * Saludo según la hora de Puerto Rico, no la del servidor.
 *
 * Vercel ejecuta en UTC: sin fijar la zona, a las 9 de la noche en Condado la
 * pantalla daría los buenos días.
 */
function saludo(): string {
  const hora = Number(
    new Intl.DateTimeFormat("es-PR", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Puerto_Rico",
    }).format(new Date())
  );
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

type Regla = { key: string; points: number; label: string };

async function reglasActivas(): Promise<Regla[]> {
  const supabase = await crearClienteServidor();
  // `loyalty_rules` es de lectura pública (`0005`): son las reglas del programa.
  const { data } = await supabase
    .from("loyalty_rules")
    .select("key, points, label")
    .eq("active", true)
    .order("points", { ascending: false });

  return (data ?? []).map((r) => ({
    key: r.key,
    points: Number(r.points),
    label: r.label,
  }));
}

export default async function PuntosPage() {
  /*
    Sin Supabase configurado no hay puntos que enseñar, y `obtenerDashboard()`
    no devuelve null: lanza. Se comprueba antes, como hace `/wallet`, para caer
    en el login en vez de en un 500. (`/perfil` todavía revienta por esto; queda
    fuera de este cambio.)
  */
  if (!supabaseConfigurado()) redirect("/iniciar-sesion?siguiente=%2Fpuntos");

  const dashboard = await obtenerDashboard();
  if (!dashboard) redirect("/iniciar-sesion?siguiente=%2Fpuntos");

  const { perfil, membresia } = dashboard;
  const [reglas, recompensas, pendientes] = await Promise.all([
    reglasActivas(),
    listarRecompensas(membresia.puntos),
    canjesPendientes(),
  ]);

  const conFoto = reglas.filter((r) => FOTO_REGLA[r.key]);
  const sinFoto = reglas.filter((r) => !FOTO_REGLA[r.key]);

  return (
    <div className="grain min-h-screen bg-leche pb-20 pt-28 sm:pt-32">
      <div className="mx-auto max-w-[var(--container-content)] px-5 sm:px-8">
        {/* Saludo. Sin emoji: `docs/01` los prohíbe como iconografía (DEC-003),
            aunque la referencia lleve uno junto al nombre. */}
        <header>
          <h1 className="font-display text-3xl leading-tight text-espresso sm:text-4xl">
            ¡{saludo()}, <span className="text-terracota">{perfil.nombre ?? "bienvenida"}!</span>
          </h1>
          <p className="mt-2 leading-relaxed text-text-muted">
            Gracias por ser parte de nuestra comunidad.
          </p>
        </header>

        {/* Saldo y progreso — la tarjeta partida de la referencia. */}
        <Card className="mt-6 overflow-hidden sm:mt-8">
          <div className="grid sm:grid-cols-2">
            <div className="border-b border-border p-6 sm:border-b-0 sm:border-r">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-text-muted">
                Tus puntos
              </p>
              <p className="mt-2 font-display text-5xl leading-none text-terracota">
                {formatearPuntos(membresia.puntos)}
              </p>
              <p className="mt-1 text-sm text-text-muted">puntos</p>
            </div>

            <div className="p-6">
              {membresia.siguiente ? (
                <>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-text-muted">
                    Próximo nivel
                  </p>
                  <p className="mt-2 font-display text-xl text-espresso">
                    {membresia.siguiente.label}
                  </p>
                  <p className="text-sm text-terracota">
                    {formatearPuntos(membresia.meta)} puntos
                  </p>

                  {/* La barra representa `puntos / meta`, igual que la etiqueta
                      de debajo: si midiera el avance dentro del tramo, dibujo y
                      número se contradirían. */}
                  <div
                    className="mt-4 h-2 w-full overflow-hidden rounded-lg bg-espresso/10"
                    role="progressbar"
                    aria-valuenow={membresia.puntos}
                    aria-valuemin={0}
                    aria-valuemax={membresia.meta}
                    aria-label={`Progreso hacia ${membresia.siguiente.label}`}
                  >
                    <div
                      className="h-full rounded-lg bg-terracota"
                      style={{ width: `${Math.round(membresia.fraccion * 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-text-muted">
                    Te faltan {formatearPuntos(membresia.faltan)} puntos
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-text-muted">
                    Tu nivel
                  </p>
                  <p className="mt-2 font-display text-xl text-espresso">
                    {membresia.actual.label}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">
                    Estás en el nivel más alto del programa. Gracias por sembrar con nosotros.
                  </p>
                </>
              )}
            </div>
          </div>
        </Card>

        <Recompensas recompensas={recompensas} />

        <CanjesPendientes canjes={pendientes} />

        {/* Cómo se ganan */}
        <section className="mt-10">
          <h2 className="font-display text-2xl text-espresso">Gana puntos</h2>

          {conFoto.length > 0 && (
            <ul className="mt-5 grid grid-cols-3 gap-4">
              {conFoto.map((r) => (
                <li key={r.key} className="text-center">
                  <div className="avatar relative mx-auto aspect-square w-full overflow-hidden rounded-full border border-border">
                    <Image
                      src={FOTO_REGLA[r.key]!.src}
                      alt={FOTO_REGLA[r.key]!.alt}
                      fill
                      sizes="(max-width: 640px) 30vw, 160px"
                      className="object-cover"
                    />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-espresso">{r.label}</p>
                  <p className="text-sm text-terracota">+{formatearPuntos(r.points)} pts</p>
                </li>
              ))}
            </ul>
          )}

          {sinFoto.length > 0 && (
            <ul className="mt-6 divide-y divide-border border-t border-border">
              {sinFoto.map((r) => (
                <li key={r.key} className="flex items-baseline justify-between gap-4 py-3.5">
                  <span className="text-espresso">{r.label}</span>
                  <span className="shrink-0 text-sm font-semibold text-terracota">
                    +{formatearPuntos(r.points)} pts
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

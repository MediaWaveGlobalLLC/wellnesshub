import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/Surface";
import { Reveal } from "@/components/Reveal";
import { BRAND_ASSETS } from "@/lib/brand-assets.generated";
import { MENU, type MenuSection } from "@/lib/site";
import { LeafIcon } from "@/components/icons";

/**
 * /menu — carta oficial.
 *
 * Server Component y en español (D15). La versión anterior era un componente
 * cliente con pestañas y textos bilingües; el contenido no cambia con la
 * interacción, así que no hay motivo para enviar JavaScript ni para partir la
 * carta en dos vistas que obligan a hacer clic para ver la mitad.
 *
 * Precios y nombres salen de `src/lib/site.ts`, transcritos del PDF oficial.
 * Cero productos inventados.
 */
export const metadata: Metadata = {
  title: "Menú",
  description:
    "Barra de matcha, cafés, bebidas para tu piel y pastelería. Precios en USD. SIEMBRA, Condado.",
};

/** Fondo por "mundo" del menú — paleta oficial. */
const FONDO: Record<MenuSection["mundo"], string> = {
  matcha: "bg-teatree/25",
  cafe: "bg-surface",
  piel: "bg-terracota/8",
  comida: "bg-mustard/10",
};

const ACENTO: Record<MenuSection["mundo"], string> = {
  matcha: "text-olive",
  cafe: "text-espresso",
  piel: "text-terracota",
  comida: "text-mustard",
};

function Seccion({ seccion, indice }: { seccion: MenuSection; indice: number }) {
  return (
    <Reveal delay={indice * 0.05}>
      <div id={seccion.id} className={`h-full scroll-mt-28 rounded-lg border border-border p-7 ${FONDO[seccion.mundo]}`}>
        <div className="mb-5 flex items-baseline justify-between gap-3 border-b border-espresso/15 pb-4">
          <h3 className={`font-display text-2xl ${ACENTO[seccion.mundo]}`}>{seccion.titulo.es}</h3>
          {seccion.sizes && (
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-text-muted">
              {seccion.sizes}
            </span>
          )}
        </div>

        <ul className="space-y-3.5">
          {seccion.items.map((item) => (
            <li key={item.nombre} className="flex items-baseline gap-2">
              <span className="flex items-center gap-1.5 font-medium text-espresso">
                {item.destacado && (
                  <LeafIcon size={14} className="text-mustard" aria-label="Destacado" />
                )}
                {item.nombre}
                {item.nota && (
                  <span className="text-xs font-normal italic text-text-muted">
                    ({item.nota.es})
                  </span>
                )}
              </span>
              <span className="mx-1 flex-1 border-b border-dotted border-espresso/25" />
              <span className="shrink-0 font-display text-lg text-espresso">${item.precio}</span>
            </li>
          ))}
        </ul>
      </div>
    </Reveal>
  );
}

export default function MenuPage() {
  const hoy = MENU.filter((s) => s.status === "hoy");
  const pronto = MENU.filter((s) => s.status === "pronto");

  return (
    <>
      {/* Hero */}
      <section className="grain bg-leche pb-12 pt-32 sm:pt-36">
        <div className="mx-auto grid max-w-[var(--container-content)] items-center gap-10 px-5 sm:px-8 lg:grid-cols-[1fr_minmax(0,26rem)] lg:gap-14">
          <div className="entrada entrada-1">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
              Nuestra carta
            </p>
            <h1 className="mt-4 font-display text-[clamp(2.5rem,5.5vw,4rem)] leading-[1.05] text-espresso">
              Café que eleva,
              <br />
              <em className="font-display italic text-terracota">matcha que calma.</em>
            </h1>
            <p className="mt-5 max-w-md leading-relaxed text-text-muted">
              Café de especialidad, matcha ceremonial y bebidas funcionales. Precios en USD.
            </p>
          </div>

          <div className="entrada entrada-2 relative aspect-[4/3] overflow-hidden rounded-lg">
            <Image
              src={BRAND_ASSETS.siembraCoffeeYMatcha.src}
              alt="Vasos de café y matcha de SIEMBRA"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 26rem"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* Disponible hoy */}
      <section className="bg-leche pb-16">
        <div className="mx-auto max-w-[var(--container-content)] px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-2xl text-espresso">Lo que puedes pedir hoy</h2>
            <Badge tono="exito">Disponible</Badge>
          </div>

          <div className="mt-7 grid gap-6 md:grid-cols-2">
            {hoy.map((s, i) => (
              <Seccion key={s.id} seccion={s} indice={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Próximamente */}
      {pronto.length > 0 && (
        <section className="grain bg-surface py-16">
          <div className="mx-auto max-w-[var(--container-content)] px-5 sm:px-8">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-2xl text-espresso">Próximamente</h2>
              <Badge tono="aviso">En camino</Badge>
            </div>

            <div className="mt-7 grid gap-6 md:grid-cols-2">
              {pronto.map((s, i) => (
                <Seccion key={s.id} seccion={s} indice={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Nota + CTA */}
      <section className="grain bg-leche py-14">
        <div className="mx-auto max-w-[var(--container-content)] px-5 text-center sm:px-8">
          <p className="mx-auto max-w-xl text-sm leading-relaxed text-text-muted">
            Los tamaños 12 oz / 16 oz aplican donde se indica. Los extras se añaden a cualquier
            bebida por $1.00. Menú sujeto a disponibilidad — estamos en temporada de soft opening.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/registro"
              className="btn-pill inline-flex items-center bg-terracota px-7 text-[0.75rem] font-bold uppercase tracking-[0.12em] text-leche transition-colors hover:bg-primary-hover"
            >
              Únete al Club SIEMBRA
            </Link>
            <Link
              href="/gift-cards"
              className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-espresso underline decoration-terracota decoration-2 underline-offset-[6px]"
            >
              Regalar una gift card
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

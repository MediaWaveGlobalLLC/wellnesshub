import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { SunBean } from "@/components/SunBean";
import { Reveal } from "@/components/Reveal";
import { NewsletterForm } from "@/components/home/NewsletterForm";
import { BRAND_ASSETS } from "@/lib/brand-assets.generated";
import { SITE, MENU } from "@/lib/site";
import { LeafIcon, HeartIcon, CalendarIcon, CupIcon, GiftIcon, StarIcon } from "@/components/icons";

/**
 * Home — mockup 04.
 *
 * Reproduce los bloques del mockup en su orden: barra superior, hero sobre
 * Leche con fotografía, banda Forest de cuatro pilares, Nuestra historia,
 * Favoritos del momento, bloque terracota de comunidad y footer.
 *
 * Server Component: no hay nada interactivo salvo el formulario de newsletter,
 * que es un componente cliente aparte. El contenido no depende de JavaScript
 * para verse.
 *
 * Los textos de secciones salen del mockup. Los productos y precios salen del
 * menú oficial en `src/lib/site.ts`: el mockup ilustra con bebidas que SIEMBRA
 * no vende (Caramel Latte, Mocha), y anunciar productos inexistentes sería
 * inventar. Se conserva la composición —cuatro tarjetas con foto, nombre y dos
 * líneas— con el catálogo real.
 */
export const metadata: Metadata = {
  title: "SIEMBRA — Wellness Hub | Coffee & Matcha Bar",
  description:
    "Café de especialidad, matcha y hábitos que nutren el cuerpo, la mente y el alma. Condado, San Juan.",
};

/** Los cuatro pilares de la banda Forest — mockup 04. */
const PILARES = [
  { Icono: LeafIcon, titulo: "Natural", detalle: "Ingredientes reales y de calidad." },
  { Icono: HeartIcon, titulo: "Comunidad", detalle: "Un espacio para compartir y crecer." },
  { Icono: StarIcon, titulo: "Bienestar", detalle: "Pequeños hábitos, grandes cambios." },
  { Icono: CupIcon, titulo: "Tropical", detalle: "Inspiración que nace de nuestra tierra." },
];

/** Beneficios del bloque terracota — mockup 04. */
const BENEFICIOS = [
  { Icono: CupIcon, titulo: "Bebida de bienvenida", detalle: "En tu primera compra." },
  { Icono: GiftIcon, titulo: "Ofertas exclusivas", detalle: "Solo para nuestra comunidad." },
  { Icono: CalendarIcon, titulo: "Eventos y experiencias", detalle: "Conecta, aprende y crece." },
];

/** Cuatro destacados del menú oficial, con la fotografía de marca disponible. */
const FAVORITOS = [
  { nombre: "Matcha Clásico", seccion: "matcha", foto: BRAND_ASSETS.siembraMatchaLattePromo, nota: "Suave, cremoso y energizante." },
  { nombre: "Mango Radiance", seccion: "matcha", foto: BRAND_ASSETS.siembraMatchaGlassMugPromo, nota: "Matcha y mango, dulce y tropical." },
  { nombre: "Latte", seccion: "cafes", foto: BRAND_ASSETS.siembraIcedCoffeePromo, nota: "Café de especialidad, balanceado." },
  { nombre: "Glow Rose", seccion: "piel", foto: BRAND_ASSETS.siembraCoffeeYMatcha, nota: "Mezcla Glow con colágeno." },
];

function precioDe(nombre: string): string | null {
  for (const seccion of MENU) {
    const item = seccion.items.find((i) => i.nombre === nombre);
    if (item) return item.precio;
  }
  return null;
}

export default function Home() {
  return (
    <>
      {/* ── Hero — mockup 04 ─────────────────────────────────────────────
          La barra de anuncio del mockup vive en el Header: este es `fixed`, y
          renderizarla aquí hacía que el header se montara encima y tapara tanto
          el anuncio como el logo. El padding deja sitio a header + barra. */}
      <section className="grain bg-leche pt-32 sm:pt-36">
        <div className="mx-auto grid max-w-[var(--container-content)] items-center gap-10 px-5 pb-16 sm:px-8 lg:grid-cols-2 lg:gap-14 lg:pb-24">
          <div className="entrada entrada-1">
            <h1 className="font-display text-[clamp(2.75rem,6vw,4.5rem)] leading-[1.05] text-espresso">
              Siembra bienestar.
              <br />
              <em className="font-display italic text-espresso/85">Cosecha tu mejor versión.</em>
            </h1>

            <p className="mt-6 max-w-md text-lg leading-relaxed text-text-muted">
              Café de especialidad, matcha y hábitos que nutren el cuerpo, la mente y el alma.
            </p>

            <Link
              href="/menu"
              className="btn-pill mt-9 inline-flex items-center bg-terracota px-8 text-[0.78rem] font-bold uppercase tracking-[0.12em] text-leche transition-colors hover:bg-primary-hover"
            >
              Descubre el menú
            </Link>
          </div>

          {/* Fotografía cálida con el sello circular del mockup. */}
          <div className="entrada entrada-2 relative">
            <div className="relative aspect-[4/3] overflow-hidden rounded-lg">
              <Image
                src={BRAND_ASSETS.siembraMatchaLattePromo.src}
                alt="Matcha latte servido en taza de cerámica sobre madera"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>

            <div className="circle absolute -left-4 bottom-6 hidden h-28 w-28 items-center justify-center rounded-full border border-espresso/15 bg-leche text-center sm:flex">
              <p className="px-3 font-display text-[0.7rem] uppercase leading-tight tracking-[0.1em] text-espresso">
                Hecho con
                <br />
                intención
                <br />
                para ti
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Cuatro pilares — banda Forest del mockup 04 ──────────────────── */}
      <section className="grain bg-forest py-12 text-avena sm:py-14">
        <ul className="mx-auto grid max-w-[var(--container-content)] grid-cols-2 gap-x-6 gap-y-10 px-5 sm:px-8 lg:grid-cols-4">
          {PILARES.map(({ Icono, titulo, detalle }) => (
            <li key={titulo} className="text-center">
              <Icono size={30} className="mx-auto text-avena" />
              <p className="mt-4 text-sm font-semibold text-avena">{titulo}</p>
              <p className="mx-auto mt-1 max-w-[15rem] text-sm leading-relaxed text-avena/70">
                {detalle}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Nuestra historia — mockup 04 ─────────────────────────────────── */}
      <section className="bg-surface">
        <div className="mx-auto grid max-w-[var(--container-content)] items-stretch gap-0 lg:grid-cols-2">
          <Reveal className="flex items-center px-5 py-16 sm:px-8 lg:py-24">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
                Nuestra historia
              </p>
              <h2 className="mt-4 font-display text-3xl leading-tight text-espresso sm:text-4xl">
                Hecho con intención,
                <br />
                para inspirar tu día.
              </h2>
              <p className="mt-5 max-w-md leading-relaxed text-text-muted">
                En SIEMBRA creemos que el bienestar se construye en los pequeños rituales de
                cada día. Por eso creamos un espacio donde el café, el matcha y la comunidad se
                encuentran.
              </p>
              <Link
                href="/nosotros"
                className="mt-8 inline-block text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-espresso underline decoration-terracota decoration-2 underline-offset-[6px]"
              >
                Conoce más sobre nosotros
              </Link>
            </div>
          </Reveal>

          <div className="relative min-h-[300px] lg:min-h-[480px]">
            <Image
              src={BRAND_ASSETS.siembraEmployeeStockPhoto.src}
              alt="Interior de SIEMBRA con plantas y luz natural"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* ── Favoritos del momento — mockup 04 ────────────────────────────── */}
      <section className="grain bg-leche py-16 sm:py-24">
        <div className="mx-auto max-w-[var(--container-content)] px-5 sm:px-8">
          <div className="flex items-end justify-between gap-4">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
              Favoritos del momento
            </p>
            <Link
              href="/menu"
              className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-espresso underline decoration-terracota decoration-2 underline-offset-4"
            >
              Ver menú completo
            </Link>
          </div>

          <ul className="mt-8 grid grid-cols-2 gap-5 lg:grid-cols-4">
            {FAVORITOS.map(({ nombre, foto, nota }, i) => {
              const precio = precioDe(nombre);
              return (
                <li key={nombre}>
                  <Reveal delay={i * 0.06}>
                    <div className="relative aspect-square overflow-hidden rounded-lg">
                      <Image
                        src={foto.src}
                        alt={nombre}
                        fill
                        sizes="(max-width: 1024px) 50vw, 25vw"
                        className="object-cover"
                      />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-espresso">{nombre}</p>
                    <p className="mt-1 text-sm leading-snug text-text-muted">{nota}</p>
                    {precio && <p className="mt-1 text-sm text-terracota">${precio}</p>}
                  </Reveal>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ── Únete a nuestra comunidad — bloque terracota del mockup 04 ───── */}
      <section className="relative overflow-hidden bg-terracota py-14 text-leche sm:py-16">
        {/* Motivo botánico del mockup, en el trazo de la marca. */}
        <LeafIcon
          size={340}
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-10 text-leche/10"
        />

        <div className="relative mx-auto grid max-w-[var(--container-content)] gap-10 px-5 sm:px-8 lg:grid-cols-2 lg:gap-14">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-leche/80">
              Únete a nuestra comunidad
            </p>
            <p className="mt-4 max-w-md leading-relaxed text-leche/90">
              Recibe beneficios exclusivos, promociones y contenido para tu bienestar.
            </p>
            <div className="mt-6 max-w-md">
              <NewsletterForm />
            </div>
          </div>

          <ul className="space-y-5">
            {BENEFICIOS.map(({ Icono, titulo, detalle }) => (
              <li key={titulo} className="flex items-start gap-4">
                <Icono size={26} className="mt-0.5 shrink-0 text-leche" />
                <div>
                  <p className="text-sm font-semibold text-leche">{titulo}</p>
                  <p className="text-sm text-leche/80">{detalle}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* El sello de marca cierra antes del footer Forest global. */}
      <div className="flex justify-center bg-leche py-10">
        <SunBean size={64} color="var(--color-terracota)" />
      </div>

      <span className="sr-only">
        {SITE.name} · {SITE.address}
      </span>
    </>
  );
}

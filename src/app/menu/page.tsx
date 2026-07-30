import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/Surface";
import { Reveal } from "@/components/Reveal";
import { BRAND_ASSETS } from "@/lib/brand-assets.generated";
import { LeafIcon } from "@/components/icons";
import { obtenerCatalogo } from "@/lib/catalogo/service";
import { precioDeCarta, type CategoriaCatalogo, type Mundo } from "@/lib/catalogo/tipos";

/**
 * /menu — carta oficial.
 *
 * Server Component y en español (D15). La versión anterior era un componente
 * cliente con pestañas y textos bilingües; el contenido no cambia con la
 * interacción, así que no hay motivo para enviar JavaScript ni para partir la
 * carta en dos vistas que obligan a hacer clic para ver la mitad.
 *
 * Los precios ya NO salen del código: vienen del catálogo en base de datos
 * (`0011_catalogo.sql`), sembrado desde la misma transcripción del PDF oficial.
 * El motivo es que un pedido necesita centavos enteros y un identificador por
 * producto, y porque subir el precio del café no puede exigir un despliegue.
 *
 * Cero productos inventados: `tests/integration/catalogo-fidelidad.test.ts`
 * compara el catálogo contra la carta original y falla si difieren.
 */
export const metadata: Metadata = {
  title: "Menú",
  description:
    "Barra de matcha, cafés, bebidas para tu piel y pastelería. Precios en USD. SIEMBRA, Condado.",
};

/**
 * La carta se sirve estática y se refresca sola cada 5 minutos.
 *
 * Sin esto quedaría horneada en el build, y cambiar el precio de un café
 * exigiría desplegar — que es justo lo que se quería evitar al sacar el menú
 * del código. Con revalidación, el visitante recibe HTML ya generado y el
 * cambio entra solo en la siguiente ventana.
 */
export const revalidate = 300;

/** Fondo por "mundo" del menú — paleta oficial. */
const FONDO: Record<Mundo, string> = {
  matcha: "bg-teatree/25",
  cafe: "bg-surface",
  piel: "bg-terracota/8",
  comida: "bg-mustard/10",
};

/*
  Color del título de cada sección.

  `comida` usaba mustard y daba 2.13:1 sobre el fondo claro, cuando incluso el
  umbral relajado de texto grande pide 3:1. Mustard es un amarillo: funciona como
  fondo, como borde o como icono, pero no como texto. La identidad del mundo
  `comida` la sigue marcando su fondo `bg-mustard/10`; solo cambia el color de la
  letra, que además es una elección mía de la Fase 7, no del mockup.
*/
const ACENTO: Record<Mundo, string> = {
  matcha: "text-olive",
  cafe: "text-espresso",
  piel: "text-terracota",
  comida: "text-espresso",
};

function Seccion({ seccion, indice }: { seccion: CategoriaCatalogo; indice: number }) {
  return (
    <Reveal delay={indice * 0.05}>
      <div id={seccion.slug} className={`h-full scroll-mt-28 rounded-lg border border-border p-7 ${FONDO[seccion.mundo]}`}>
        <div className="mb-5 flex items-baseline justify-between gap-3 border-b border-espresso/15 pb-4">
          <h3 className={`font-display text-2xl ${ACENTO[seccion.mundo]}`}>{seccion.nombre}</h3>
          {seccion.etiquetaTamanos && (
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-text-muted">
              {seccion.etiquetaTamanos}
            </span>
          )}
        </div>

        <ul className="space-y-3.5">
          {seccion.productos.map((producto) => (
            <li key={producto.slug} className="flex items-baseline gap-2">
              <span className="flex items-center gap-1.5 font-medium text-espresso">
                {producto.destacado && (
                  <LeafIcon size={14} className="text-mustard" aria-label="Destacado" />
                )}
                {producto.nombre}
                {producto.nota && (
                  <span className="text-xs font-normal italic text-text-muted">
                    ({producto.nota})
                  </span>
                )}
                {/* Agotado se marca aquí y no se oculta el producto: que no
                    esté hoy no significa que deje de existir en la carta. */}
                {!producto.disponible && (
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Agotado
                  </span>
                )}
              </span>
              <span className="mx-1 flex-1 border-b border-dotted border-espresso/25" />
              <span className="shrink-0 font-display text-lg text-espresso">
                ${precioDeCarta(producto.variantes)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Reveal>
  );
}

export default async function MenuPage() {
  const { categorias } = await obtenerCatalogo();
  const hoy = categorias.filter((c) => c.estado === "hoy");
  const pronto = categorias.filter((c) => c.estado === "pronto");

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
              className="btn-pill inline-flex items-center bg-terracota px-7 text-[0.75rem] font-bold uppercase tracking-[0.12em] text-surface transition-colors hover:bg-primary-hover"
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

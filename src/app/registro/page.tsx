import type { Metadata } from "next";
import Image from "next/image";
import { RegistroForm } from "@/components/auth/RegistroForm";
import { BRAND_ASSETS } from "@/lib/brand-assets.generated";
import { LeafIcon, GiftIcon, CalendarIcon, CupIcon } from "@/components/icons";

/**
 * /registro — composición del mockup 01.
 *
 * Desktop: título editorial y cuatro beneficios a la izquierda, card de
 * formulario a la derecha, banda de producto abajo.
 * Mobile: hero reducido, beneficios en grid 2×2, formulario en una columna.
 */
export const metadata: Metadata = {
  title: "Crea tu cuenta",
  description:
    "Únete a la comunidad SIEMBRA y disfruta de café de especialidad, matcha premium, eventos exclusivos y recompensas pensadas para ti.",
};

const BENEFICIOS = [
  { Icono: LeafIcon, titulo: "Gana puntos", detalle: "en cada compra" },
  { Icono: GiftIcon, titulo: "Ofertas exclusivas", detalle: "solo para miembros" },
  { Icono: CalendarIcon, titulo: "Eventos y talleres", detalle: "especiales" },
  { Icono: CupIcon, titulo: "Pedidos más rápidos", detalle: "y fáciles" },
];

export default function RegistroPage() {
  return (
    <>
      <section className="grain bg-leche pb-16 pt-28 sm:pt-32 lg:pb-24 lg:pt-40">
        <div className="mx-auto max-w-[var(--container-content)] px-5 sm:px-8">
          <div className="grid items-start gap-10 lg:grid-cols-12 lg:items-center lg:gap-14">
            {/* Editorial — mockup 01, columna izquierda */}
            <div className="lg:col-span-7">
              <h1 className="font-display text-4xl leading-[1.08] text-espresso sm:text-5xl lg:text-6xl">
                Crea tu cuenta
                <br className="hidden sm:block" /> y empieza a{" "}
                <em className="not-italic text-terracota">
                  <span className="font-display italic">sembrar bienestar.</span>
                </em>
              </h1>

              <p className="mt-5 max-w-lg leading-relaxed text-text-muted">
                Únete a nuestra comunidad y disfruta de café de especialidad, matcha
                premium, eventos exclusivos y recompensas pensadas para ti.
              </p>

              <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
                {BENEFICIOS.map(({ Icono, titulo, detalle }) => (
                  <li key={titulo}>
                    <Icono size={30} className="text-espresso" />
                    <p className="mt-3 text-sm font-semibold text-espresso">{titulo}</p>
                    <p className="text-sm text-text-muted">{detalle}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Formulario — mockup 01, columna derecha */}
            <div className="lg:col-span-5">
              <RegistroForm />
            </div>
          </div>
        </div>
      </section>

      {/* Banda de producto — mockup 01, bloque inferior */}
      <section aria-hidden className="relative h-[240px] overflow-hidden sm:h-[340px] lg:h-[420px]">
        <Image
          src={BRAND_ASSETS.siembraToteCupsMugNapkinsPromo.src}
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
        />
      </section>
    </>
  );
}

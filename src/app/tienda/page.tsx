"use client";

import Image from "next/image";
import { useLang } from "@/lib/i18n";
import { PageHero } from "@/components/PageHero";
import { Reveal } from "@/components/Reveal";
import { SITE } from "@/lib/site";

/* Productos de merchandising fotografiados en el branding oficial (sin e-commerce aún) */
const PRODUCTOS = [
  {
    img: "/brand/fotos/Siembra Bag Tote Cup Mockup.webp",
    nombre: { es: "Tote & Vaso", en: "Tote & Cup" },
    desc: { es: "Bolsa reutilizable y vaso de la casa", en: "Reusable tote and house cup" },
  },
  {
    img: "/brand/fotos/Siembra T-shirt and Matcha Mockup.webp",
    nombre: { es: "Camiseta Siembra", en: "Siembra T-shirt" },
    desc: { es: "Algodón orgánico con el isotipo solar", en: "Organic cotton with the solar mark" },
  },
  {
    img: "/brand/fotos/Siembra Tote Cups Mug Napkins Promo.webp",
    nombre: { es: "Colección para llevar", en: "To-go collection" },
    desc: { es: "Taza, vaso y servilletas de la marca", en: "Mug, cup and branded napkins" },
  },
  {
    img: "/brand/fotos/Siembra Bag Napkins Menu Promo.webp",
    nombre: { es: "Bolsa & Menú", en: "Bag & Menu" },
    desc: { es: "Empaque y detalles de la experiencia", en: "Packaging and experience details" },
  },
];

export default function TiendaPage() {
  const { lang, t } = useLang();

  return (
    <>
      <PageHero
        eyebrow={lang === "es" ? "Llévate Siembra" : "Take Siembra home"}
        title={lang === "es" ? "Tienda" : "Shop"}
        subtitle={
          lang === "es"
            ? "Nuestra mercancía oficial. Muy pronto podrás comprar en línea."
            : "Our official merchandise. Online shopping coming very soon."
        }
      />

      <section className="bg-leche pb-16">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="grid gap-6 sm:grid-cols-2">
            {PRODUCTOS.map((p, i) => (
              <Reveal key={i} delay={(i % 2) * 0.1}>
                <div className="group overflow-hidden rounded-3xl border border-espresso/10 bg-white/50">
                  <div className="relative overflow-hidden">
                    <Image
                      src={p.img}
                      alt={t(p.nombre)}
                      width={800}
                      height={800}
                      className="aspect-square w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="font-display text-2xl font-medium text-espresso">{t(p.nombre)}</h3>
                    <p className="mt-1.5 text-sm text-espresso/65">{t(p.desc)}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA: disponible en tienda / próximamente online ─── */}
      <section className="grain bg-terracota py-20 text-leche">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <Reveal>
            <h2 className="font-display text-3xl font-medium sm:text-4xl">
              {lang === "es" ? "Disponible en el café" : "Available at the café"}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-leche/85">
              {lang === "es"
                ? "Encuentra toda nuestra mercancía en 1024 Ashford Avenue, Condado. La tienda en línea llega con el Club Siembra."
                : "Find all our merchandise at 1024 Ashford Avenue, Condado. The online store arrives with Club Siembra."}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href={SITE.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-leche px-8 py-3.5 text-sm font-bold uppercase tracking-widest text-terracota transition-all hover:scale-[1.03]"
              >
                {lang === "es" ? "Cómo llegar" : "Get directions"}
              </a>
              <a
                href={SITE.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border-1.5 border-leche/60 px-8 py-3.5 text-sm font-bold uppercase tracking-widest text-leche transition-all hover:bg-leche/10"
              >
                {SITE.instagram}
              </a>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

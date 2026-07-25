"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLang } from "@/lib/i18n";
import { PageHero } from "@/components/PageHero";
import { Reveal } from "@/components/Reveal";
import { MENU, type MenuSection } from "@/lib/site";

/* Paleta de acento por "mundo" del menú */
const MUNDO_COLOR: Record<MenuSection["mundo"], string> = {
  matcha: "text-olive",
  cafe: "text-espresso",
  piel: "text-terracota",
  comida: "text-mustard",
};

const MUNDO_BG: Record<MenuSection["mundo"], string> = {
  matcha: "bg-teatree/25",
  cafe: "bg-leche",
  piel: "bg-terracota/8",
  comida: "bg-mustard/10",
};

export default function MenuPage() {
  const { lang, t } = useLang();
  const [tab, setTab] = useState<"hoy" | "pronto">("hoy");

  const sections = MENU.filter((s) => s.status === tab);

  return (
    <>
      <PageHero
        eyebrow={lang === "es" ? "Nuestra carta" : "Our menu"}
        title={lang === "es" ? "Menú" : "Menu"}
        subtitle={
          lang === "es"
            ? "Café, matcha, bebidas funcionales y comida honesta. Precios en USD."
            : "Coffee, matcha, functional drinks and honest food. Prices in USD."
        }
      />

      <section className="bg-leche pb-24">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          {/* Toggle Hoy / Próximamente */}
          <div className="mb-12 flex justify-center">
            <div className="inline-flex rounded-full border border-espresso/15 bg-white/60 p-1.5">
              {(["hoy", "pronto"] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`rounded-full px-6 py-2.5 text-sm font-bold uppercase tracking-widest transition-all ${
                    tab === key
                      ? "bg-terracota text-leche shadow-soft"
                      : "text-espresso/60 hover:text-espresso"
                  }`}
                >
                  {key === "hoy"
                    ? lang === "es" ? "Lo que puedes pedir hoy" : "Available today"
                    : lang === "es" ? "Próximamente" : "Coming soon"}
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
              className="grid gap-6 md:grid-cols-2"
            >
              {sections.map((section, i) => (
                <Reveal key={section.id} delay={i * 0.06}>
                  <div
                    id={section.id}
                    className={`h-full scroll-mt-28 rounded-3xl border border-espresso/10 p-7 ${MUNDO_BG[section.mundo]}`}
                  >
                    {/* Encabezado de sección */}
                    <div className="mb-5 flex items-baseline justify-between gap-3 border-b border-espresso/15 pb-4">
                      <h2 className={`font-display text-2xl font-medium ${MUNDO_COLOR[section.mundo]}`}>
                        {t(section.titulo)}
                      </h2>
                      {section.sizes && (
                        <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-espresso/50">
                          {section.sizes}
                        </span>
                      )}
                    </div>

                    {/* Items */}
                    <ul className="space-y-3.5">
                      {section.items.map((item, j) => (
                        <li key={j} className="flex items-baseline gap-2">
                          <span className="flex items-center gap-1.5 font-medium text-espresso">
                            {item.destacado && <span className="text-mustard">★</span>}
                            {item.nombre}
                            {item.nota && (
                              <span className="text-xs font-normal italic text-espresso/50">
                                ({lang === "es" ? item.nota.es : item.nota.en})
                              </span>
                            )}
                          </span>
                          <span className="mx-1 flex-1 border-b border-dotted border-espresso/25" />
                          <span className="shrink-0 font-display text-lg font-medium text-espresso">
                            {item.precio.includes("/")
                              ? `$${item.precio}`
                              : `$${item.precio}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              ))}
            </motion.div>
          </AnimatePresence>

          {/* Nota */}
          <Reveal className="mt-14 text-center">
            <p className="mx-auto max-w-lg text-sm leading-relaxed text-espresso/55">
              {lang === "es"
                ? "Los tamaños 12 oz / 16 oz aplican donde se indica. Los extras se añaden a cualquier bebida por $1.00. Menú sujeto a disponibilidad — es nuestra temporada de soft opening."
                : "12 oz / 16 oz sizes apply where indicated. Extras can be added to any drink for $1.00. Menu subject to availability — it's our soft opening season."}
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}

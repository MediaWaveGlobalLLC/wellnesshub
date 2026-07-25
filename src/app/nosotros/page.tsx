"use client";

import Image from "next/image";
import { useLang } from "@/lib/i18n";
import { PageHero } from "@/components/PageHero";
import { Reveal } from "@/components/Reveal";
import { SITE, VOZ_MARCA, ATRIBUTOS, METRICAS } from "@/lib/site";

export default function NosotrosPage() {
  const { lang, t } = useLang();

  return (
    <>
      <PageHero
        eyebrow={lang === "es" ? "Nuestra historia" : "Our story"}
        title={lang === "es" ? "Nosotros" : "About"}
        subtitle={
          lang === "es"
            ? "Siembra nace de la intención de cultivar bienestar y cosechar la mejor versión de cada persona."
            : "Siembra is born from the intention to cultivate wellbeing and harvest each person's best version."
        }
      />

      {/* ─── LA FUNDADORA ─── */}
      <section className="bg-leche pb-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2">
          <Reveal>
            <div className="relative mx-auto max-w-md">
              <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-teatree/30 blur-2xl" />
              <Image
                src="/brand/fotos/Dueña de Siembra.webp"
                alt={`${SITE.ceo}, fundadora de Siembra Cafe`}
                width={700}
                height={850}
                className="w-full rounded-[2rem] object-cover shadow-warm"
              />
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-terracota">
              {lang === "es" ? "La fundadora" : "The founder"}
            </p>
            <h2 className="mt-4 font-display text-4xl font-medium text-espresso">
              {SITE.ceo}
            </h2>
            <p className="mt-1 text-sm font-semibold uppercase tracking-widest text-olive">
              CEO · {SITE.legal}
            </p>

            <div className="mt-6 space-y-4 text-lg leading-relaxed text-espresso/80">
              <p>
                {lang === "es"
                  ? "Con más de 27 años de trayectoria en mercadeo, hospitalidad y turismo — incluyendo marcas como Marriott y Grupo Posadas — Erika ha dedicado su carrera a crear experiencias que conectan a las personas."
                  : "With over 27 years in marketing, hospitality and tourism — including brands like Marriott and Grupo Posadas — Erika has dedicated her career to creating experiences that connect people."}
              </p>
              <p>
                {lang === "es"
                  ? "Con Siembra, lleva esa visión a Condado: un espacio donde el café, el matcha y el bienestar se encuentran con la comunidad frente al mar de Escambrón."
                  : "With Siembra, she brings that vision to Condado: a space where coffee, matcha and wellbeing meet community by the sea of Escambrón."}
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── VOZ DE MARCA ─── */}
      <section className="grain bg-espresso py-24 text-leche">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-matcha">
              {lang === "es" ? "Cómo hablamos" : "How we speak"}
            </p>
            <p className="mt-8 font-display text-2xl font-light leading-relaxed text-leche sm:text-3xl sm:leading-relaxed">
              {t(VOZ_MARCA)}
            </p>
          </Reveal>
        </div>
      </section>

      {/* ─── ATRIBUTOS ─── */}
      <section className="bg-leche py-24">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <Reveal className="mb-12 text-center">
            <h2 className="font-display text-3xl font-medium text-espresso sm:text-4xl">
              {lang === "es" ? "Lo que nos define" : "What defines us"}
            </h2>
          </Reveal>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {ATRIBUTOS.map((a, i) => (
              <Reveal key={i} delay={i * 0.06} y={12}>
                <span className="pill border-2 px-6 py-3 text-sm text-olive">{t(a)}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── THE WELLNESS HUB ─── */}
      <section className="bg-forest py-24 text-leche">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <Reveal>
            <span className="pill mx-auto text-matcha">{SITE.wellnessHub}</span>
            <h2 className="mt-6 font-display text-3xl font-medium sm:text-4xl">
              {lang === "es" ? "Un hub de bienestar en Escambrón" : "A wellness hub in Escambrón"}
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-leche/75">
              {lang === "es"
                ? "Siembra es el corazón gastronómico de The Wellness Hub — una visión para transformar la playa de Escambrón en un destino de bienestar, deporte y comunidad para locales y visitantes."
                : "Siembra is the culinary heart of The Wellness Hub — a vision to transform Escambrón beach into a destination for wellness, sport and community for locals and visitors alike."}
            </p>
          </Reveal>

          {/* Métricas */}
          <div className="mt-16 grid grid-cols-1 gap-10 sm:grid-cols-3">
            {METRICAS.map((m, i) => (
              <Reveal key={i} delay={i * 0.1}>
                <p className="font-display text-5xl font-medium">
                  {m.valor}
                  <span className="text-avena">{m.sufijo}</span>
                </p>
                <p className="mt-2 text-sm font-semibold uppercase tracking-widest text-leche/70">
                  {t(m)}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

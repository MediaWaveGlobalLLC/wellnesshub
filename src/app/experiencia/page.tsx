"use client";

import { useLang } from "@/lib/i18n";
import { PageHero } from "@/components/PageHero";
import { Reveal } from "@/components/Reveal";
import {
  EXPERIENCIA_DIA,
  WELLNESS_PROGRAM,
  SPORTS_PROGRAM,
  CALENDARIO,
  AMBIENTAL,
  FRASES,
} from "@/lib/site";

export default function ExperienciaPage() {
  const { lang, t } = useLang();

  return (
    <>
      <PageHero
        eyebrow={lang === "es" ? "Más que un café" : "More than a café"}
        title={lang === "es" ? "La Experiencia" : "The Experience"}
        subtitle={
          lang === "es"
            ? "Un Wellness Hub frente al mar en Escambrón. Bienestar, deporte y comunidad todos los días."
            : "A seaside Wellness Hub in Escambrón. Wellness, sport and community every day."
        }
      />

      {/* ─── UN DÍA EN SIEMBRA (timeline) ─── */}
      <section className="bg-leche pb-24">
        <div className="mx-auto max-w-4xl px-5 sm:px-8">
          <Reveal className="mb-12 text-center">
            <h2 className="font-display text-3xl font-medium text-espresso sm:text-4xl">
              {lang === "es" ? "Un día con nosotros" : "A day with us"}
            </h2>
          </Reveal>

          <div className="relative">
            {/* línea vertical */}
            <div className="absolute left-[7.5rem] top-2 hidden h-full w-px bg-terracota/25 sm:block" />

            <div className="space-y-6">
              {EXPERIENCIA_DIA.map((e, i) => (
                <Reveal key={i} delay={i * 0.08}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-8">
                    <div className="w-24 shrink-0 text-right">
                      <span className="font-display text-2xl font-medium text-terracota">{e.hora}</span>
                    </div>
                    <div className="relative hidden sm:block">
                      <span className="block h-3 w-3 dot-circle border-2 border-terracota bg-leche" />
                    </div>
                    <div className="flex-1 rounded-2xl border border-espresso/10 bg-white/60 p-5 transition-all hover:border-terracota/40 hover:shadow-soft">
                      <h3 className="font-display text-xl font-medium text-espresso">{t(e)}</h3>
                      <p className="mt-1 text-sm text-espresso/65">
                        {lang === "es" ? e.descEs : e.descEn}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── PROGRAMAS ─── */}
      <section className="bg-forest py-24 text-leche">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <Reveal className="mb-14 text-center">
            <h2 className="font-display text-3xl font-medium sm:text-4xl">
              {lang === "es" ? "Programas" : "Programs"}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-leche/70">
              {lang === "es"
                ? "Actividades para el cuerpo y la mente, abiertas a toda la comunidad."
                : "Activities for body and mind, open to the whole community."}
            </p>
          </Reveal>

          <div className="grid gap-8 md:grid-cols-2">
            {/* Wellness */}
            <Reveal>
              <div className="rounded-lg border border-leche/15 bg-leche/5 p-8">
                <h3 className="font-display text-2xl font-medium text-teatree">
                  {lang === "es" ? "Wellness Program" : "Wellness Program"}
                </h3>
                <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {WELLNESS_PROGRAM.map((w, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm text-leche/85">
                      <span className="text-matcha">✦</span> {t(w)}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            {/* Sports */}
            <Reveal delay={0.12}>
              <div className="rounded-lg border border-leche/15 bg-leche/5 p-8">
                <h3 className="font-display text-2xl font-medium text-mustard">
                  {lang === "es" ? "Sports Program" : "Sports Program"}
                </h3>
                <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {SPORTS_PROGRAM.map((s, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm text-leche/85">
                      <span className="text-mustard">✦</span> {t(s)}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── CALENDARIO ANUAL ─── */}
      <section className="bg-leche py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal className="mb-14 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-terracota">
              {lang === "es" ? "Todo el año" : "All year round"}
            </p>
            <h2 className="mt-4 font-display text-3xl font-medium text-espresso sm:text-4xl">
              {lang === "es" ? "Calendario de eventos" : "Events calendar"}
            </h2>
          </Reveal>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {CALENDARIO.map((c, i) => (
              <Reveal key={i} delay={(i % 4) * 0.06}>
                <div className="h-full rounded-2xl border border-espresso/10 bg-white/60 p-5 transition-all hover:border-terracota/40 hover:shadow-soft">
                  <p className="text-xs font-bold uppercase tracking-widest text-olive">
                    {t(c.mes)}
                  </p>
                  <p className="mt-2 font-display text-lg font-medium leading-snug text-espresso">
                    {t(c.evento)}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── COMPROMISO AMBIENTAL ─── */}
      <section className="bg-teatree/40 py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-olive">
              {lang === "es" ? "Cuidamos Escambrón" : "We care for Escambrón"}
            </p>
            <h2 className="mt-4 font-display text-3xl font-medium text-espresso sm:text-4xl">
              {lang === "es" ? "Compromiso ambiental" : "Environmental commitment"}
            </h2>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-espresso/75">
              {lang === "es"
                ? "El bienestar también es del planeta que nos rodea. Trabajamos por una playa y una comunidad más limpias."
                : "Wellness also belongs to the planet around us. We work toward a cleaner beach and community."}
            </p>
          </Reveal>
          <Reveal delay={0.12}>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {AMBIENTAL.map((a, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 rounded-xl border border-olive/20 bg-white/60 px-4 py-3.5 text-sm font-medium text-espresso"
                >
                  <span className="text-olive">🌿</span> {t(a)}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ─── FRASE DE CIERRE ─── */}
      <section className="bg-leche py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <Reveal>
            <p className="font-display text-3xl font-light italic leading-snug text-espresso sm:text-4xl">
              “{t(FRASES.comunidad)}”
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useLang } from "@/lib/i18n";
import { Reveal } from "@/components/Reveal";
import { SunBean } from "@/components/SunBean";
import {
  SITE,
  MANIFIESTO,
  ATRIBUTOS,
  FRASES,
  METRICAS,
  CLUB_BENEFICIOS,
  CLUB_OFERTA,
  EXPERIENCIA_DIA,
} from "@/lib/site";

export default function Home() {
  const { lang, t } = useLang();

  return (
    <>
      {/* ─────────── HERO ─────────── */}
      <section className="grain relative flex min-h-screen items-center justify-center overflow-hidden bg-forest text-leche">
        {/* halo cálido de fondo */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/3 h-[70vh] w-[70vh] -translate-x-1/2 rounded-full bg-terracota/25 blur-[120px]" />
          <div className="absolute bottom-0 left-1/4 h-[40vh] w-[40vh] rounded-full bg-mustard/20 blur-[100px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl px-6 pt-24 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="mb-8 flex justify-center text-avena"
          >
            <SunBean size={130} color="currentColor" />
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.7 }}
            className="mb-5 text-xs font-bold uppercase tracking-[0.4em] text-matcha"
          >
            {SITE.tagline.es}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.8 }}
            className="font-display text-6xl font-medium leading-[0.95] tracking-tight sm:text-8xl"
          >
            Siembra
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.7 }}
            className="mx-auto mt-6 max-w-xl font-serif text-xl italic text-avena sm:text-2xl"
          >
            {t(MANIFIESTO.corto)}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85, duration: 0.7 }}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Link
              href="/menu"
              className="w-full rounded-full bg-terracota px-8 py-3.5 text-sm font-bold uppercase tracking-widest text-leche shadow-warm transition-all hover:scale-[1.03] hover:bg-mustard sm:w-auto"
            >
              {lang === "es" ? "Ver el Menú" : "View the Menu"}
            </Link>
            <Link
              href="/visitanos"
              className="w-full rounded-full border-1.5 border-leche/50 px-8 py-3.5 text-sm font-bold uppercase tracking-widest text-leche transition-all hover:border-leche hover:bg-leche/10 sm:w-auto"
            >
              {lang === "es" ? "Visítanos" : "Visit us"}
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.7 }}
            className="mt-8 text-xs tracking-widest text-leche/50"
          >
            {SITE.address.split(",")[0]} · {SITE.hours}
          </motion.p>
        </div>

        {/* indicador scroll */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 8, 0] }}
          transition={{ opacity: { delay: 1.3 }, y: { repeat: Infinity, duration: 1.8 } }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-leche/50"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 5v14M6 13l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
      </section>

      {/* ─────────── ATRIBUTOS (píldoras) ─────────── */}
      <section className="border-b border-espresso/10 bg-leche py-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-3 px-6">
          {ATRIBUTOS.map((a, i) => (
            <Reveal key={i} delay={i * 0.06} y={12}>
              <span className="pill text-olive">{t(a)}</span>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─────────── MANIFIESTO ─────────── */}
      <section className="bg-leche py-24 sm:py-32">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <Reveal>
            <span className="rule-line text-terracota" />
            <p className="mt-8 font-display text-3xl font-light leading-snug text-espresso sm:text-4xl md:text-[2.75rem] md:leading-[1.25]">
              {t(MANIFIESTO.completo)}
            </p>
            <span className="rule-line mt-8 text-terracota" />
          </Reveal>
        </div>
      </section>

      {/* ─────────── DOS MUNDOS: CAFÉ + MATCHA ─────────── */}
      <section className="bg-espresso py-24 text-leche sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <Reveal className="mb-14 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-matcha">
              {lang === "es" ? "Dos mundos, una misma intención" : "Two worlds, one intention"}
            </p>
            <h2 className="mt-4 font-display text-4xl font-medium sm:text-5xl">
              {lang === "es" ? "Café & Matcha" : "Coffee & Matcha"}
            </h2>
          </Reveal>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Café */}
            <Reveal>
              <div className="group relative overflow-hidden rounded-3xl">
                <Image
                  src="/brand/fotos/Siembra Iced Coffee Promo.webp"
                  alt="Café de Siembra"
                  width={800}
                  height={1000}
                  className="h-[440px] w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-espresso via-espresso/30 to-transparent" />
                <div className="absolute bottom-0 p-8">
                  <h3 className="font-display text-3xl font-medium">{lang === "es" ? "Café" : "Coffee"}</h3>
                  <p className="mt-2 max-w-xs font-serif text-lg italic text-avena">
                    {t(FRASES.cafe)}
                  </p>
                  <Link href="/menu#cafes" className="mt-4 inline-block text-xs font-bold uppercase tracking-widest text-matcha transition-colors hover:text-avena">
                    {lang === "es" ? "Ver cafés →" : "View coffees →"}
                  </Link>
                </div>
              </div>
            </Reveal>

            {/* Matcha */}
            <Reveal delay={0.12}>
              <div className="group relative overflow-hidden rounded-3xl">
                <Image
                  src="/brand/fotos/Siembra Matcha Latte Promo.webp"
                  alt="Matcha de Siembra"
                  width={800}
                  height={1000}
                  className="h-[440px] w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-forest via-forest/30 to-transparent" />
                <div className="absolute bottom-0 p-8">
                  <h3 className="font-display text-3xl font-medium">{lang === "es" ? "Matcha" : "Matcha"}</h3>
                  <p className="mt-2 max-w-xs font-serif text-lg italic text-teatree">
                    {t(FRASES.matcha)}
                  </p>
                  <Link href="/menu#matcha" className="mt-4 inline-block text-xs font-bold uppercase tracking-widest text-teatree transition-colors hover:text-avena">
                    {lang === "es" ? "Ver matcha →" : "View matcha →"}
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─────────── BEBIDAS PARA TU PIEL ─────────── */}
      <section className="relative overflow-hidden bg-teatree/40 py-24 sm:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-olive">
              {lang === "es" ? "Bienestar que se bebe" : "Wellness you can drink"}
            </p>
            <h2 className="mt-4 font-display text-4xl font-medium text-espresso sm:text-5xl">
              {lang === "es" ? "Bebidas para tu piel" : "Drinks for your skin"}
            </h2>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-espresso/80">
              {lang === "es"
                ? "Mezclas funcionales con colágeno, antioxidantes y superfoods. Glow Rose, Tropical Sun y Blue Calm — belleza y recuperación en cada sorbo."
                : "Functional blends with collagen, antioxidants and superfoods. Glow Rose, Tropical Sun and Blue Calm — beauty and recovery in every sip."}
            </p>
            <Link
              href="/menu#piel"
              className="mt-8 inline-block rounded-full bg-olive px-7 py-3 text-sm font-bold uppercase tracking-widest text-leche transition-all hover:scale-[1.03] hover:bg-forest"
            >
              {lang === "es" ? "Descubrir las mezclas" : "Discover the blends"}
            </Link>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="relative">
              <Image
                src="/brand/elementos/Siembra Iced Matcha Splash.webp"
                alt="Bebida refrescante de Siembra"
                width={700}
                height={700}
                className="mx-auto w-full max-w-md drop-shadow-2xl"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─────────── LA EXPERIENCIA (teaser) ─────────── */}
      <section className="bg-leche py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <Reveal className="mb-14 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-terracota">
              {lang === "es" ? "Más que un café" : "More than a café"}
            </p>
            <h2 className="mt-4 font-display text-4xl font-medium text-espresso sm:text-5xl">
              {lang === "es" ? "Un día en Siembra" : "A day at Siembra"}
            </h2>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {EXPERIENCIA_DIA.map((e, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div className="h-full rounded-2xl border border-espresso/10 bg-white/60 p-6 transition-all hover:border-terracota/40 hover:shadow-soft">
                  <p className="font-display text-2xl font-medium text-terracota">{e.hora}</p>
                  <h3 className="mt-2 font-semibold text-espresso">{t(e)}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-espresso/65">
                    {lang === "es" ? e.descEs : e.descEn}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-12 text-center">
            <Link
              href="/experiencia"
              className="inline-block rounded-full border-1.5 border-espresso/30 px-7 py-3 text-sm font-bold uppercase tracking-widest text-espresso transition-all hover:border-espresso hover:bg-espresso hover:text-leche"
            >
              {lang === "es" ? "Ver la experiencia completa" : "See the full experience"}
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ─────────── MÉTRICAS ─────────── */}
      <section className="bg-terracota py-16 text-leche">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-10 px-6 text-center sm:grid-cols-3">
          {METRICAS.map((m, i) => (
            <Reveal key={i} delay={i * 0.1}>
              <p className="font-display text-5xl font-medium sm:text-6xl">
                {m.valor}
                <span className="text-avena">{m.sufijo}</span>
              </p>
              <p className="mt-2 text-sm font-semibold uppercase tracking-widest text-leche/80">
                {t(m)}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─────────── CLUB SIEMBRA (teaser Parte 2) ─────────── */}
      <section id="club" className="grain bg-forest py-24 text-leche sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <Reveal className="mb-6 text-center">
            <span className="pill mx-auto text-matcha">
              {lang === "es" ? "Próximamente" : "Coming soon"}
            </span>
            <h2 className="mt-6 font-display text-4xl font-medium sm:text-5xl">Club Siembra</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-leche/75">
              {lang === "es"
                ? "La comunidad de bienestar de Siembra, ahora digital. Gana puntos, canjea recompensas y vive experiencias exclusivas."
                : "Siembra's wellness community, now digital. Earn points, redeem rewards and live exclusive experiences."}
            </p>
            <p className="mt-4 inline-block rounded-full bg-avena px-5 py-2 text-sm font-bold text-forest">
              ♥ {t(CLUB_OFERTA)}
            </p>
          </Reveal>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CLUB_BENEFICIOS.map((b, i) => (
              <Reveal key={i} delay={i * 0.07}>
                <div className="h-full rounded-2xl border border-leche/15 bg-leche/5 p-7 transition-all hover:border-matcha/50 hover:bg-leche/10">
                  <h3 className="font-display text-xl font-medium text-avena">{t(b.titulo)}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-leche/70">{t(b.desc)}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-12 text-center">
            <p className="text-sm text-leche/60">
              {lang === "es"
                ? "Regístrate cuando lancemos para ser de los primeros."
                : "Sign up at launch to be among the first."}
            </p>
          </Reveal>
        </div>
      </section>

      {/* ─────────── COMUNIDAD (frase) ─────────── */}
      <section className="bg-leche py-24 sm:py-32">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <Reveal>
            <p className="font-display text-3xl font-light italic leading-snug text-espresso sm:text-4xl">
              “{t(FRASES.comunidad)}”
            </p>
            <p className="mt-8 text-xs font-bold uppercase tracking-[0.3em] text-olive">
              — {SITE.legal}
            </p>
          </Reveal>
        </div>
      </section>

      {/* ─────────── VISÍTANOS CTA ─────────── */}
      <section className="relative overflow-hidden bg-espresso py-24 text-leche sm:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2">
          <Reveal>
            <h2 className="font-display text-4xl font-medium sm:text-5xl">
              {lang === "es" ? "Te esperamos en Condado" : "We're waiting for you in Condado"}
            </h2>
            <div className="mt-8 space-y-4 text-lg text-leche/85">
              <p className="flex items-start gap-3">
                <span className="text-matcha">📍</span>
                <a href={SITE.mapsUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
                  {SITE.address}
                </a>
              </p>
              <p className="flex items-start gap-3">
                <span className="text-matcha">🕙</span> {SITE.hours}
              </p>
              <p className="flex items-start gap-3">
                <span className="text-matcha">📱</span>
                <a href={`tel:${SITE.phone.replace(/[^\d]/g, "")}`} className="underline-offset-4 hover:underline">
                  {SITE.phone}
                </a>
              </p>
              <p className="flex items-start gap-3">
                <span className="text-matcha">◎</span>
                <a href={SITE.instagramUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
                  {SITE.instagram}
                </a>
              </p>
            </div>
            <Link
              href="/visitanos"
              className="mt-10 inline-block rounded-full bg-terracota px-8 py-3.5 text-sm font-bold uppercase tracking-widest text-leche shadow-warm transition-all hover:scale-[1.03] hover:bg-mustard"
            >
              {lang === "es" ? "Cómo llegar" : "Get directions"}
            </Link>
          </Reveal>
          <Reveal delay={0.15}>
            <Image
              src="/brand/fotos/Siembra Coffee & Matcha.webp"
              alt="Siembra Cafe & Matcha Bar en Condado"
              width={800}
              height={800}
              className="w-full rounded-3xl object-cover shadow-warm"
            />
          </Reveal>
        </div>
      </section>
    </>
  );
}

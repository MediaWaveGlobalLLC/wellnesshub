"use client";

import Link from "next/link";
import Image from "next/image";

import { useLang } from "@/lib/i18n";
import { Reveal } from "@/components/Reveal";
import { SunBean } from "@/components/SunBean";
import { Marquee } from "@/components/Marquee";
import { CountUp } from "@/components/CountUp";
import { TiltCard } from "@/components/TiltCard";
import { Steam } from "@/components/Steam";
import { RotatingBadge } from "@/components/RotatingBadge";
import { SectionHead } from "@/components/SectionHead";
import {
  SITE,
  MANIFIESTO,
  ATRIBUTOS,
  FRASES,
  METRICAS,
  CLUB_BENEFICIOS,
  CLUB_OFERTA,
  EXPERIENCIA_DIA,
  MENU,
} from "@/lib/site";

export default function Home() {
  const { lang, t } = useLang();

  // Parallax del sol del hero




  const piel = MENU.find((s) => s.id === "piel");

  return (
    <>
      {/* ═══════════ HERO — AMANECER EN SIEMBRA ═══════════ */}
      {/* Bloque Forest plano. Los orbes difuminados de terracota y mustard se
          eliminaron: docs/01 prohíbe el glow y los gradientes SaaS. */}
      <section className="grain relative flex min-h-screen flex-col justify-between overflow-hidden bg-forest text-leche">
        {/* contenido principal */}
        <div className="relative z-10 mx-auto grid w-full max-w-7xl flex-1 items-center gap-10 px-5 pb-16 pt-32 sm:px-8 lg:grid-cols-12 lg:gap-6">
          {/* texto — izquierda */}
          <div className="lg:col-span-7">
            <p              className="entrada entrada-1 mb-6 flex items-center gap-3 text-[0.7rem] font-bold uppercase tracking-[0.4em] text-matcha"
            >
              <span className="h-px w-12 bg-matcha" />
              {SITE.tagline.es}
            </p>

            <h1              className="entrada entrada-2 font-display text-[clamp(4.5rem,13vw,10.5rem)] font-medium leading-[0.9] tracking-tight"
            >
              Siembra
            </h1>

            <p              className="entrada entrada-3 mt-6 max-w-lg font-serif text-2xl italic leading-snug text-avena sm:text-3xl"
            >
              {t(MANIFIESTO.corto)}
            </p>

            <div              className="entrada entrada-4 mt-10 flex flex-wrap items-center gap-6"
            >
              <Link
                href="/menu"
                className="group inline-flex items-center gap-3 btn-pill bg-terracota px-8 py-4 text-sm font-bold uppercase tracking-widest text-leche shadow-warm transition-all hover:scale-[1.04] hover:bg-mustard"
              >
                {lang === "es" ? "Ver el menú" : "View the menu"}
                <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </Link>
              <Link
                href="/visitanos"
                className="group inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-leche/80 transition-colors hover:text-avena"
              >
                <span className="border-b border-leche/40 pb-1 transition-colors group-hover:border-avena">
                  {lang === "es" ? "Visítanos" : "Visit us"}
                </span>
              </Link>
            </div>
          </div>

          {/* sol naciente — derecha */}
          <div className="relative hidden items-end justify-center lg:col-span-5 lg:flex">
            <div className="entrada entrada-3 relative text-avena">
              <SunBean size={300} color="currentColor" />
              {/* vapor subiendo del grano */}
              <div className="absolute left-1/2 -top-14 -translate-x-1/2 text-leche/70">
                <Steam className="h-16 w-11" />
              </div>
              {/* sello giratorio */}
              <div className="absolute -right-20 -top-12 text-matcha">
                <RotatingBadge
                  text={lang === "es" ? "· Café de especialidad · Matcha ceremonial " : "· Specialty coffee · Ceremonial matcha "}
                  size={140}
                  color="currentColor"
                />
              </div>
            </div>
          </div>
        </div>

        {/* barra inferior de datos */}
        <div className="entrada entrada-4 relative z-10 border-t border-leche/15">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 text-xs tracking-widest text-leche/60 sm:px-8">
            <span className="uppercase">{SITE.address.split(",")[0]}</span>
            <span className="hidden items-center gap-2 sm:flex">
              <span className="inline-block h-1.5 w-1.5 dot-circle bg-matcha" />
              {SITE.hours}
            </span>
            <span className="flex items-center gap-2 uppercase">
              {lang === "es" ? "Desliza para descubrir" : "Scroll to discover"}
              <span className="flecha-scroll text-avena">↓</span>
            </span>
          </div>
        </div>
      </section>

      {/* ═══════════ CINTA DE ATRIBUTOS (MARQUEE) ═══════════ */}
      <section className="border-y border-espresso/10 bg-terracota py-4 text-leche">
        <Marquee>
          {ATRIBUTOS.map((a, i) => (
            <span key={i} className="mx-6 flex items-center gap-6 text-sm font-bold uppercase tracking-[0.3em]">
              {t(a)}
              <span className="text-avena">✦</span>
            </span>
          ))}
        </Marquee>
      </section>

      {/* ═══════════ MANIFIESTO ═══════════ */}
      <section className="grain relative overflow-hidden bg-leche py-28 sm:py-36">
        <span
          aria-hidden
          className="text-outline pointer-events-none absolute -right-6 top-8 select-none font-display text-[10rem] font-bold leading-none opacity-[0.06] sm:text-[16rem]"
        >
          SIEMBRA
        </span>
        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-12">
          <Reveal className="lg:col-span-4">
            <div className="flex items-center gap-4">
              <span className="h-px w-10 bg-terracota" />
              <p className="text-xs font-bold uppercase tracking-[0.32em] text-terracota">
                {lang === "es" ? "Nuestro manifiesto" : "Our manifesto"}
              </p>
            </div>
            <div className="mt-8 hidden text-avena lg:block">
              <SunBean size={90} color="#d08f29" />
            </div>
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-8">
            <p className="font-display text-3xl font-light leading-[1.3] text-espresso sm:text-4xl md:text-[2.9rem] md:leading-[1.25]">
              <span className="float-left mr-3 mt-1 font-display text-7xl font-bold leading-[0.8] text-terracota sm:text-8xl">
                “
              </span>
              {t(MANIFIESTO.completo)}
              <span className="text-terracota">”</span>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ DOS MUNDOS: CAFÉ + MATCHA (asimétrico) ═══════════ */}
      <section className="grain bg-espresso py-28 text-leche">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionHead
            dark
            ghost="CAFÉ"
            eyebrow={lang === "es" ? "Dos mundos, una misma intención" : "Two worlds, one intention"}
            title={
              <>
                {lang === "es" ? "Café que eleva," : "Coffee that elevates,"}{" "}
                <em className="font-light italic text-teatree">
                  {lang === "es" ? "matcha que calma." : "matcha that calms."}
                </em>
              </>
            }
          />

          <div className="grid gap-6 lg:grid-cols-12">
            {/* Café — grande */}
            <Reveal className="lg:col-span-7">
              <Link href="/menu#cafes" className="group relative block overflow-hidden rounded-[2rem]">
                <Image
                  src="/brand/fotos/siembra-iced-coffee-promo.webp"
                  alt="Café de Siembra"
                  width={900}
                  height={1100}
                  className="h-[480px] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 sm:h-[560px]"
                />
                {/* Velo plano para legibilidad. Sin gradiente: docs/01. */}
                <div className="absolute inset-0 bg-espresso/45" />
                {/* vapor sobre la taza */}
                <div className="absolute left-10 top-8 text-leche/80">
                  <Steam className="h-14 w-10" />
                </div>
                <div className="absolute bottom-0 w-full p-8 sm:p-10">
                  <p className="text-xs font-bold uppercase tracking-[0.3em] text-avena">
                    {lang === "es" ? "Barra de café" : "Coffee bar"}
                  </p>
                  <h3 className="mt-2 font-display text-4xl font-medium sm:text-5xl">
                    {lang === "es" ? "Café" : "Coffee"}
                  </h3>
                  <p className="mt-3 max-w-sm font-serif text-lg italic text-avena">{t(FRASES.cafe)}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-matcha transition-all group-hover:gap-4 group-hover:text-avena">
                    {lang === "es" ? "Ver cafés" : "View coffees"} →
                  </span>
                </div>
              </Link>
            </Reveal>

            {/* Matcha — offset vertical */}
            <Reveal delay={0.15} className="lg:col-span-5 lg:mt-20">
              <Link href="/menu#matcha" className="group relative block overflow-hidden rounded-[2rem]">
                <Image
                  src="/brand/fotos/siembra-matcha-latte-promo.webp"
                  alt="Matcha de Siembra"
                  width={800}
                  height={1000}
                  className="h-[420px] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 sm:h-[480px]"
                />
                {/* Velo plano para legibilidad. Sin gradiente: docs/01. */}
                <div className="absolute inset-0 bg-forest/45" />
                <div className="absolute bottom-0 w-full p-8 sm:p-10">
                  <p className="text-xs font-bold uppercase tracking-[0.3em] text-teatree">
                    {lang === "es" ? "Barra de matcha" : "Matcha bar"}
                  </p>
                  <h3 className="mt-2 font-display text-4xl font-medium sm:text-5xl">Matcha</h3>
                  <p className="mt-3 max-w-xs font-serif text-lg italic text-teatree">{t(FRASES.matcha)}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-teatree transition-all group-hover:gap-4 group-hover:text-avena">
                    {lang === "es" ? "Ver matcha" : "View matcha"} →
                  </span>
                </div>
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════ BEBIDAS PARA TU PIEL (lista editorial) ═══════════ */}
      <section className="grain relative overflow-hidden bg-teatree/40 py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-2">
          <div>
            <SectionHead
              ghost="GLOW"
              eyebrow={lang === "es" ? "Bienestar que se bebe" : "Wellness you can drink"}
              title={
                <>
                  {lang === "es" ? "Bebidas para" : "Drinks for"}{" "}
                  <em className="font-light italic text-olive">{lang === "es" ? "tu piel." : "your skin."}</em>
                </>
              }
            >
              <p className="max-w-md text-lg leading-relaxed text-espresso/80">
                {lang === "es"
                  ? "Mezclas funcionales con colágeno, antioxidantes y superfoods. Belleza y recuperación en cada sorbo."
                  : "Functional blends with collagen, antioxidants and superfoods. Beauty and recovery in every sip."}
              </p>
            </SectionHead>

            {/* las tres mezclas como filas editoriales */}
            <div className="divide-y divide-espresso/15 border-y border-espresso/15">
              {piel?.items.map((item, i) => (
                <Reveal key={i} delay={i * 0.08}>
                  <div className="group flex items-baseline justify-between gap-4 py-5 transition-colors hover:bg-leche/60">
                    <div>
                      <h3 className="font-display text-2xl font-medium text-espresso transition-transform duration-300 group-hover:translate-x-2 sm:text-3xl">
                        {item.nombre}
                      </h3>
                      {item.nota && (
                        <p className="mt-1 text-sm italic text-olive">{t(item.nota)}</p>
                      )}
                    </div>
                    <p className="font-display text-2xl font-medium text-terracota">
                      ${item.precio}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={0.2} className="mt-8">
              <Link
                href="/menu#piel"
                className="group inline-flex items-center gap-3 btn-pill bg-olive px-7 py-3.5 text-sm font-bold uppercase tracking-widest text-leche transition-all hover:scale-[1.03] hover:bg-forest"
              >
                {lang === "es" ? "Descubrir las mezclas" : "Discover the blends"}
                <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </Link>
            </Reveal>
          </div>

          {/* imagen flotante */}
          <Reveal delay={0.15}>
            <div className="relative">
              <Image
                src="/brand/optimized/iced-matcha-splash.webp"
                alt="Bebida refrescante de Siembra"
                width={700}
                height={700}
                className="relative mx-auto w-full max-w-md drop-shadow-2xl"
              />
              <div className="absolute -right-2 top-6 hidden text-olive sm:block">
                <RotatingBadge
                  text={lang === "es" ? "· Colágeno · Antioxidantes · Superfoods " : "· Collagen · Antioxidants · Superfoods "}
                  size={120}
                  color="currentColor"
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ UN DÍA EN SIEMBRA (timeline) ═══════════ */}
      <section className="grain bg-leche py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionHead
            ghost="6AM"
            eyebrow={lang === "es" ? "Más que un café" : "More than a café"}
            title={
              <>
                {lang === "es" ? "Un día" : "A day"}{" "}
                <em className="font-light italic text-terracota">{lang === "es" ? "en Siembra." : "at Siembra."}</em>
              </>
            }
          />

          <div className="relative ml-2 border-l-2 border-espresso/15 pl-8 sm:ml-6 sm:pl-12">
            {EXPERIENCIA_DIA.map((e, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div className="group relative pb-12 last:pb-0">
                  {/* punto en la línea */}
                  <span className="absolute -left-[41px] top-1.5 flex h-5 w-5 items-center justify-center dot-circle border-2 border-terracota bg-leche transition-all duration-300 group-hover:scale-125 group-hover:bg-terracota sm:-left-[57px]">
                    <span className="h-1.5 w-1.5 dot-circle bg-terracota transition-colors group-hover:bg-leche" />
                  </span>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-8">
                    <p className="w-24 shrink-0 font-display text-2xl font-medium text-terracota sm:text-3xl">
                      {e.hora}
                    </p>
                    <div>
                      <h3 className="font-display text-2xl font-medium text-espresso sm:text-3xl">{t(e)}</h3>
                      <p className="mt-1.5 max-w-md leading-relaxed text-espresso/65">
                        {lang === "es" ? e.descEs : e.descEn}
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-12">
            <Link
              href="/experiencia"
              className="group inline-flex items-center gap-3 btn-pill border-2 border-espresso/25 px-7 py-3.5 text-sm font-bold uppercase tracking-widest text-espresso transition-all hover:border-espresso hover:bg-espresso hover:text-leche"
            >
              {lang === "es" ? "Ver la experiencia completa" : "See the full experience"}
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ MÉTRICAS (contadores animados) ═══════════ */}
      <section className="grain bg-terracota py-20 text-leche">
        <div className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-leche/20 px-6 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {METRICAS.map((m, i) => (
            <Reveal key={i} delay={i * 0.1} className="px-4 py-8 text-center sm:py-2">
              <p className="font-display text-6xl font-medium sm:text-7xl">
                <CountUp value={m.valor} suffix={m.sufijo} className="[&_span]:text-avena" />
              </p>
              <p className="mt-3 text-sm font-semibold uppercase tracking-[0.25em] text-leche/85">{t(m)}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══════════ CLUB SIEMBRA (tarjeta 3D) ═══════════ */}
      <section id="club" className="grain relative overflow-hidden bg-forest py-28 text-leche">
        <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-5 sm:px-8 lg:grid-cols-2">
          {/* texto + beneficios */}
          <div>
            <SectionHead
              dark
              ghost="CLUB"
              eyebrow={lang === "es" ? "Próximamente" : "Coming soon"}
              title={
                <>
                  Club <em className="font-light italic text-matcha">Siembra.</em>
                </>
              }
            >
              <p className="max-w-md text-lg leading-relaxed text-leche/75">
                {lang === "es"
                  ? "La comunidad de bienestar de Siembra, ahora digital. Gana puntos, canjea recompensas y vive experiencias exclusivas."
                  : "Siembra's wellness community, now digital. Earn points, redeem rewards and live exclusive experiences."}
              </p>
            </SectionHead>

            <ul className="space-y-4">
              {CLUB_BENEFICIOS.map((b, i) => (
                <Reveal key={i} delay={i * 0.06}>
                  <li className="group flex items-start gap-4">
                    <span className="mt-1 text-matcha transition-transform duration-300 group-hover:rotate-90">✦</span>
                    <div>
                      <h3 className="font-display text-xl font-medium text-avena">{t(b.titulo)}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-leche/65">{t(b.desc)}</p>
                    </div>
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>

          {/* tarjeta de membresía 3D */}
          <Reveal delay={0.15}>
            <TiltCard className="mx-auto w-full max-w-md">
              <div className="grain relative overflow-hidden rounded-lg bg-avena p-8 text-espresso shadow-warm">
                {/* marca de agua sol */}
                <div className="absolute -right-10 -top-10 opacity-[0.12]">
                  <SunBean size={240} color="#45200a" />
                </div>

                <div className="relative">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[0.65rem] font-bold uppercase tracking-[0.35em] text-olive">
                        {lang === "es" ? "Miembro fundador" : "Founding member"}
                      </p>
                      <h3 className="mt-2 font-display text-4xl font-medium leading-none">
                        Club <em className="italic">Siembra</em>
                      </h3>
                    </div>
                    <SunBean size={44} color="#cb3700" />
                  </div>

                  <div className="mt-10 rounded-2xl bg-forest p-5 text-leche">
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.3em] text-matcha">
                      {lang === "es" ? "Beneficio de lanzamiento" : "Launch benefit"}
                    </p>
                    <p className="mt-2 font-display text-xl font-medium leading-snug">
                      ♥ {t(CLUB_OFERTA)}
                    </p>
                  </div>

                  <div className="mt-8 flex items-end justify-between">
                    <div>
                      <p className="text-[0.6rem] font-bold uppercase tracking-[0.3em] text-espresso/50">
                        {lang === "es" ? "Nº de miembro" : "Member No."}
                      </p>
                      <p className="font-display text-2xl font-medium tracking-widest">0001</p>
                    </div>
                    {/* "código de barras" decorativo */}
                    <div className="flex h-10 items-end gap-[3px]" aria-hidden="true">
                      {[3, 6, 4, 8, 5, 9, 4, 7, 3, 8, 5, 6].map((h, i) => (
                        <span key={i} className="w-[3px] bg-espresso/70" style={{ height: `${h * 3.5}px` }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </TiltCard>

            <Reveal delay={0.25} className="mt-8 text-center">
              <p className="text-sm text-leche/60">
                {lang === "es"
                  ? "Regístrate cuando lancemos para ser de los primeros."
                  : "Sign up at launch to be among the first."}
              </p>
            </Reveal>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ COMUNIDAD (cita) ═══════════ */}
      <section className="grain relative overflow-hidden bg-leche py-28 sm:py-36">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-12">
          <Reveal className="hidden justify-center lg:col-span-3 lg:flex">
            <div className="text-terracota">
              <RotatingBadge
                text={lang === "es" ? "· Comunidad · Bienestar · Condado · " : "· Community · Wellness · Condado · "}
                size={160}
                color="currentColor"
              />
            </div>
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-9">
            <p className="font-display text-3xl font-light italic leading-snug text-espresso sm:text-4xl md:text-5xl">
              “{t(FRASES.comunidad)}”
            </p>
            <p className="mt-8 flex items-center gap-4 text-xs font-bold uppercase tracking-[0.3em] text-olive">
              <span className="h-px w-10 bg-olive" />
              {SITE.legal}
            </p>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ VISÍTANOS CTA ═══════════ */}
      <section className="grain relative overflow-hidden bg-espresso py-28 text-leche">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-2">
          <Reveal>
            <SectionHead
              dark
              ghost="CONDADO"
              eyebrow={lang === "es" ? "Te esperamos" : "We're waiting for you"}
              title={
                <>
                  {lang === "es" ? "Ven a" : "Come to"}{" "}
                  <em className="font-light italic text-avena">Condado.</em>
                </>
              }
            />
            <div className="space-y-5 text-lg text-leche/85">
              <a
                href={SITE.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-4 transition-colors hover:text-avena"
              >
                <span className="mt-1 text-matcha">📍</span>
                <span className="border-b border-transparent pb-0.5 transition-colors group-hover:border-avena">
                  {SITE.address}
                </span>
              </a>
              <p className="flex items-start gap-4">
                <span className="mt-1 text-matcha">🕙</span> {SITE.hours}
              </p>
              <a
                href={`tel:${SITE.phone.replace(/[^\d]/g, "")}`}
                className="group flex items-start gap-4 transition-colors hover:text-avena"
              >
                <span className="mt-1 text-matcha">📱</span>
                <span className="border-b border-transparent pb-0.5 transition-colors group-hover:border-avena">
                  {SITE.phone}
                </span>
              </a>
              <a
                href={SITE.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-4 transition-colors hover:text-avena"
              >
                <span className="mt-1 text-matcha">◎</span>
                <span className="border-b border-transparent pb-0.5 transition-colors group-hover:border-avena">
                  {SITE.instagram}
                </span>
              </a>
            </div>
            <Link
              href="/visitanos"
              className="group mt-10 inline-flex items-center gap-3 btn-pill bg-terracota px-8 py-4 text-sm font-bold uppercase tracking-widest text-leche shadow-warm transition-all hover:scale-[1.04] hover:bg-mustard"
            >
              {lang === "es" ? "Cómo llegar" : "Get directions"}
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="group relative overflow-hidden rounded-[2rem]">
              <Image
                src="/brand/fotos/siembra-coffee-y-matcha.webp"
                alt="Siembra Cafe & Matcha Bar en Condado"
                width={800}
                height={800}
                className="w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
              {/* Velo plano para legibilidad. Sin gradiente: docs/01. */}
              <div className="absolute inset-0 bg-espresso/45" />
              <div className="absolute bottom-6 left-6 text-avena">
                <SunBean size={56} color="currentColor" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

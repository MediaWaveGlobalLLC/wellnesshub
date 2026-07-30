"use client";

import Link from "next/link";
import Image from "next/image";
import { useLang } from "@/lib/i18n";
import { SITE, PILARES } from "@/lib/site";
import { NAV_PRINCIPAL } from "@/lib/nav";
import { BRAND_ASSETS } from "@/lib/brand-assets.generated";
import { LeafIcon, PinIcon, CupIcon, ChatIcon } from "@/components/icons";

/**
 * Footer Forest — composición común a los 4 mockups: logo y tagline a la
 * izquierda, luego HORARIO, VISÍTANOS y SÍGUENOS.
 *
 * Datos de contacto: DEC-005 / plan D9. Los mockups traen "123 Wellness Way",
 * que es placeholder; los reales salen de la tarjeta de presentación oficial y
 * de Siembra Promo Square.png.
 *
 * Sin emojis: docs/01 los prohíbe como iconografía de UI (DEC-003).
 */
export function Footer() {
  const { lang, t } = useLang();
  const items = NAV_PRINCIPAL.filter((i) => i.href !== "/");

  return (
    <footer className="grain bg-forest text-leche">
      <div className="mx-auto max-w-[var(--container-content)] px-5 py-16 sm:px-8">
        {/* Pilares oficiales — pie del menú oficial */}
        <div className="mb-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-center">
          {PILARES.map((p, i) => (
            <span key={i} className="flex items-center gap-6">
              {i > 0 && <LeafIcon size={16} className="hidden text-matcha sm:block" />}
              <span className="font-display text-lg italic text-avena sm:text-xl">{t(p)}</span>
            </span>
          ))}
        </div>

        <div className="grid gap-10 border-t border-leche/15 pt-12 md:grid-cols-4">
          {/* Marca */}
          <div>
            <Image
              src={BRAND_ASSETS.siembraLogoBeige.src}
              alt="SIEMBRA — Wellness Hub | Coffee &amp; Matcha Bar"
              width={160}
              height={50}
              className="h-11 w-auto"
            />
            <p className="mt-4 text-sm leading-relaxed text-leche/70">{SITE.tagline.es}</p>
            <a
              href={SITE.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-matcha transition-colors hover:text-avena"
            >
              <ChatIcon size={16} />
              {SITE.instagram}
            </a>
          </div>

          {/* Navegación */}
          <div>
            <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-matcha">
              {lang === "es" ? "Navegación" : "Navigate"}
            </h2>
            <ul className="space-y-2.5">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-leche/80 transition-colors hover:text-avena"
                  >
                    {t(item)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Visítanos */}
          <div>
            <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-matcha">
              {lang === "es" ? "Visítanos" : "Visit us"}
            </h2>
            <ul className="space-y-3 text-sm text-leche/80">
              <li className="flex items-start gap-2.5">
                <PinIcon size={16} className="mt-0.5 flex-none text-matcha" />
                <a
                  href={SITE.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-avena"
                >
                  {SITE.address}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <ChatIcon size={16} className="flex-none text-matcha" />
                <a
                  href={`tel:${SITE.phone.replace(/[^\d]/g, "")}`}
                  className="transition-colors hover:text-avena"
                >
                  {SITE.phone}
                </a>
              </li>
              <li className="flex items-center gap-2.5 text-leche/60">
                <CupIcon size={16} className="flex-none text-matcha" />
                {SITE.hours}
              </li>
            </ul>
          </div>

          {/* Club */}
          <div>
            <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-matcha">
              Club Siembra
            </h2>
            <p className="text-sm leading-relaxed text-leche/70">
              {lang === "es"
                ? "Próximamente: lealtad, wallet, gift cards y experiencias exclusivas para miembros."
                : "Coming soon: loyalty, wallet, gift cards and exclusive member experiences."}
            </p>
            <Link
              href="/#club"
              className="btn-pill mt-4 inline-flex border-[1.5px] border-avena/60 px-5 text-xs font-bold uppercase tracking-widest text-avena transition-colors hover:bg-avena hover:text-forest"
            >
              {lang === "es" ? "Saber más" : "Learn more"}
            </Link>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-leche/15 pt-6 text-center text-xs text-leche/50 sm:flex-row sm:text-left">
          <p>
            © {new Date().getFullYear()} SIEMBRA · {SITE.legal}
          </p>
          {/*
            Los legales van aquí, no solo en el registro: quien ya tiene cuenta
            no vuelve a pasar por esa casilla y necesita poder consultarlos.
          */}
          <nav className="flex items-center gap-4">
            <Link href="/terminos" className="transition-colors hover:text-avena">
              {lang === "es" ? "Términos" : "Terms"}
            </Link>
            <Link href="/privacidad" className="transition-colors hover:text-avena">
              {lang === "es" ? "Privacidad" : "Privacy"}
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

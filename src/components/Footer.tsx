"use client";

import Link from "next/link";
import Image from "next/image";
import { useLang } from "@/lib/i18n";
import { SITE, PILARES } from "@/lib/site";

const NAV = [
  { href: "/menu", es: "Menú", en: "Menu" },
  { href: "/experiencia", es: "Experiencia", en: "Experience" },
  { href: "/nosotros", es: "Nosotros", en: "About" },
  { href: "/tienda", es: "Tienda", en: "Shop" },
  { href: "/visitanos", es: "Visítanos", en: "Visit" },
];

export function Footer() {
  const { lang, t } = useLang();

  return (
    <footer className="grain bg-forest text-leche">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        {/* Pilares */}
        <div className="mb-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-center">
          {PILARES.map((p, i) => (
            <span key={i} className="flex items-center gap-6">
              {i > 0 && <span className="hidden text-matcha sm:inline">✦</span>}
              <span className="font-display text-lg italic text-avena sm:text-xl">
                {t(p)}
              </span>
            </span>
          ))}
        </div>

        <div className="grid gap-10 border-t border-leche/15 pt-12 md:grid-cols-4">
          {/* Marca */}
          <div className="md:col-span-1">
            <Image
              src="/brand/logos/Siembra Logo Beige.webp"
              alt="Siembra Cafe & Matcha Bar"
              width={160}
              height={50}
              className="h-11 w-auto"
            />
            <p className="mt-4 text-sm leading-relaxed text-leche/70">
              {SITE.tagline.es}
            </p>
            <a
              href={SITE.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-sm font-semibold text-matcha transition-colors hover:text-avena"
            >
              {SITE.instagram} ↗
            </a>
          </div>

          {/* Navegación */}
          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-matcha">
              {lang === "es" ? "Navegación" : "Navigate"}
            </h4>
            <ul className="space-y-2.5">
              {NAV.map((item) => (
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

          {/* Contacto */}
          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-matcha">
              {lang === "es" ? "Visítanos" : "Visit us"}
            </h4>
            <ul className="space-y-2.5 text-sm text-leche/80">
              <li>
                <a href={SITE.mapsUrl} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-avena">
                  {SITE.address}
                </a>
              </li>
              <li>
                <a href={`tel:${SITE.phone.replace(/[^\d]/g, "")}`} className="transition-colors hover:text-avena">
                  {SITE.phone}
                </a>
              </li>
              <li className="text-leche/60">{SITE.hours}</li>
            </ul>
          </div>

          {/* Club teaser */}
          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-matcha">
              Club Siembra
            </h4>
            <p className="text-sm leading-relaxed text-leche/70">
              {lang === "es"
                ? "Próximamente: lealtad, pedidos y experiencias exclusivas para miembros."
                : "Coming soon: loyalty, ordering and exclusive member experiences."}
            </p>
            <Link
              href="/#club"
              className="mt-4 inline-block rounded-full border-1.5 border-avena/60 px-5 py-2 text-xs font-bold uppercase tracking-widest text-avena transition-all hover:bg-avena hover:text-forest"
            >
              {lang === "es" ? "Saber más" : "Learn more"}
            </Link>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-leche/15 pt-6 text-center text-xs text-leche/50 sm:flex-row sm:text-left">
          <p>
            © {new Date().getFullYear()} Siembra Cafe · {SITE.legal}
          </p>
          <p className="flex items-center gap-1.5">
            {lang === "es" ? "Hecho con" : "Made with"}
            <span className="text-terracota">♥</span>
            {lang === "es" ? "en Condado, Puerto Rico" : "in Condado, Puerto Rico"}
          </p>
        </div>
      </div>
    </footer>
  );
}

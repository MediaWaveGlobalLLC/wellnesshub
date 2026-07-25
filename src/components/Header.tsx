"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useLang } from "@/lib/i18n";
import { SITE } from "@/lib/site";

const NAV = [
  { href: "/menu", es: "Menú", en: "Menu" },
  { href: "/experiencia", es: "Experiencia", en: "Experience" },
  { href: "/nosotros", es: "Nosotros", en: "About" },
  { href: "/tienda", es: "Tienda", en: "Shop" },
  { href: "/visitanos", es: "Visítanos", en: "Visit" },
];

export function Header() {
  const { lang, setLang, t } = useLang();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const solid = scrolled || open;
  // La home abre con hero oscuro (logo blanco); las páginas internas abren
  // con fondo claro (logo negro). Al hacer scroll, siempre fondo claro.
  const isHome = pathname === "/";
  const useWhiteLogo = isHome && !solid;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        solid
          ? "bg-leche/95 backdrop-blur-md shadow-soft border-b border-espresso/10"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5" aria-label="Siembra Cafe — Home">
          <Image
            src={useWhiteLogo ? "/brand/logos/Siembra Logo Blanco.webp" : "/brand/logos/Siembra Logo Negro.webp"}
            alt="Siembra Cafe & Matcha Bar"
            width={140}
            height={44}
            priority
            className="h-9 w-auto sm:h-10 transition-all"
          />
        </Link>

        {/* Nav desktop */}
        <nav className="hidden items-center gap-7 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-[13px] font-semibold tracking-[0.08em] uppercase transition-colors hover:opacity-70 ${
                solid ? "text-espresso" : "text-leche"
              }`}
            >
              {t(item)}
            </Link>
          ))}
        </nav>

        {/* Acciones */}
        <div className="flex items-center gap-3">
          {/* Toggle idioma */}
          <button
            onClick={() => setLang(lang === "es" ? "en" : "es")}
            className={`rounded-full border-1.5 px-3 py-1 text-[11px] font-bold tracking-widest transition-all hover:scale-105 ${
              solid
                ? "border-espresso/40 text-espresso hover:border-espresso"
                : "border-leche/50 text-leche hover:border-leche"
            }`}
            aria-label="Cambiar idioma / Switch language"
          >
            {lang === "es" ? "EN" : "ES"}
          </button>

          {/* CTA Club */}
          <Link
            href="/#club"
            className="hidden rounded-full bg-terracota px-5 py-2 text-[12px] font-bold tracking-[0.08em] uppercase text-leche shadow-warm transition-all hover:bg-espresso hover:scale-[1.03] sm:inline-block"
          >
            {lang === "es" ? "Únete al Club" : "Join the Club"}
          </Link>

          {/* Hamburguesa móvil */}
          <button
            onClick={() => setOpen(!open)}
            className={`flex h-10 w-10 flex-col items-center justify-center gap-1.5 lg:hidden ${
              solid ? "text-espresso" : "text-leche"
            }`}
            aria-label="Abrir menú / Open menu"
          >
            <span className={`h-0.5 w-6 bg-current transition-all ${open ? "translate-y-2 rotate-45" : ""}`} />
            <span className={`h-0.5 w-6 bg-current transition-all ${open ? "opacity-0" : ""}`} />
            <span className={`h-0.5 w-6 bg-current transition-all ${open ? "-translate-y-2 -rotate-45" : ""}`} />
          </button>
        </div>
      </div>

      {/* Menú móvil */}
      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden bg-leche lg:hidden"
          >
            <div className="flex flex-col gap-1 px-6 pb-6 pt-2">
              {NAV.map((item, i) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i }}
                >
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block border-b border-espresso/10 py-3.5 font-display text-2xl text-espresso transition-colors hover:text-terracota"
                  >
                    {t(item)}
                  </Link>
                </motion.div>
              ))}
              <Link
                href="/#club"
                onClick={() => setOpen(false)}
                className="mt-4 rounded-full bg-terracota px-6 py-3 text-center text-sm font-bold uppercase tracking-widest text-leche"
              >
                {lang === "es" ? "Únete al Club" : "Join the Club"}
              </Link>
              <p className="mt-4 text-center text-xs text-espresso/60">
                {SITE.hours} · {SITE.instagram}
              </p>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

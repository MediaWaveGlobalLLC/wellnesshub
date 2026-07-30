"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

import { useLang } from "@/lib/i18n";
import { SITE } from "@/lib/site";
import { NAV_PRINCIPAL, navVisible } from "@/lib/nav";
import { BRAND_ASSETS } from "@/lib/brand-assets.generated";
import { BagIcon, UserIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * Header canónico — DEC-005 / plan D6.
 *
 * Composición del mockup 03 (el más completo de los cuatro): logo a la izquierda,
 * navegación al centro y CTA terracota con forma de píldora + bolsa a la derecha.
 *
 * Sin desenfoque de fondo: docs/01 lo prohíbe. Al hacer scroll el header pasa a un
 * fondo Leche sólido con borde fino.
 */
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
  // Solo la home abre sobre un hero Forest. En el resto de las páginas el header
  // arranca sobre fondo Leche, así que el texto claro sería ilegible: se usa
  // Espresso aunque el header aún esté transparente.
  const sobreHeroOscuro = pathname === "/" && !solid;
  const items = navVisible(NAV_PRINCIPAL);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-500",
        solid ? "border-b border-espresso/10 bg-leche shadow-soft" : "bg-transparent"
      )}
    >
      <div className="mx-auto flex max-w-[var(--container-content)] items-center justify-between px-5 py-3.5 sm:px-8">
        <Link href="/" className="flex items-center" aria-label="SIEMBRA — Inicio">
          <Image
            src={sobreHeroOscuro ? BRAND_ASSETS.siembraLogoBlanco.src : BRAND_ASSETS.siembraLogoNegro.src}
            alt="SIEMBRA — Wellness Hub | Coffee &amp; Matcha Bar"
            width={140}
            height={44}
            priority
            className="h-9 w-auto sm:h-10"
          />
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Principal">
          {items.map((item) => {
            const activo = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={activo ? "page" : undefined}
                className={cn(
                  "text-[13px] font-semibold uppercase tracking-[0.08em] transition-colors",
                  sobreHeroOscuro ? "text-leche" : "text-espresso",
                  activo
                    ? "underline decoration-terracota decoration-2 underline-offset-[6px]"
                    : "hover:text-terracota"
                )}
              >
                {t(item)}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setLang(lang === "es" ? "en" : "es")}
            className={cn(
              "btn-pill min-h-0 border-[1.5px] px-3 py-1 text-[11px] font-bold tracking-widest transition-colors",
              sobreHeroOscuro
                ? "border-leche/50 text-leche hover:border-leche"
                : "border-espresso/40 text-espresso hover:border-espresso"
            )}
            aria-label={lang === "es" ? "Switch to English" : "Cambiar a español"}
          >
            {lang === "es" ? "EN" : "ES"}
          </button>

          {/* D7: "Ordena online" es un CTA, no un motor de pedidos. Apunta al menú
              hasta que exista una URL de pedidos real. */}
          <Link
            href="/menu"
            className="btn-pill hidden items-center bg-terracota px-5 text-[12px] font-bold uppercase tracking-[0.08em] text-leche transition-colors hover:bg-primary-hover sm:inline-flex"
          >
            {lang === "es" ? "Ordena online" : "Order online"}
          </Link>

          {/* "Cuenta" del mockup 01. En Fase 3 apuntará a /perfil cuando haya sesión. */}
          <Link
            href="/iniciar-sesion"
            aria-label={lang === "es" ? "Cuenta" : "Account"}
            className={cn(
              "hidden p-2 transition-colors sm:block",
              sobreHeroOscuro ? "text-leche hover:text-avena" : "text-espresso hover:text-terracota"
            )}
          >
            <UserIcon size={20} />
          </Link>

          <Link
            href="/tienda"
            aria-label={lang === "es" ? "Tienda" : "Shop"}
            className={cn(
              "hidden p-2 transition-colors sm:block",
              sobreHeroOscuro ? "text-leche hover:text-avena" : "text-espresso hover:text-terracota"
            )}
          >
            <BagIcon size={20} />
          </Link>

          <button
            onClick={() => setOpen(!open)}
            className={cn(
              "flex h-10 w-10 flex-col items-center justify-center gap-1.5 lg:hidden",
              sobreHeroOscuro ? "text-leche" : "text-espresso"
            )}
            aria-expanded={open}
            aria-controls="menu-movil"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
          >
            <span className={cn("h-0.5 w-6 bg-current transition-transform", open && "translate-y-2 rotate-45")} />
            <span className={cn("h-0.5 w-6 bg-current transition-opacity", open && "opacity-0")} />
            <span className={cn("h-0.5 w-6 bg-current transition-transform", open && "-translate-y-2 -rotate-45")} />
          </button>
        </div>
      </div>

      {/* Render condicional simple. La versión anterior animaba la apertura con
          framer-motion desde altura y opacidad cero; con esa animación sin
          ejecutarse, el menú móvil se abría invisible. */}
      {open && (
        <nav
          id="menu-movil"
          aria-label="Principal móvil"
          className="entrada overflow-hidden bg-leche lg:hidden"
        >
            <div className="flex flex-col gap-1 px-6 pb-6 pt-2">
              {items.map((item) => (
                <div key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block border-b border-espresso/10 py-3.5 font-display text-2xl text-espresso transition-colors hover:text-terracota"
                  >
                    {t(item)}
                  </Link>
                </div>
              ))}
              <Link
                href="/menu"
                onClick={() => setOpen(false)}
                className="btn-pill mt-4 flex justify-center bg-terracota px-6 text-sm font-bold uppercase tracking-widest text-leche"
              >
                {lang === "es" ? "Ordena online" : "Order online"}
              </Link>
              <p className="mt-4 text-center text-xs text-text-muted">
                {SITE.hours} · {SITE.instagram}
              </p>
          </div>
        </nav>
      )}
    </header>
  );
}

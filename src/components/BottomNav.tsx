"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useLang } from "@/lib/i18n";
import { NAV_MOVIL } from "@/lib/nav";
import { useSesion } from "@/lib/sesion";
import { BagIcon, CupIcon, LeafIcon, UserIcon, WalletIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * Barra inferior de la cuenta — `05-cuenta-movil-reference.png`.
 *
 * Es lo que hace que el teléfono no se sienta como la web en pequeño. En
 * escritorio no existe: ahí manda la navegación del header, que ya cabe entera.
 *
 * Solo con sesión. Sin ella, Puntos, Wallet y Perfil rebotarían al login y la
 * barra sería una fila de trampas; para quien no ha entrado, la puerta es el
 * menú del header.
 */

const ICONO: Record<string, ReactNode> = {
  "/": <CupIcon size={20} />,
  "/puntos": <LeafIcon size={20} />,
  "/tienda": <BagIcon size={20} />,
  "/wallet": <WalletIcon size={20} />,
  "/perfil": <UserIcon size={20} />,
};

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useLang();
  const sesion = useSesion();

  /*
    Mientras no se sabe si hay sesión, no se pinta.

    Aquí sí se espera —al revés que en el header, que ante la duda enseña la
    puerta al login—, porque esto vive bajo el pulgar: aparecer de golpe
    empujaría el contenido justo cuando alguien va a tocarlo.
  */
  if (sesion !== true) return null;

  // El panel de administración tiene su propia navegación y sus propias reglas.
  if (pathname.startsWith("/admin")) return null;

  return (
    <>
      {/*
        Hueco del mismo alto que la barra.

        La barra es `fixed`, así que sin esto taparía el final del footer. Un
        padding en el `<body>` no serviría: la barra solo existe con sesión y en
        móvil, y el hueco tiene que aparecer y desaparecer con ella.
      */}
      <div aria-hidden className="h-[4.5rem] lg:hidden" />

      <nav
        aria-label="Cuenta"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 border-t border-espresso/10 bg-leche lg:hidden",
          // Respeta la barra de gestos del iPhone: sin esto, el último icono
          // queda debajo de ella y no se puede tocar.
          "pb-[env(safe-area-inset-bottom)]"
        )}
      >
        <ul className="flex items-stretch justify-around">
          {NAV_MOVIL.map((item) => {
            /*
              `/` solo se marca en la home exacta. Con `startsWith` se
              encendería en todas las rutas a la vez, porque toda ruta empieza
              por barra.
            */
            const activo =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={activo ? "page" : undefined}
                  className={cn(
                    // 4.5rem de alto: por encima del mínimo táctil de 44px que
                    // pide `docs/07`, con sitio para icono y etiqueta.
                    "flex h-[4.5rem] flex-col items-center justify-center gap-1.5 transition-colors",
                    activo ? "text-terracota" : "text-espresso/60 hover:text-espresso"
                  )}
                >
                  {ICONO[item.href]}
                  <span className="text-[0.65rem] font-semibold uppercase tracking-[0.08em]">
                    {t(item)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

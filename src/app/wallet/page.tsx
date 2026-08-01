import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Alert, Card } from "@/components/ui/Surface";
import { EmptyState } from "@/components/states";
import { MovimientoFila } from "@/components/wallet/MovimientoFila";
import { Recargar } from "@/components/wallet/Recargar";
import { obtenerWallet } from "@/lib/services/wallet-service";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { formatearDolares } from "@/lib/loyalty";
import { WalletIcon, GiftIcon, StarIcon, LeafIcon, CupIcon } from "@/components/icons";

/**
 * /wallet — módulo de créditos del mockup 03.
 *
 * Saldo real e historial del ledger. El canje vive en `/wallet/canjear`, con su
 * propio rate limit y su verificación por hash.
 *
 * El mockup rotula este bloque "Tus créditos" y en el perfil mezcla puntos con
 * dinero ("1 punto = $0.10"). Aquí solo hay dinero de tienda: `docs/00` separa
 * los dos sistemas y los puntos no tienen valor monetario.
 */
export const metadata: Metadata = {
  title: "Mis créditos",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const COMO_FUNCIONA = [
  {
    Icono: CupIcon,
    titulo: "Gana créditos",
    detalle: "Promociones y devoluciones se abonan a tu saldo.",
  },
  {
    Icono: WalletIcon,
    titulo: "Úsalos cuando quieras",
    detalle: "Sin fecha de vencimiento, en café, matcha y productos.",
  },
  {
    Icono: GiftIcon,
    titulo: "Recíbelos de regalo",
    detalle: "Una gift card canjeada suma directo a tu saldo.",
  },
  {
    Icono: StarIcon,
    titulo: "Separados de tus puntos",
    detalle: "Los puntos dan nivel y recompensas; el crédito es dinero de tienda.",
  },
];

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ recarga?: string }>;
}) {
  if (!supabaseConfigurado()) redirect("/iniciar-sesion?siguiente=%2Fwallet");

  const [wallet, { recarga }] = await Promise.all([obtenerWallet(), searchParams]);
  if (!wallet) redirect("/iniciar-sesion?siguiente=%2Fwallet");

  return (
    <div className="grain min-h-screen bg-leche pb-20 pt-28 sm:pt-32">
      <div className="mx-auto max-w-[var(--container-content)] px-5 sm:px-8">
        <Link
          href="/perfil"
          className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-terracota underline underline-offset-4"
        >
          ← Volver al perfil
        </Link>

        {/*
          Vuelta del Checkout.

          Se dice «estamos confirmando», no «ya tienes el saldo»: quien acredita
          es el webhook de Stripe, que puede tardar unos segundos. Prometer aquí
          un saldo que todavía no está sería la forma más rápida de que alguien
          crea que se perdió su dinero.
        */}
        {recarga === "ok" && (
          <div className="mt-6">
            <Alert titulo="Pago recibido">
              <p>
                Estamos confirmando la recarga con el banco. Tu saldo se actualiza solo en unos
                segundos; si no lo ves, recarga esta página.
              </p>
            </Alert>
          </div>
        )}
        {recarga === "cancelada" && (
          <div className="mt-6">
            <Alert titulo="Recarga cancelada">
              <p>No se cobró nada. Puedes volver a intentarlo cuando quieras.</p>
            </Alert>
          </div>
        )}

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {/* Saldo — tarjeta Forest del mockup 03 */}
          <Card tono="forest" className="p-7 lg:col-span-1">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-avena/70">
              Saldo disponible
            </p>
            <p className="mt-4 font-display text-[2.75rem] leading-none text-avena">
              {formatearDolares(wallet.balanceCents)}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-avena/75">
              Crédito de tienda para usar en café, matcha y productos.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 text-avena/60">
              <WalletIcon size={20} />
              <span className="text-xs uppercase tracking-[0.1em]">{wallet.moneda}</span>
            </span>
          </Card>

          {/* Historial — el ledger, no una lista decorativa */}
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-baseline justify-between gap-4">
              <h1 className="font-display text-2xl text-espresso">Historial de créditos</h1>
              {wallet.total > 0 && (
                <p className="text-xs text-text-muted">
                  {wallet.total} {wallet.total === 1 ? "movimiento" : "movimientos"}
                </p>
              )}
            </div>

            {wallet.movimientos.length === 0 ? (
              <div className="mt-6">
                <EmptyState
                  titulo="Todavía sin movimientos"
                  descripcion="Aquí verás cada crédito y cada consumo, con su fecha y el saldo que quedó."
                />
              </div>
            ) : (
              <ul className="mt-5 divide-y divide-border">
                {wallet.movimientos.map((m) => (
                  <MovimientoFila key={m.id} movimiento={m} />
                ))}
              </ul>
            )}

            {wallet.hayMas && (
              <p className="mt-5 text-xs text-text-muted">
                Mostrando los {wallet.movimientos.length} más recientes de {wallet.total}.
              </p>
            )}
          </Card>
        </div>

        {/*
          Recargar. Debajo del saldo y del historial, que es el orden en que se
          mira: primero cuánto tengo, luego en qué se fue, y entonces si añado.
        */}
        <section className="mt-5">
          <Recargar />
        </section>

        {/* Así funcionan tus créditos — bloque inferior del mockup 03 */}
        <section className="mt-12">
          <h2 className="font-display text-2xl text-espresso">Así funcionan tus créditos</h2>
          <ul className="mt-6 grid grid-cols-2 gap-6 lg:grid-cols-4">
            {COMO_FUNCIONA.map(({ Icono, titulo, detalle }) => (
              <li key={titulo}>
                <Icono size={28} className="text-espresso" />
                <p className="mt-3 text-sm font-semibold text-espresso">{titulo}</p>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">{detalle}</p>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/wallet/canjear"
            className="btn-pill inline-flex items-center bg-forest px-7 text-[0.75rem] font-bold uppercase tracking-[0.12em] text-avena transition-opacity hover:opacity-90"
          >
            <LeafIcon size={15} className="mr-2" />
            Canjear un código
          </Link>
          <Link
            href="/gift-cards"
            className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-espresso underline decoration-terracota decoration-2 underline-offset-[6px]"
          >
            Comprar una gift card
          </Link>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/Surface";
import { CanjeForm } from "@/components/gift-cards/CanjeForm";
import { TarjetaRegalo } from "@/components/gift-cards/TarjetaRegalo";
import { obtenerWallet } from "@/lib/services/wallet-service";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { formatearDolares } from "@/lib/loyalty";

export const metadata: Metadata = {
  title: "Canjear código",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** /wallet/canjear — el canje enfocado que pide `docs/02`. */
export default async function CanjearPage() {
  if (!supabaseConfigurado()) redirect("/iniciar-sesion?siguiente=%2Fwallet%2Fcanjear");

  const wallet = await obtenerWallet();
  if (!wallet) redirect("/iniciar-sesion?siguiente=%2Fwallet%2Fcanjear");

  return (
    <div className="grain min-h-screen bg-leche pb-20 pt-28 sm:pt-32">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <Link
          href="/wallet"
          className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-terracota underline underline-offset-4"
        >
          ← Volver a mis créditos
        </Link>

        <header className="mt-5">
          <h1 className="font-display text-3xl text-espresso sm:text-4xl">Canjear código</h1>
          <p className="mt-2 leading-relaxed text-text-muted">
            Introduce el código de tu gift card y el importe entra directo a tus créditos.
          </p>
        </header>

        <div className="mt-9 grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,15rem)]">
          <Card className="p-6 sm:p-7">
            <CanjeForm />
          </Card>

          <aside className="space-y-5">
            <TarjetaRegalo tono="terracota" />
            <Card className="p-5">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
                Saldo actual
              </p>
              <p className="mt-2 font-display text-2xl text-espresso">
                {formatearDolares(wallet.balanceCents)}
              </p>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}

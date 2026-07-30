import type { Metadata } from "next";
import Link from "next/link";

import { Card, Alert } from "@/components/ui/Surface";
import { TarjetaRegalo } from "@/components/gift-cards/TarjetaRegalo";
import { crearClienteServidor } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { formatearDolares } from "@/lib/loyalty";

export const metadata: Metadata = {
  title: "Compra confirmada",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * /gift-cards/confirmacion
 *
 * Pantalla de vuelta desde Stripe. NO acredita nada ni emite la tarjeta: eso lo
 * hace el webhook firmado (`docs/06`). Recargar esta página no regala tarjetas.
 *
 * Por eso el estado se lee del pedido: si el webhook aún no llegó, se dice que
 * está en proceso en vez de fingir que todo terminó.
 */
export default async function ConfirmacionPage({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string }>;
}) {
  const { pedido: pedidoId } = await searchParams;

  let estado: "pagado" | "pendiente" | "desconocido" = "desconocido";
  let centavos = 0;
  let destinatario = "";
  let formato: string | null = null;

  if (supabaseConfigurado() && pedidoId) {
    const supabase = await crearClienteServidor();
    // RLS: solo el comprador ve su pedido.
    const { data } = await supabase
      .from("gift_card_orders")
      .select("status, amount_cents, recipient_name, format")
      .eq("id", pedidoId)
      .maybeSingle();

    if (data) {
      estado = data.status === "paid" ? "pagado" : "pendiente";
      centavos = Number(data.amount_cents);
      destinatario = data.recipient_name;
      formato = data.format;
    }
  }

  return (
    <div className="grain min-h-screen bg-leche pb-20 pt-32 sm:pt-36">
      <div className="mx-auto max-w-2xl px-5 text-center sm:px-8">
        <div className="mx-auto w-full max-w-xs">
          <TarjetaRegalo tono="forest" />
        </div>

        {estado === "pagado" ? (
          <>
            <h1 className="mt-9 font-display text-3xl text-espresso sm:text-4xl">
              ¡Gracias! Tu gift card está en camino.
            </h1>
            <p className="mt-4 leading-relaxed text-text-muted">
              {formato === "digital"
                ? `Enviamos el código a ${destinatario} por correo.`
                : `Prepararemos el envío físico para ${destinatario}.`}{" "}
              Importe: <strong className="text-espresso">{formatearDolares(centavos)}</strong>.
            </p>
          </>
        ) : estado === "pendiente" ? (
          <>
            <h1 className="mt-9 font-display text-3xl text-espresso sm:text-4xl">
              Estamos confirmando tu pago
            </h1>
            <div className="mt-6 text-left">
              <Alert>
                Tu banco todavía no confirmó el cobro. En cuanto lo haga emitimos la tarjeta y la
                enviamos automáticamente — no hace falta que hagas nada ni que vuelvas a pagar.
              </Alert>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-9 font-display text-3xl text-espresso sm:text-4xl">
              No encontramos ese pedido
            </h1>
            <p className="mt-4 leading-relaxed text-text-muted">
              Puede que el enlace esté incompleto. Revisa tus pedidos desde tu cuenta o escríbenos.
            </p>
          </>
        )}

        <Card className="mt-10 p-6 text-left">
          <p className="text-sm leading-relaxed text-text-muted">
            El saldo de una gift card se activa <strong className="text-espresso">al canjear el
            código</strong>, no al comprarla. Quien la reciba lo introduce desde su cuenta y el
            importe entra directo a sus créditos.
          </p>
        </Card>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href="/wallet"
            className="btn-pill inline-flex items-center bg-terracota px-7 text-[0.75rem] font-bold uppercase tracking-[0.12em] text-leche transition-colors hover:bg-primary-hover"
          >
            Ver mis créditos
          </Link>
          <Link
            href="/gift-cards"
            className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-espresso underline decoration-terracota decoration-2 underline-offset-[6px]"
          >
            Comprar otra
          </Link>
        </div>
      </div>
    </div>
  );
}

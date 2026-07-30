import type { NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe, stripeConfigurado, webhookSecretConfigurado } from "@/lib/stripe";
import { emitirPorPago } from "@/lib/gift-cards/service";

/**
 * POST /api/stripe/webhook — `docs/05`.
 *
 * Es el ÚNICO camino por el que se emite una gift card. La página de éxito no
 * acredita nada (`docs/06`): volver a ella no regala tarjetas.
 *
 * Tres cosas, en este orden:
 *  1. Cuerpo crudo, sin parsear — la firma se calcula sobre los bytes exactos.
 *  2. Verificación de firma con STRIPE_WEBHOOK_SECRET.
 *  3. Emisión idempotente por `stripe_event_id`.
 *
 * Responde rápido y con 200 salvo que el fallo sea reintentable: un 500 hace
 * que Stripe reintente, y eso es lo correcto cuando el problema es nuestro.
 */
export const dynamic = "force-dynamic";

/** Eventos que confirman un cobro y disparan la emisión. */
const EVENTOS_DE_PAGO = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

export async function POST(request: NextRequest) {
  if (!stripeConfigurado() || !webhookSecretConfigurado()) {
    console.error("webhook recibido sin STRIPE_SECRET_KEY o STRIPE_WEBHOOK_SECRET");
    return new Response("stripe no configurado", { status: 503 });
  }

  const firma = request.headers.get("stripe-signature");
  if (!firma) return new Response("falta la firma", { status: 400 });

  // `text()` y no `json()`: parsear cambiaría los bytes y la firma no cuadraría.
  const crudo = await request.text();

  let evento: Stripe.Event;
  try {
    evento = stripe().webhooks.constructEvent(
      crudo,
      firma,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (causa) {
    // Firma inválida: no viene de Stripe. 400 y sin reintento.
    console.error("firma de webhook inválida:", causa instanceof Error ? causa.message : causa);
    return new Response("firma inválida", { status: 400 });
  }

  if (!EVENTOS_DE_PAGO.has(evento.type)) {
    // Reconocido y descartado. Devolver 200 evita reintentos innecesarios.
    return Response.json({ recibido: true, ignorado: evento.type });
  }

  const sesion = evento.data.object as Stripe.Checkout.Session;

  // Un pago aún no liquidado no emite nada: llegará el evento async.
  if (sesion.payment_status !== "paid") {
    return Response.json({ recibido: true, pendiente: sesion.payment_status });
  }

  const resultado = await emitirPorPago(
    evento.id,
    evento.type,
    sesion.id,
    typeof sesion.payment_intent === "string" ? sesion.payment_intent : null
  );

  if (!resultado.ok) {
    // 500 a propósito: Stripe reintentará y la idempotencia protege el reintento.
    console.error(`[${evento.id}] emisión falló: ${resultado.mensaje}`);
    return new Response("fallo al emitir", { status: 500 });
  }

  return Response.json({ recibido: true, yaProcesado: resultado.yaProcesado });
}

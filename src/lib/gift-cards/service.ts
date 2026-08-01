import "server-only";

import { crearClienteServidor } from "@/lib/supabase/server";
import { crearClienteServicio, servicioDisponible } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { generarCodigo, hashCodigo, normalizarCodigo, pareceCodigoValido } from "./codigo";
import { enviarGiftCard } from "@/lib/email/enviar";
import type { CheckoutInput } from "@/lib/validation/gift-cards";

/**
 * Ciclo de vida de las gift cards — `docs/03`.
 *
 *   compra → Checkout de Stripe → webhook firmado → emisión → correo → canje
 *
 * Dos reglas que atraviesan todo:
 *  · el importe solo sale de nuestro servidor, nunca del cliente;
 *  · el saldo se acredita únicamente desde el webhook, jamás desde la página de
 *    éxito (`docs/06`). Volver a `/gift-cards/confirmacion` no regala nada.
 */

export type ResultadoCheckout =
  | { ok: true; checkoutUrl: string; orderId: string }
  | { ok: false; codigo: string; mensaje: string };

export async function crearCheckout(
  datos: CheckoutInput,
  urlBase: string
): Promise<ResultadoCheckout> {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, codigo: "sesion_requerida", mensaje: "Inicia sesión para comprar." };
  }

  if (!servicioDisponible()) {
    return {
      ok: false,
      codigo: "servicio_no_configurado",
      mensaje: "La compra no está disponible ahora mismo.",
    };
  }

  /*
    El pedido lo escribe la clave de servicio, no la sesión del usuario.

    `gift_card_orders` tiene RLS con política de SELECT y NINGUNA de INSERT
    (`0001:253`), así que insertar con el cliente de sesión lo deniega Postgres
    siempre: la compra fallaba con «No pudimos iniciar la compra» antes de
    llegar a Stripe, y llevaba así desde que se construyó.

    Se arregla por aquí y no abriendo una política de INSERT a propósito.
    `docs/06` manda que las operaciones de gift cards se ejecuten server-side, y
    dejar insertar al navegador permitiría crear pedidos con el importe que
    quisiera: el webhook emite la tarjeta por `amount_cents` DE LA FILA, no por
    lo que se cobró. La sesión sigue mandando en quién compra —`user.id` sale de
    `getUser()`, no del cuerpo de la petición—, y el importe ya viene validado
    por `checkoutSchema`.
  */
  const servicio = crearClienteServicio();

  // El pedido nace en 'pending'. Solo el webhook lo pasa a 'paid'.
  const { data: pedido, error } = await servicio
    .from("gift_card_orders")
    .insert({
      purchaser_user_id: user.id,
      amount_cents: datos.amountCents,
      format: datos.format,
      recipient_name: datos.recipientName,
      recipient_email: datos.recipientEmail ?? null,
      message: datos.message ?? null,
    })
    .select("id")
    .single();

  if (error || !pedido) {
    // Se registra el motivo: sin esto, el fallo anterior fue invisible durante
    // fases enteras y solo se veía «No pudimos iniciar la compra».
    console.error("no se pudo crear el pedido de gift card:", error?.message);
    return { ok: false, codigo: "pedido_fallido", mensaje: "No pudimos iniciar la compra." };
  }

  try {
    const sesion = await stripe().checkout.sessions.create({
      mode: "payment",
      // `client_reference_id` ata la sesión al pedido sin meter datos personales
      // en la metadata (`docs/03`).
      client_reference_id: pedido.id,
      metadata: { order_id: pedido.id },
      customer_email: user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: datos.amountCents,
            product_data: {
              name: `Gift card SIEMBRA · ${datos.format === "digital" ? "Digital" : "Física"}`,
              description: `Para ${datos.recipientName}`,
            },
          },
        },
      ],
      success_url: `${urlBase}/gift-cards/confirmacion?pedido=${pedido.id}`,
      cancel_url: `${urlBase}/gift-cards?cancelado=1`,
    });

    if (!sesion.url) throw new Error("Stripe no devolvió URL de checkout.");

    await servicio
      .from("gift_card_orders")
      .update({ stripe_checkout_session_id: sesion.id })
      .eq("id", pedido.id);

    return { ok: true, checkoutUrl: sesion.url, orderId: pedido.id };
  } catch (causa) {
    console.error("checkout de Stripe falló:", causa);
    // El pedido queda en 'pending' y sin sesión: no estorba y deja rastro del
    // intento fallido.
    return { ok: false, codigo: "stripe_fallido", mensaje: "No pudimos abrir el pago." };
  }
}

/* ── Fulfillment desde el webhook ────────────────────────────────────────── */

export type ResultadoEmision =
  | { ok: true; yaProcesado: boolean; giftCardId: string | null }
  | { ok: false; codigo: string; mensaje: string };

/**
 * Emite la tarjeta de un pago confirmado.
 *
 * Idempotente por `stripe_event_id`: la función SQL devuelve `ya_procesado` si
 * el evento se repite, y en ese caso no se genera código nuevo ni se reenvía el
 * correo.
 */
export async function emitirPorPago(
  eventId: string,
  eventType: string,
  sessionId: string,
  paymentIntentId: string | null
): Promise<ResultadoEmision> {
  if (!servicioDisponible()) {
    return {
      ok: false,
      codigo: "servicio_no_configurado",
      mensaje: "SUPABASE_SERVICE_ROLE_KEY no está configurada.",
    };
  }

  const servicio = crearClienteServicio();

  // El código se genera antes de llamar, pero solo se usa si el evento es nuevo.
  const { codigo, last4 } = generarCodigo();

  const { data, error } = await servicio.rpc("emitir_gift_card", {
    p_stripe_event_id: eventId,
    p_event_type: eventType,
    p_session_id: sessionId,
    p_payment_intent_id: paymentIntentId,
    p_code_hash: hashCodigo(codigo),
    p_code_last4: last4,
  });

  if (error) {
    return { ok: false, codigo: "emision_fallida", mensaje: error.message };
  }

  const fila = Array.isArray(data) ? data[0] : data;

  // Evento repetido: la tarjeta ya existe con su código original, que no se
  // puede recuperar. No se reenvía nada ni se inventa uno nuevo.
  if (fila?.ya_procesado) {
    return { ok: true, yaProcesado: true, giftCardId: fila.gift_card_id ?? null };
  }

  // Envío del código en claro. Es la única vez que existe fuera del correo.
  const { data: pedido } = await servicio
    .from("gift_card_orders")
    .select("recipient_name, recipient_email, message, amount_cents, format")
    .eq("id", fila.order_id)
    .maybeSingle();

  if (pedido?.recipient_email) {
    await enviarGiftCard({
      para: pedido.recipient_email,
      nombre: pedido.recipient_name,
      mensaje: pedido.message,
      codigo,
      centavos: Number(pedido.amount_cents),
    });
  }

  return { ok: true, yaProcesado: false, giftCardId: fila.gift_card_id };
}

/* ── Canje ───────────────────────────────────────────────────────────────── */

export type ResultadoCanje =
  | {
      ok: true;
      creditedCents: number;
      newBalanceCents: number;
      receiptId: string;
      /** Lo que queda EN LA TARJETA después del canje. 0 = agotada. */
      cardBalanceCents: number;
    }
  | { ok: false; codigo: string; mensaje: string };

const ERRORES_CANJE: Record<string, string> = {
  codigo_invalido: "Ese código no es válido. Revísalo e inténtalo de nuevo.",
  ya_canjeada: "Esta gift card ya no tiene saldo.",
  cancelada: "Esta gift card fue cancelada. Escríbenos y lo revisamos.",
  expirada: "Esta gift card expiró.",
  saldo_insuficiente: "La tarjeta no tiene tanto saldo. Prueba con menos.",
  importe_invalido: "El importe tiene que ser mayor que cero.",
};

/** Ventana y tope del rate limit — `docs/06`. */
const VENTANA_MINUTOS = 15;
const INTENTOS_MAXIMOS = 8;

/**
 * Canjea una tarjeta, entera o por partes.
 *
 * `centavos` a null significa «todo el saldo». `clientRequestId` lo genera el
 * navegador por intento de envío y es lo que evita que un reintento acredite
 * dos veces; si no llega, el canje funciona igual pero pierde esa protección.
 */
export async function canjear(
  codigoEntrada: string,
  ip: string | null,
  centavos: number | null = null,
  clientRequestId: string | null = null
): Promise<ResultadoCanje> {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, codigo: "sesion_requerida", mensaje: "Inicia sesión para canjear." };
  }
  if (!servicioDisponible()) {
    return {
      ok: false,
      codigo: "servicio_no_configurado",
      mensaje: "El canje no está disponible ahora mismo.",
    };
  }

  const servicio = crearClienteServicio();

  // Rate limit antes de tocar nada: sin él, un bucle podría sondear códigos
  // midiendo tiempos de respuesta.
  const desde = new Date(Date.now() - VENTANA_MINUTOS * 60_000).toISOString();
  const { count } = await servicio
    .from("gift_card_redeem_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("exito", false)
    .gte("created_at", desde);

  if ((count ?? 0) >= INTENTOS_MAXIMOS) {
    return {
      ok: false,
      codigo: "rate_limited",
      mensaje: `Demasiados intentos. Espera ${VENTANA_MINUTOS} minutos e inténtalo otra vez.`,
    };
  }

  const registrar = (exito: boolean) =>
    servicio.from("gift_card_redeem_attempts").insert({ user_id: user.id, ip, exito });

  const normalizado = normalizarCodigo(codigoEntrada);
  if (!pareceCodigoValido(normalizado)) {
    await registrar(false);
    return { ok: false, codigo: "codigo_invalido", mensaje: ERRORES_CANJE.codigo_invalido };
  }

  const { data, error } = await servicio.rpc("canjear_gift_card", {
    p_user_id: user.id,
    p_code_hash: hashCodigo(normalizado),
    p_amount_cents: centavos,
    p_client_request_id: clientRequestId,
  });

  if (error) {
    await registrar(false);
    const clave = Object.keys(ERRORES_CANJE).find((k) => error.message.includes(k));
    return {
      ok: false,
      codigo: clave ?? "canje_fallido",
      mensaje: clave ? ERRORES_CANJE[clave] : "No pudimos completar el canje.",
    };
  }

  await registrar(true);
  const fila = Array.isArray(data) ? data[0] : data;

  return {
    ok: true,
    creditedCents: Number(fila.credited_cents),
    newBalanceCents: Number(fila.new_balance_cents),
    receiptId: fila.receipt_id,
    cardBalanceCents: Number(fila.card_balance_cents),
  };
}

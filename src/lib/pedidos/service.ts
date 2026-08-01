import "server-only";

import { crearClienteServicio, servicioDisponible } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";

/**
 * Pedidos del menú — `0021_pedidos.sql`.
 *
 *   carrito → pedido sin pagar → (saldo | Checkout de Stripe) → pagado → barra
 *
 * Dos reglas atraviesan todo, las mismas que en las gift cards:
 *  · el importe sale del catálogo en el servidor, jamás del navegador;
 *  · el pedido solo se cierra con un pago confirmado. La página de éxito no
 *    paga nada (`docs/06`): volver a ella no regala café.
 */

/**
 * Marca de los Checkout de pedidos.
 *
 * El webhook lo usa para saber si un pago es de un pedido o de una gift card.
 * Sin marca se asume gift card, que es lo que había antes de `0021`: así las
 * sesiones creadas antes de este cambio siguen emitiendo su tarjeta.
 */
export const TIPO_PEDIDO = "pedido";

export type ResultadoCheckout =
  | { ok: true; checkoutUrl: string }
  | { ok: false; codigo: string; mensaje: string };

/**
 * Abre el Checkout de Stripe de un pedido ya creado.
 *
 * El importe se lee de la fila, no del cliente: aquí ya no hay forma de que el
 * navegador influya en lo que se cobra.
 */
export async function crearCheckoutPedido(
  userId: string,
  orderId: string,
  urlBase: string
): Promise<ResultadoCheckout> {
  if (!servicioDisponible()) {
    return { ok: false, codigo: "servicio_no_configurado", mensaje: "El pago no está disponible." };
  }

  const servicio = crearClienteServicio();

  const { data: pedido } = await servicio
    .from("orders")
    .select("id, order_number, total_cents, status, user_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!pedido || pedido.user_id !== userId) {
    return { ok: false, codigo: "pedido_no_encontrado", mensaje: "Ese pedido ya no existe." };
  }
  if (pedido.status !== "pendiente_pago") {
    return { ok: false, codigo: "pedido_ya_pagado", mensaje: "Ese pedido ya está pagado." };
  }

  try {
    const sesion = await stripe().checkout.sessions.create({
      mode: "payment",
      client_reference_id: pedido.id,
      // `tipo` es lo que el webhook mira para no confundirlo con una gift card.
      metadata: { tipo: TIPO_PEDIDO, order_id: pedido.id },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Number(pedido.total_cents),
            product_data: {
              name: `Pedido ${pedido.order_number} · SIEMBRA`,
              description: "Para recoger en SIEMBRA Condado",
            },
          },
        },
      ],
      success_url: `${urlBase}/perfil/pedidos?pedido=${pedido.order_number}`,
      cancel_url: `${urlBase}/pedir?cancelado=1`,
    });

    if (!sesion.url) throw new Error("Stripe no devolvió URL de checkout.");

    /*
      La sesión se ata ANTES de mandar a nadie a pagar. Si se atara después, un
      webhook rápido podría llegar antes que el update y no encontrar el pedido.
    */
    const { error } = await servicio.rpc("atar_sesion_stripe", {
      p_user_id: userId,
      p_order_id: pedido.id,
      p_session_id: sesion.id,
    });

    if (error) {
      return { ok: false, codigo: "pedido_no_encontrado", mensaje: "Ese pedido ya no existe." };
    }

    return { ok: true, checkoutUrl: sesion.url };
  } catch (causa) {
    console.error("checkout de pedido falló:", causa);
    return { ok: false, codigo: "stripe_fallido", mensaje: "No pudimos abrir el pago." };
  }
}

export type ResultadoConfirmacion =
  | { ok: true; yaProcesado: boolean; orderNumber: string | null }
  | { ok: false; codigo: string; mensaje: string };

/** Cierra el pedido desde el webhook firmado. Idempotente por evento. */
export async function confirmarPagoPedido(
  eventId: string,
  eventType: string,
  sessionId: string
): Promise<ResultadoConfirmacion> {
  if (!servicioDisponible()) {
    return {
      ok: false,
      codigo: "servicio_no_configurado",
      mensaje: "SUPABASE_SERVICE_ROLE_KEY no está configurada.",
    };
  }

  const { data, error } = await crearClienteServicio().rpc("marcar_pedido_pagado", {
    p_stripe_event_id: eventId,
    p_event_type: eventType,
    p_session_id: sessionId,
  });

  if (error) return { ok: false, codigo: "confirmacion_fallida", mensaje: error.message };

  const fila = Array.isArray(data) ? data[0] : data;
  return {
    ok: true,
    yaProcesado: Boolean(fila?.ya_procesado),
    orderNumber: fila?.order_number ?? null,
  };
}

import "server-only";

import { crearClienteServicio, servicioDisponible } from "@/lib/supabase/admin";
import { stripe, stripeConfigurado } from "@/lib/stripe";

/**
 * Recarga de saldo — `0024_recarga_saldo.sql`.
 *
 * Mismo guion que los pedidos (`0021`) y las gift cards (`0009`): una fila
 * local en 'pendiente', una sesión de Stripe atada a ella, y el webhook como
 * ÚNICO camino que acredita saldo. La página de éxito no suma nada; volver a
 * ella veinte veces, tampoco.
 */

/** Marca en `metadata` que el webhook mira para no confundirla con otra cosa. */
export const TIPO_RECARGA = "recarga";

/**
 * Importes que se ofrecen, en centavos.
 *
 * Viven aquí y no en la base a propósito: cambiarlos es una decisión de negocio
 * de dos minutos y no debería necesitar una migración. La base solo pone el
 * freno de cordura ($5–$500).
 *
 * El de $20 es el de la promoción de la portada; va primero y marcado.
 */
export const IMPORTES = [
  { centavos: 2000, etiqueta: "$20", promo: true },
  { centavos: 5000, etiqueta: "$50", promo: false },
  { centavos: 10000, etiqueta: "$100", promo: false },
] as const;

export function importeValido(centavos: number): boolean {
  return IMPORTES.some((i) => i.centavos === centavos);
}

export type ResultadoCheckout =
  | { ok: true; checkoutUrl: string }
  | { ok: false; codigo: string; mensaje: string };

export async function crearCheckoutRecarga(
  userId: string,
  centavos: number,
  urlBase: string
): Promise<ResultadoCheckout> {
  if (!servicioDisponible() || !stripeConfigurado()) {
    return {
      ok: false,
      codigo: "servicio_no_configurado",
      mensaje: "El pago no está disponible ahora mismo.",
    };
  }

  // Se comprueba contra la lista, no contra el rango: los botones son los que
  // son, y aceptar cualquier cifra desde el cliente abriría un campo libre que
  // nadie decidió ofrecer.
  if (!importeValido(centavos)) {
    return { ok: false, codigo: "importe_invalido", mensaje: "Ese importe no está disponible." };
  }

  const servicio = crearClienteServicio();

  const { data, error } = await servicio.rpc("crear_recarga", {
    p_user_id: userId,
    p_amount_cents: centavos,
  });

  if (error) {
    return { ok: false, codigo: "recarga_fallida", mensaje: "No pudimos preparar la recarga." };
  }

  const fila = Array.isArray(data) ? data[0] : data;
  const recargaId = (fila as { recarga_id: string } | undefined)?.recarga_id;
  if (!recargaId) {
    return { ok: false, codigo: "recarga_fallida", mensaje: "No pudimos preparar la recarga." };
  }

  try {
    const sesion = await stripe().checkout.sessions.create({
      mode: "payment",
      client_reference_id: recargaId,
      metadata: { tipo: TIPO_RECARGA, recarga_id: recargaId },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: centavos,
            product_data: {
              name: "Saldo SIEMBRA",
              description: "Crédito para usar en café, matcha y productos del local.",
            },
          },
        },
      ],
      success_url: `${urlBase}/wallet?recarga=ok`,
      cancel_url: `${urlBase}/wallet?recarga=cancelada`,
    });

    if (!sesion.url) throw new Error("Stripe no devolvió URL de checkout.");

    /*
      La sesión se ata ANTES de mandar a nadie a pagar.

      Si se atara después, un webhook rápido —Stripe los entrega en segundos—
      podría llegar antes que el update y no encontrar la recarga que tiene que
      acreditar. Es la misma razón por la que `0021` lo hace en este orden.
    */
    const { error: errorAtar } = await servicio.rpc("atar_sesion_recarga", {
      p_user_id: userId,
      p_recarga_id: recargaId,
      p_session_id: sesion.id,
    });

    if (errorAtar) {
      return { ok: false, codigo: "recarga_fallida", mensaje: "No pudimos preparar la recarga." };
    }

    return { ok: true, checkoutUrl: sesion.url };
  } catch (causa) {
    console.error("checkout de recarga falló:", causa);
    return { ok: false, codigo: "stripe_fallido", mensaje: "No pudimos abrir el pago." };
  }
}

export type ResultadoConfirmacion =
  | { ok: true; yaProcesado: boolean; cafeOtorgado: boolean; saldoCents: number }
  | { ok: false; mensaje: string };

/** Lo llama SOLO el webhook. Es el único sitio donde el saldo sube. */
export async function confirmarPagoRecarga(
  stripeEventId: string,
  eventType: string,
  sessionId: string,
  paymentIntentId: string | null
): Promise<ResultadoConfirmacion> {
  if (!servicioDisponible()) return { ok: false, mensaje: "servicio no configurado" };

  const { data, error } = await crearClienteServicio().rpc("confirmar_recarga", {
    p_stripe_event_id: stripeEventId,
    p_event_type: eventType,
    p_session_id: sessionId,
    p_payment_intent_id: paymentIntentId,
  });

  if (error) return { ok: false, mensaje: error.message };

  const fila = (Array.isArray(data) ? data[0] : data) as
    | { saldo_cents: string; ya_procesado: boolean; cafe_otorgado: boolean }
    | undefined;

  return {
    ok: true,
    yaProcesado: fila?.ya_procesado ?? false,
    cafeOtorgado: fila?.cafe_otorgado ?? false,
    saldoCents: Number(fila?.saldo_cents ?? 0),
  };
}

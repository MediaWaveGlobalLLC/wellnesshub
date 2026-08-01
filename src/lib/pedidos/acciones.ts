"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { crearClienteServidor } from "@/lib/supabase/server";
import { crearClienteServicio, servicioDisponible } from "@/lib/supabase/admin";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { enMinutos, limitar } from "@/lib/seguridad/rate-limit";
import { urlBaseDelSitio } from "@/lib/url-base";
import { crearCheckoutPedido } from "./service";

/**
 * Pedir del menú — `0021_pedidos.sql`.
 *
 * El carrito manda QUÉ quiere y CUÁNTAS unidades. Nunca cuánto cuesta: el
 * precio lo pone `crear_pedido` leyendo `menu_variantes` dentro de la misma
 * transacción (`CLAUDE.md` §5). Un carrito manipulado pide otra cosa, no paga
 * menos.
 */

const carritoSchema = z.object({
  items: z
    .array(
      z.object({
        varianteId: z.string().uuid(),
        cantidad: z.number().int().min(1, "Mínimo uno.").max(20, "Máximo 20 por línea."),
      })
    )
    .min(1, "Tu pedido está vacío.")
    .max(40, "Demasiadas líneas en un pedido."),
  /** Uno por intento de envío: evita que un doble toque cree dos pedidos. */
  clientRequestId: z.string().uuid().optional(),
  /**
   * Propina, en centavos. El ÚNICO importe del pedido que sí viene del
   * navegador, y con motivo: no tiene precio en el catálogo porque es una
   * decisión de quien paga sobre su propio dinero (`0026_propina.sql`).
   *
   * El tope de $100 está aquí y otra vez en SQL. No es desconfianza del
   * formulario: esta acción es una API, y quien llame por su cuenta se salta
   * este `zod` entero.
   */
  propinaCents: z
    .number()
    .int("La propina tiene que ser una cantidad exacta.")
    .min(0, "La propina no puede ser negativa.")
    .max(10000, "La propina máxima por pedido es $100.")
    .optional(),
});

const pagoSchema = z.object({ orderId: z.string().uuid() });

export type ResultadoPedido =
  | {
      ok: true;
      orderId: string;
      orderNumber: string;
      /** Lo que cuestan las líneas, sin propina. Es la base de los puntos. */
      subtotalCents: number;
      propinaCents: number;
      /** Subtotal + propina. Es lo que se cobra. */
      totalCents: number;
    }
  | { ok: false; error: string };

export type ResultadoPago =
  | { ok: true; modo: "saldo"; orderNumber: string; saldoRestante: number; puntos: number }
  | { ok: true; modo: "stripe"; checkoutUrl: string }
  | { ok: false; error: string };

const ERRORES: Record<string, string> = {
  carrito_vacio: "Tu pedido está vacío.",
  propina_invalida: "Esa propina no es válida. El máximo por pedido es $100.",
  carrito_demasiado_largo: "Demasiadas líneas en un pedido.",
  cantidad_invalida: "Alguna cantidad no es válida.",
  producto_no_encontrado: "Uno de los productos ya no está en el menú.",
  producto_agotado: "Uno de los productos se acaba de agotar. Quítalo y vuelve a intentarlo.",
  pedido_no_encontrado: "Ese pedido ya no existe.",
  pedido_ajeno: "Ese pedido no es tuyo.",
  pedido_ya_pagado: "Ese pedido ya está pagado.",
  saldo_insuficiente: "Tu saldo no cubre el pedido. Págalo con tarjeta.",
  insufficient_wallet_balance: "Tu saldo no cubre el pedido. Págalo con tarjeta.",
};

function traducir(mensaje: string): string {
  const clave = Object.keys(ERRORES).find((k) => mensaje.includes(k));
  return clave ? ERRORES[clave]! : "No pudimos completar la operación.";
}

async function sesion() {
  if (!supabaseConfigurado() || !servicioDisponible()) return null;
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Crea el pedido sin pagar. Devuelve el total que calculó el servidor. */
export async function crearPedido(datos: unknown): Promise<ResultadoPedido> {
  const parsed = carritoSchema.safeParse(datos);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa tu pedido." };
  }

  const user = await sesion();
  if (!user) return { ok: false, error: "Inicia sesión para pedir." };

  const veredicto = await limitar("crear_pedido", user.id);
  if (!veredicto.permitido) {
    return {
      ok: false,
      error: `Demasiados pedidos seguidos. Espera ${enMinutos(veredicto.reintentarEn)} minutos.`,
    };
  }

  const { data, error } = await crearClienteServicio().rpc("crear_pedido", {
    p_user_id: user.id,
    p_items: parsed.data.items.map((i) => ({
      variante_id: i.varianteId,
      cantidad: i.cantidad,
    })),
    p_client_request_id: parsed.data.clientRequestId ?? null,
    p_propina_cents: parsed.data.propinaCents ?? 0,
  });

  if (error) return { ok: false, error: traducir(error.message) };

  const fila = Array.isArray(data) ? data[0] : data;
  return {
    ok: true,
    orderId: fila.order_id,
    orderNumber: fila.order_number,
    subtotalCents: Number(fila.subtotal_cents),
    propinaCents: Number(fila.propina_cents),
    totalCents: Number(fila.total_cents),
  };
}

/** Paga con el saldo del wallet. O cubre el pedido entero, o no se usa. */
export async function pagarConSaldo(datos: unknown): Promise<ResultadoPago> {
  const parsed = pagoSchema.safeParse(datos);
  if (!parsed.success) return { ok: false, error: "No pudimos identificar ese pedido." };

  const user = await sesion();
  if (!user) return { ok: false, error: "Inicia sesión para pagar." };

  const { data, error } = await crearClienteServicio().rpc("pagar_pedido_con_saldo", {
    p_user_id: user.id,
    p_order_id: parsed.data.orderId,
  });

  if (error) return { ok: false, error: traducir(error.message) };

  const fila = Array.isArray(data) ? data[0] : data;

  revalidatePath("/perfil/pedidos");
  revalidatePath("/wallet");
  revalidatePath("/puntos");

  return {
    ok: true,
    modo: "saldo",
    orderNumber: fila.order_number,
    saldoRestante: Number(fila.saldo_restante),
    puntos: Number(fila.puntos_ganados),
  };
}

/** Abre el Checkout de Stripe. El pedido no se cierra hasta el webhook. */
export async function pagarConTarjeta(datos: unknown): Promise<ResultadoPago> {
  const parsed = pagoSchema.safeParse(datos);
  if (!parsed.success) return { ok: false, error: "No pudimos identificar ese pedido." };

  const user = await sesion();
  if (!user) return { ok: false, error: "Inicia sesión para pagar." };

  // De la petición si no hay variable, y normalizada si la hay: un
  // `NEXT_PUBLIC_APP_URL` sin esquema hace que Stripe rechace la sesión.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const urlBase = urlBaseDelSitio(`${proto}://${host}`);

  const r = await crearCheckoutPedido(user.id, parsed.data.orderId, urlBase);
  if (!r.ok) return { ok: false, error: r.mensaje };

  return { ok: true, modo: "stripe", checkoutUrl: r.checkoutUrl };
}

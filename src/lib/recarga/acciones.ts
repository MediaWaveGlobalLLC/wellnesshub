"use server";

import { z } from "zod";
import { headers } from "next/headers";

import { crearClienteServidor } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { enMinutos, limitar } from "@/lib/seguridad/rate-limit";
import { urlBaseDelSitio } from "@/lib/url-base";
import { crearCheckoutRecarga, importeValido } from "./service";

/**
 * Recargar saldo — `0024_recarga_saldo.sql`.
 *
 * El cliente manda CUÁL de los importes ofrecidos quiere, no cuánto cuesta:
 * `crearCheckoutRecarga` lo comprueba contra la lista cerrada antes de construir
 * nada. Una petición manipulada pide otro importe, no paga menos.
 */

const recargaSchema = z.object({
  centavos: z
    .number()
    .int()
    .refine(importeValido, "Ese importe no está disponible."),
});

export type ResultadoRecarga =
  | { ok: true; checkoutUrl: string }
  | { ok: false; error: string };

async function sesion() {
  if (!supabaseConfigurado()) return null;
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function recargarSaldo(datos: unknown): Promise<ResultadoRecarga> {
  const parsed = recargaSchema.safeParse(datos);
  if (!parsed.success) return { ok: false, error: "Ese importe no está disponible." };

  const user = await sesion();
  if (!user) return { ok: false, error: "Inicia sesión para recargar." };

  /*
    Freno de intentos.

    Cada llamada crea una fila en `wallet_topups` y una sesión en Stripe. Sin
    tope, un bucle deja cientos de recargas pendientes y otras tantas sesiones
    abiertas en la cuenta de Stripe. Se reutiliza el cupo de `crear_pedido`: son
    la misma clase de acción —abrir un pago— y comparten el mismo riesgo, así
    que no hace falta una regla nueva en `rate_limit_reglas`.
  */
  const veredicto = await limitar("crear_pedido", user.id);
  if (!veredicto.permitido) {
    return {
      ok: false,
      error: `Demasiados intentos seguidos. Espera ${enMinutos(veredicto.reintentarEn)} minutos.`,
    };
  }

  // De la petición si no hay variable, y normalizada si la hay: un
  // `NEXT_PUBLIC_APP_URL` sin esquema hace que Stripe rechace la sesión.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const urlBase = urlBaseDelSitio(`${proto}://${host}`);

  const r = await crearCheckoutRecarga(user.id, parsed.data.centavos, urlBase);
  if (!r.ok) return { ok: false, error: r.mensaje };

  return { ok: true, checkoutUrl: r.checkoutUrl };
}

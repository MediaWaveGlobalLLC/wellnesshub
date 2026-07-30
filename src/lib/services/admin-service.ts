import "server-only";

import { crearClienteServidor } from "@/lib/supabase/server";
import { crearClienteServicio, servicioDisponible } from "@/lib/supabase/admin";

/**
 * Servicio administrativo — `docs/06`.
 *
 * Dos comprobaciones, en este orden y siempre server-side:
 *
 *  1. Hay sesión válida (`getUser`, que revalida el token contra Supabase).
 *  2. Ese usuario está en `admin_users`, una tabla privada sin políticas RLS.
 *
 * Nunca se mira `user_metadata`: lo escribe el propio cliente al registrarse y
 * cualquiera podría declararse administrador.
 */

export type Actor = { id: string; email: string | null };

/** Devuelve el actor si tiene permisos administrativos; si no, null. */
export async function exigirAdmin(): Promise<Actor | null> {
  if (!servicioDisponible()) return null;

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // La consulta va con service_role porque `admin_users` no es legible por
  // ningún rol de cliente: si lo fuera, la lista de administradores sería
  // pública.
  const servicio = crearClienteServicio();
  const { data } = await servicio
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (data) return { id: user.id, email: user.email ?? null };

  /*
   * Arranque en frío: sin ningún administrador en la tabla no habría forma de
   * nombrar al primero. `ADMIN_EMAIL_ALLOWLIST` (docs/13) permite ese primer
   * acceso y se auto-inscribe, de modo que a partir de ahí manda la tabla.
   * La variable es server-only: el usuario no puede alterarla.
   */
  const permitidos = (process.env.ADMIN_EMAIL_ALLOWLIST ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (user.email && permitidos.includes(user.email.toLowerCase())) {
    await servicio
      .from("admin_users")
      .upsert({ user_id: user.id, note: "alta por ADMIN_EMAIL_ALLOWLIST" }, { onConflict: "user_id" });
    return { id: user.id, email: user.email };
  }

  return null;
}

export type ResultadoAjuste =
  | { ok: true; transactionId: string; nuevoSaldo: number }
  | { ok: false; codigo: string; mensaje: string };

/** Traduce los errores de las funciones SQL a algo accionable. */
function traducir(mensaje: string): { codigo: string; mensaje: string } {
  if (mensaje.includes("no_autorizado")) {
    return { codigo: "no_autorizado", mensaje: "No tienes permisos para esta operación." };
  }
  if (mensaje.includes("motivo_obligatorio")) {
    return { codigo: "motivo_obligatorio", mensaje: "El motivo del ajuste es obligatorio." };
  }
  if (mensaje.includes("insufficient_wallet_balance")) {
    return { codigo: "saldo_insuficiente", mensaje: "El ajuste dejaría el saldo en negativo." };
  }
  if (mensaje.includes("insufficient_points")) {
    return { codigo: "puntos_insuficientes", mensaje: "El ajuste dejaría los puntos en negativo." };
  }
  if (mensaje.includes("amount_must_be_nonzero") || mensaje.includes("points_must_be_nonzero")) {
    return { codigo: "importe_cero", mensaje: "El ajuste no puede ser de cero." };
  }
  return { codigo: "ajuste_fallido", mensaje: "No pudimos aplicar el ajuste." };
}

export async function ajustarWallet(
  actor: Actor,
  targetUserId: string,
  amountCents: number,
  reason: string,
  reference: string | null,
  requestId: string
): Promise<ResultadoAjuste> {
  const servicio = crearClienteServicio();
  const { data, error } = await servicio.rpc("admin_ajustar_wallet", {
    p_actor_id: actor.id,
    p_target_id: targetUserId,
    p_amount_cents: amountCents,
    p_reason: reason,
    p_reference: reference,
    p_request_id: requestId,
  });

  if (error) return { ok: false, ...traducir(error.message) };

  const fila = Array.isArray(data) ? data[0] : data;
  return {
    ok: true,
    transactionId: fila.transaction_id,
    nuevoSaldo: Number(fila.new_balance_cents),
  };
}

export async function ajustarPuntos(
  actor: Actor,
  targetUserId: string,
  points: number,
  reason: string,
  reference: string | null,
  requestId: string
): Promise<ResultadoAjuste> {
  const servicio = crearClienteServicio();
  const { data, error } = await servicio.rpc("admin_ajustar_puntos", {
    p_actor_id: actor.id,
    p_target_id: targetUserId,
    p_points: points,
    p_reason: reason,
    p_reference: reference,
    p_request_id: requestId,
  });

  if (error) return { ok: false, ...traducir(error.message) };

  const fila = Array.isArray(data) ? data[0] : data;
  return {
    ok: true,
    transactionId: fila.transaction_id,
    nuevoSaldo: Number(fila.new_points_balance),
  };
}

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { crearClienteServidor } from "@/lib/supabase/server";
import { crearClienteServicio, servicioDisponible } from "@/lib/supabase/admin";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { enMinutos, limitar } from "@/lib/seguridad/rate-limit";

/**
 * Canje de recompensas desde la cuenta — `0020_recompensas.sql`.
 *
 * La sesión se comprueba aquí y el canje lo ejecuta `canjear_recompensa`, que
 * está revocada para `anon` y `authenticated`: el navegador no puede llamarla
 * ni aunque tuviera el id de la recompensa. El descuento de puntos, la fila del
 * canje y la auditoría ocurren en la misma transacción SQL.
 */

const canjeSchema = z.object({
  rewardId: z.string().uuid(),
  /*
    Lo genera el navegador una vez por intento de envío. Es lo que hace que un
    doble toque no cobre dos veces los puntos: la función SQL lo mete en la clave
    de idempotencia del ledger.
  */
  clientRequestId: z.string().uuid().optional(),
});

export type ResultadoCanje =
  | { ok: true; codigo: string; nombre: string; puntosRestantes: number }
  | { ok: false; error: string };

const ERRORES: Record<string, string> = {
  recompensa_no_encontrada: "Esa recompensa ya no está disponible.",
  recompensa_inactiva: "Esa recompensa ya no está disponible.",
  recompensa_agotada: "Se acabaron las unidades de esa recompensa.",
  puntos_insuficientes: "Todavía no tienes puntos suficientes para eso.",
  insufficient_points: "Todavía no tienes puntos suficientes para eso.",
};

export async function canjearRecompensa(datos: unknown): Promise<ResultadoCanje> {
  const parsed = canjeSchema.safeParse(datos);
  if (!parsed.success) return { ok: false, error: "No pudimos identificar esa recompensa." };

  if (!supabaseConfigurado() || !servicioDisponible()) {
    return { ok: false, error: "El canje no está disponible ahora mismo." };
  }

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Inicia sesión para canjear." };

  /*
    Freno por persona. Sin él, un bucle podría vaciar el catálogo de existencias
    limitadas más rápido de lo que nadie puede reaccionar. El cupo va por usuario
    porque es quien firma el canje.
  */
  const veredicto = await limitar("canje_recompensa", user.id);
  if (!veredicto.permitido) {
    return {
      ok: false,
      error: `Demasiados canjes seguidos. Espera ${enMinutos(veredicto.reintentarEn)} minutos.`,
    };
  }

  const { data, error } = await crearClienteServicio().rpc("canjear_recompensa", {
    p_user_id: user.id,
    p_reward_id: parsed.data.rewardId,
    p_client_request_id: parsed.data.clientRequestId ?? null,
  });

  if (error) {
    const clave = Object.keys(ERRORES).find((k) => error.message.includes(k));
    return { ok: false, error: clave ? ERRORES[clave]! : "No pudimos completar el canje." };
  }

  const fila = Array.isArray(data) ? data[0] : data;

  // El saldo de puntos y la lista de canjes los pinta el servidor.
  revalidatePath("/puntos");
  revalidatePath("/perfil");

  return {
    ok: true,
    codigo: fila.codigo,
    nombre: fila.nombre,
    puntosRestantes: Number(fila.puntos_restantes),
  };
}

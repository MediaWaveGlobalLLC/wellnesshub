"use server";

import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/env";

/**
 * Alta en la comunidad — bloque terracota de la home (mockup 04).
 *
 * Guarda de verdad en `newsletter_subscribers`. Un formulario que acepta un
 * correo y no lo persiste engaña a quien lo rellena.
 */
const suscripcionSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Escribe tu correo.")
    .email("Introduce un correo electrónico válido.")
    .max(254, "El correo es demasiado largo."),
});

export type ResultadoSuscripcion =
  | { ok: true; mensaje: string }
  | { ok: false; mensaje: string };

export async function suscribirse(
  _previo: ResultadoSuscripcion | null,
  formData: FormData
): Promise<ResultadoSuscripcion> {
  const parsed = suscripcionSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return { ok: false, mensaje: parsed.error.issues[0]?.message ?? "Revisa el correo." };
  }

  if (!supabaseConfigurado()) {
    return { ok: false, mensaje: "No pudimos completar el registro ahora mismo. Inténtalo más tarde." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("newsletter_subscribers")
    .insert({ email: parsed.data.email, source: "home" });

  // Clave duplicada: ya estaba suscrito. Se responde igual que en el alta nueva
  // para no revelar qué correos están en la lista.
  if (error && error.code !== "23505") {
    return { ok: false, mensaje: "No pudimos completar el registro. Inténtalo de nuevo." };
  }

  return { ok: true, mensaje: "¡Listo! Te escribiremos con novedades y beneficios." };
}

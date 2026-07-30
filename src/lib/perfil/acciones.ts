"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { editarPerfilSchema, favoritoSchema, reservaSchema } from "@/lib/validation/perfil";
import { buscarItem } from "@/lib/menu";
import type { ResultadoAccion } from "@/lib/auth/acciones";

/**
 * Server actions del perfil.
 *
 * Todas se ejecutan con la sesión del usuario, así que RLS es quien impide
 * tocar datos ajenos: ninguna filtra por `user_id` a mano y por tanto ninguna
 * puede olvidarse de hacerlo. Lo único que se comprueba aquí es que haya sesión
 * y que el payload sea válido (`docs/06`).
 */

const SIN_SESION: ResultadoAccion = {
  ok: false,
  error: { code: "sesion_requerida", message: "Inicia sesión para continuar." },
};

const SIN_CONFIG: ResultadoAccion = {
  ok: false,
  error: {
    code: "supabase_no_configurado",
    message: "El servicio de cuentas no está disponible ahora mismo.",
  },
};

async function sesion() {
  if (!supabaseConfigurado()) return null;
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

/* ── Datos y preferencias ────────────────────────────────────────────────── */

export async function actualizarPerfil(
  _previo: ResultadoAccion | null,
  formData: FormData
): Promise<ResultadoAccion> {
  const parsed = editarPerfilSchema.safeParse({
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    marketingOptIn: formData.get("marketingOptIn") === "on",
  });

  if (!parsed.success) {
    const { fieldErrors } = parsed.error.flatten();
    const limpio: Record<string, string[]> = {};
    for (const [campo, mensajes] of Object.entries(fieldErrors)) {
      if (mensajes?.length) limpio[campo] = mensajes;
    }
    return {
      ok: false,
      error: { code: "validacion", message: "Revisa los campos marcados.", fieldErrors: limpio },
    };
  }

  if (!supabaseConfigurado()) return SIN_CONFIG;
  const ctx = await sesion();
  if (!ctx) return SIN_SESION;

  const { error } = await ctx.supabase
    .from("profiles")
    .update({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      phone: parsed.data.phone,
      marketing_email_opt_in: parsed.data.marketingOptIn,
    })
    .eq("id", ctx.user.id);

  if (error) {
    return {
      ok: false,
      error: { code: "guardado_fallido", message: "No pudimos guardar los cambios. Inténtalo de nuevo." },
    };
  }

  revalidatePath("/perfil");
  revalidatePath("/perfil/editar");
  return { ok: true, mensaje: "Datos actualizados." };
}

/* ── Favoritos ───────────────────────────────────────────────────────────── */

export async function alternarFavorito(slug: string): Promise<ResultadoAccion> {
  const parsed = favoritoSchema.safeParse({ slug });
  if (!parsed.success) {
    return { ok: false, error: { code: "slug_invalido", message: "Producto no válido." } };
  }

  // El slug debe existir en el menú: así no se guardan favoritos huérfanos.
  if (!buscarItem(parsed.data.slug)) {
    return { ok: false, error: { code: "no_existe", message: "Ese producto ya no está en el menú." } };
  }

  if (!supabaseConfigurado()) return SIN_CONFIG;
  const ctx = await sesion();
  if (!ctx) return SIN_SESION;

  const { data: existente } = await ctx.supabase
    .from("favorites")
    .select("item_slug")
    .eq("user_id", ctx.user.id)
    .eq("item_slug", parsed.data.slug)
    .maybeSingle();

  const { error } = existente
    ? await ctx.supabase
        .from("favorites")
        .delete()
        .eq("user_id", ctx.user.id)
        .eq("item_slug", parsed.data.slug)
    : await ctx.supabase
        .from("favorites")
        .insert({ user_id: ctx.user.id, item_slug: parsed.data.slug });

  if (error) {
    return { ok: false, error: { code: "favorito_fallido", message: "No pudimos guardar el cambio." } };
  }

  revalidatePath("/perfil");
  revalidatePath("/perfil/favoritos");
  return { ok: true };
}

/* ── Reservas de eventos ─────────────────────────────────────────────────── */

export async function reservarEvento(eventId: string): Promise<ResultadoAccion> {
  const parsed = reservaSchema.safeParse({ eventId });
  if (!parsed.success) {
    return { ok: false, error: { code: "evento_invalido", message: "Evento no válido." } };
  }

  if (!supabaseConfigurado()) return SIN_CONFIG;
  const ctx = await sesion();
  if (!ctx) return SIN_SESION;

  // Reactivar una reserva cancelada en vez de crear otra: la restricción
  // (user_id, event_id) es única.
  const { error } = await ctx.supabase
    .from("event_bookings")
    .upsert(
      { user_id: ctx.user.id, event_id: parsed.data.eventId, status: "confirmada" },
      { onConflict: "user_id,event_id" }
    );

  if (error) {
    return { ok: false, error: { code: "reserva_fallida", message: "No pudimos completar la reserva." } };
  }

  revalidatePath("/perfil");
  revalidatePath("/perfil/eventos");
  return { ok: true, mensaje: "Reserva confirmada." };
}

export async function cancelarReserva(eventId: string): Promise<ResultadoAccion> {
  const parsed = reservaSchema.safeParse({ eventId });
  if (!parsed.success) {
    return { ok: false, error: { code: "evento_invalido", message: "Evento no válido." } };
  }

  if (!supabaseConfigurado()) return SIN_CONFIG;
  const ctx = await sesion();
  if (!ctx) return SIN_SESION;

  // RLS solo admite 'confirmada' o 'cancelada' desde el cliente: marcar
  // asistencia es cosa del personal.
  const { error } = await ctx.supabase
    .from("event_bookings")
    .update({ status: "cancelada" })
    .eq("user_id", ctx.user.id)
    .eq("event_id", parsed.data.eventId);

  if (error) {
    return { ok: false, error: { code: "cancelacion_fallida", message: "No pudimos cancelar la reserva." } };
  }

  revalidatePath("/perfil");
  revalidatePath("/perfil/eventos");
  return { ok: true, mensaje: "Reserva cancelada." };
}

import { z } from "zod";

/**
 * Edición de perfil — `docs/00`: datos personales y preferencias de
 * comunicación.
 *
 * `member_id`, `id` y `created_at` no aparecen aquí a propósito: son identidad,
 * no datos editables, y el trigger `protect_profile_columns` (migración 0004)
 * los restaura si el cliente intenta cambiarlos. La validación y la base dicen
 * lo mismo.
 */

const nombre = z
  .string()
  .trim()
  .min(2, "Debe tener al menos 2 caracteres.")
  .max(60, "Máximo 60 caracteres.")
  .regex(/^[\p{L}\p{M}'’\- ]+$/u, "Solo letras, espacios y guiones.");

/** Teléfono de Puerto Rico, normalizado a E.164 como en el registro. */
const telefono = z
  .string()
  .trim()
  .transform((valor) => valor.replace(/[^\d+]/g, ""))
  .refine((valor) => /^\+?1?\d{10}$/.test(valor), "Introduce un teléfono válido de 10 dígitos.")
  .transform((valor) => `+1${valor.replace(/\D/g, "").slice(-10)}`);

export const editarPerfilSchema = z.object({
  firstName: nombre,
  lastName: nombre,
  phone: telefono,
  marketingOptIn: z.boolean().optional().default(false),
});

export type EditarPerfilInput = z.infer<typeof editarPerfilSchema>;

/** Slug de producto del menú — `favorites.item_slug`. */
export const favoritoSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Slug no válido."),
});

export const reservaSchema = z.object({
  eventId: z.string().uuid("Evento no válido."),
});

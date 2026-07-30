import { z } from "zod";

import { motivo } from "./catalogo";

/**
 * Validación de las operaciones del panel — `0017_operaciones_admin.sql`.
 *
 * Reutiliza `motivo` del catálogo: es el mismo contrato —mínimo seis
 * caracteres, máximo cuatrocientos— y tener dos definiciones del mismo campo es
 * como acaban divergiendo.
 *
 * Como en el catálogo, se valida aquí Y en SQL. Lo de aquí sirve para devolver
 * un error por campo; lo de allí es lo que de verdad no se puede saltar.
 */

/* ── Gift cards ──────────────────────────────────────────────────────────── */

export const anularGiftCardSchema = z.object({
  giftCardId: z.string().uuid(),
  reason: motivo,
});

export const reactivarGiftCardSchema = anularGiftCardSchema;

export const rotarCodigoSchema = anularGiftCardSchema;

/* ── Eventos ─────────────────────────────────────────────────────────────── */

/**
 * Fecha y hora tal y como las manda `<input type="datetime-local">`, que NO
 * lleva zona: «2026-08-14T18:00».
 *
 * Se interpreta en hora de Puerto Rico, no en la del navegador. Es la diferencia
 * entre programar un taller a las seis de la tarde en Condado y programarlo a
 * las seis de la tarde de quien lo esté creando desde otro sitio.
 *
 * Puerto Rico es UTC-4 todo el año y no tiene horario de verano, así que el
 * desplazamiento es una constante y no hace falta una biblioteca de zonas.
 */
const DESFASE_PR = "-04:00";

export const fechaHoraPR = z
  .string()
  .trim()
  .min(1, "Falta la fecha.")
  .refine((v) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v), "Fecha u hora incompletas.")
  .transform((v) => `${v}:00${DESFASE_PR}`)
  .refine((v) => !Number.isNaN(Date.parse(v)), "Esa fecha no existe.");

/** Igual, pero opcional: un evento puede no tener hora de fin. */
export const fechaHoraPROpcional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine(
    (v) => v === null || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v),
    "Fecha u hora incompletas."
  )
  .transform((v) => (v === null ? null : `${v}:00${DESFASE_PR}`));

/**
 * Aforo: vacío significa «sin límite», que es lo que guarda la columna como
 * `null`. Un cero sería un evento al que no puede entrar nadie.
 */
export const aforo = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || /^\d+$/.test(v), "Solo números enteros.")
  .transform((v) => (v === null ? null : Number(v)))
  .refine((v) => v === null || (v > 0 && v <= 1000), "Entre 1 y 1.000, o vacío si no hay límite.");

const camposEvento = {
  titulo: z.string().trim().min(3, "Mínimo tres caracteres.").max(120, "Demasiado largo."),
  descripcion: z.string().trim().max(600, "Demasiado larga.").optional(),
  iniciaAt: fechaHoraPR,
  terminaAt: fechaHoraPROpcional,
  lugar: z.string().trim().max(120, "Demasiado largo.").optional(),
  aforo,
  reason: motivo,
};

/**
 * El slug se deriva del título, con la misma forma que exige el CHECK de la
 * migración: minúsculas, números y guiones.
 */
export function slugDeEvento(titulo: string): string {
  return titulo
    .normalize("NFD")
    // Quita los diacríticos: «Sesión de té» → «sesion-de-te». La clase de
    // caracteres es el bloque combinante U+0300–U+036F; en pantalla se ve
    // pegado a los corchetes porque son marcas que no ocupan hueco propio.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export const crearEventoSchema = z.object({
  ...camposEvento,
  publicado: z.boolean(),
});

export const editarEventoSchema = z.object({
  eventoId: z.string().uuid(),
  ...camposEvento,
});

export const publicarEventoSchema = z.object({
  eventoId: z.string().uuid(),
  publicado: z.boolean(),
  reason: motivo,
});

export const borrarEventoSchema = z.object({
  eventoId: z.string().uuid(),
  reason: motivo,
});

/**
 * Asistencia SIN motivo, a propósito.
 *
 * Es el mismo criterio que el agotado del catálogo: pedir seis caracteres por
 * cada persona que entra por la puerta, veinte veces en una tarde, garantiza un
 * «xxxxxx». La acción y el estado ya cuentan la historia entera.
 */
export const asistenciaSchema = z.object({
  reservaId: z.string().uuid(),
  estado: z.enum(["confirmada", "asistio", "ausente"]),
});

/* ── Administradoras ─────────────────────────────────────────────────────── */

export const rolAdmin = z.enum(["duena", "empleado"]);

export const concederAdminSchema = z.object({
  // El correo se busca en `profiles`: solo se puede nombrar a alguien que ya
  // tiene cuenta, porque `admin_users.user_id` apunta a `auth.users`.
  email: z.string().trim().toLowerCase().email("Escribe un correo válido."),
  rol: rolAdmin,
  nota: z.string().trim().max(200, "Demasiado larga.").optional(),
});

export const revocarAdminSchema = z.object({
  userId: z.string().uuid(),
  reason: motivo,
});

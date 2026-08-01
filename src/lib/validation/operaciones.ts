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

/**
 * Tope por recarga. El mismo que el ajuste de wallet y por la misma razón: no
 * es una regla de negocio, es un freno ante un dedo torpe. `0019` lo repite en
 * SQL, que es donde de verdad no se puede saltar.
 */
export const TOPE_RECARGA_CENTAVOS = 500_000;

/**
 * Recarga de una tarjeta — `0019_gift_cards_recargables.sql`.
 *
 * Esto añade saldo sin ningún cobro detrás, así que lleva los mismos frenos que
 * un ajuste de wallet: solo la dueña, motivo obligatorio y tope por operación.
 */
export const recargaGiftCardSchema = z.object({
  giftCardId: z.string().uuid(),
  amountCents: z
    .number({ message: "Escribe cuánto saldo añadir." })
    .int("Los importes van en centavos enteros, nunca decimales.")
    .positive("La recarga tiene que ser mayor que cero.")
    .max(
      TOPE_RECARGA_CENTAVOS,
      `Una sola recarga no puede superar $${TOPE_RECARGA_CENTAVOS / 100}.`
    ),
  reason: motivo,
});

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

/* ── Lealtad ─────────────────────────────────────────────────────────────── */

/**
 * Puntos de una regla o umbral de un nivel.
 *
 * El tope de 100.000 no es una regla de negocio: es el mismo freno que tiene la
 * columna en la base (`0018`). El bono de bienvenida se lo lleva cada cuenta
 * nueva, y un dedo torpe escribiendo un cero de más lo reparte a todo el que se
 * registre a partir de ese momento. Los movimientos de lealtad son inmutables,
 * así que deshacerlo son mil correcciones, no un `update`.
 */
const puntosRegla = z
  .string()
  .trim()
  .min(1, "Escribe cuántos puntos.")
  .refine((v) => /^\d+$/.test(v), "Solo números enteros.")
  .transform((v) => Number(v))
  .refine((n) => n > 0 && n <= 100_000, "Entre 1 y 100.000.");

export const editarReglaSchema = z.object({
  // La clave es del catálogo de reglas, no un uuid: `por_dolar`, `bebida`…
  clave: z.string().trim().regex(/^[a-z_]{3,40}$/, "Regla no válida."),
  puntos: puntosRegla,
  etiqueta: z.string().trim().min(3, "Mínimo tres caracteres.").max(80, "Demasiado larga."),
  activa: z.boolean(),
  reason: motivo,
});

export const editarNivelSchema = z.object({
  clave: z.enum(["semilla", "brote", "raiz", "florecer"]),
  etiqueta: z.string().trim().min(3, "Mínimo tres caracteres.").max(40, "Demasiado larga."),
  // Aquí sí se acepta el cero: el primer nivel TIENE que empezar en cero, o
  // habría gente sin ningún nivel.
  minimo: z
    .string()
    .trim()
    .min(1, "Escribe el mínimo.")
    .refine((v) => /^\d+$/.test(v), "Solo números enteros.")
    .transform((v) => Number(v))
    .refine((n) => n <= 1_000_000, "Demasiado alto."),
  descripcion: z.string().trim().max(200, "Demasiado larga.").optional(),
  reason: motivo,
});

/** Aplicar una regla manual. Sin importe ni motivo: los pone la regla. */
export const aplicarReglaSchema = z.object({
  userId: z.string().uuid(),
  clave: z.string().trim().regex(/^[a-z_]{3,40}$/, "Regla no válida."),
});

/* ── Recompensas — `0020_recompensas.sql` ────────────────────────────────── */

/** El mismo tope que un ajuste de puntos. La función SQL lo repite. */
export const TOPE_COSTO_PUNTOS = 100_000;

export const recompensaSchema = z.object({
  /** Ausente = alta. Presente = edición. */
  rewardId: z.string().uuid().optional(),
  nombre: z.string().trim().min(2, "Escribe el nombre de la recompensa.").max(80, "Máximo 80 caracteres."),
  descripcion: z
    .string()
    .trim()
    .max(160, "Máximo 160 caracteres.")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  costoPuntos: z
    .number({ message: "Escribe cuántos puntos cuesta." })
    .int("Los puntos son enteros.")
    .positive("El coste tiene que ser mayor que cero.")
    .max(TOPE_COSTO_PUNTOS, `Una recompensa no puede costar más de ${TOPE_COSTO_PUNTOS} puntos.`),
  /**
   * Clave del manifiesto de marca, nunca una URL: `docs/01` prohíbe imágenes
   * remotas o inventadas, y guardar la clave hace que solo se pueda apuntar a un
   * asset ya aprobado y versionado.
   */
  imagenClave: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  /** `null` = sin límite, que es lo normal en un café. */
  existencias: z
    .number()
    .int("Las existencias son enteras.")
    .min(0, "No pueden ser negativas.")
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? null : v)),
  orden: z.number().int().min(0).optional().transform((v) => v ?? 0),
  activa: z.boolean().optional().transform((v) => v ?? true),
  reason: motivo,
});

export const entregarCanjeSchema = z.object({
  redemptionId: z.string().uuid(),
});

/* ── Pedidos — `0021_pedidos.sql` ────────────────────────────────────────── */

export const avanzarPedidoSchema = z.object({
  orderId: z.string().uuid(),
  /** Solo avanza. Un pedido entregado no vuelve atrás. */
  estado: z.enum(["preparando", "entregado"]),
});

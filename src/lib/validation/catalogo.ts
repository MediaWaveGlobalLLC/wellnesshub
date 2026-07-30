import { z } from "zod";

/**
 * Validación de la edición del catálogo.
 *
 * Se valida aquí Y en SQL. No es redundancia: la función de base de datos es la
 * que de verdad no se puede saltar, y esto es lo que permite devolver un error
 * por campo en vez de una excepción de Postgres.
 */

/** Motivo libre. Mismo criterio que los ajustes de saldo (`validation/admin.ts`). */
export const motivo = z
  .string()
  .trim()
  .min(6, "Explica el cambio en unas palabras.")
  .max(400, "Demasiado largo.");

/**
 * Motivo de agotado: lista cerrada, no texto libre.
 *
 * Pedirle a alguien del mostrador que escriba seis caracteres cada vez que se
 * acaba algo, diez veces en una mañana, garantiza que acabe tecleando «xxxxxx».
 * Entonces la auditoría existe pero no dice nada. Con una lista, un clic deja
 * un motivo real.
 */
export const MOTIVOS_DISPONIBILIDAD = [
  "Se acabó hoy",
  "Fuera de temporada",
  "Error en la carta",
  "Vuelve a estar disponible",
] as const;

export const motivoDisponibilidad = z.enum(MOTIVOS_DISPONIBILIDAD);

/**
 * Precio en dólares tal y como se teclea, convertido a centavos enteros.
 *
 * Acepta coma decimal. El tope de $1.000 no es una regla de negocio: es un
 * freno ante un dedo torpe que teclee 875 pensando en centavos y ponga un café
 * a ochocientos setenta y cinco dólares.
 */
export const precioDolares = z
  .string()
  .trim()
  .min(1, "Escribe un precio.")
  .transform((v) => v.replace(",", "."))
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Solo números, con hasta dos decimales.")
  .transform((v) => Math.round(Number(v) * 100))
  .refine((c) => c >= 0 && c <= 100_000, "El precio debe estar entre $0 y $1,000.");

export const precioSchema = z.object({
  varianteId: z.string().uuid(),
  precioCents: precioDolares,
  reason: motivo,
});

export const disponibilidadSchema = z.object({
  productoId: z.string().uuid(),
  disponible: z.boolean(),
  reason: motivoDisponibilidad,
});

export const editarProductoSchema = z.object({
  productoId: z.string().uuid(),
  nombre: z.string().trim().min(2, "Mínimo dos caracteres.").max(80, "Demasiado largo."),
  nota: z.string().trim().max(120, "Demasiado larga.").optional(),
  destacado: z.boolean(),
  reason: motivo,
});

export const archivarSchema = z.object({
  productoId: z.string().uuid(),
  archivar: z.boolean(),
  reason: motivo,
});

export const crearProductoSchema = z.object({
  categoriaId: z.string().uuid(),
  nombre: z.string().trim().min(2, "Mínimo dos caracteres.").max(80, "Demasiado largo."),
  nota: z.string().trim().max(120).optional(),
  destacado: z.boolean(),
  // Entre una y cuatro: sin ninguna no tendría precio, y más de cuatro tamaños
  // en una carta de cafetería no es un menú, es un formulario.
  variantes: z
    .array(
      z.object({
        etiqueta: z.string().trim().max(20).optional(),
        precioCents: precioDolares,
      })
    )
    .min(1, "Hace falta al menos un precio.")
    .max(4, "Máximo cuatro tamaños."),
  reason: motivo,
});

export const reordenarSchema = z.object({
  tipo: z.enum(["producto", "categoria", "variante"]),
  ids: z.array(z.string().uuid()).min(1),
  reason: motivo,
});

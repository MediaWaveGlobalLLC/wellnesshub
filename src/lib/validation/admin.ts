import { z } from "zod";

/**
 * Ajustes administrativos — `docs/05`.
 *
 * El motivo es obligatorio y no puede quedar en blanco: es lo que hace legible
 * el audit log meses después. La función SQL lo vuelve a exigir, así que no hay
 * ninguna ruta que pueda saltárselo.
 */

const motivo = z
  .string()
  .trim()
  .min(6, "Explica el motivo del ajuste (mínimo 6 caracteres).")
  .max(400, "Máximo 400 caracteres.");

const referencia = z
  .string()
  .trim()
  .max(120, "Máximo 120 caracteres.")
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));

/**
 * Tope por operación. No es una regla de negocio del cliente, es un freno ante
 * un dedo torpe: mover $5.000 de golpe debería costar más de un clic.
 */
const TOPE_CENTAVOS = 500_000;

export const ajusteWalletSchema = z.object({
  amountCents: z
    .number({ message: "El importe debe ser un número entero de centavos." })
    .int("Los importes van en centavos enteros, nunca decimales.")
    .refine((v) => v !== 0, "El ajuste no puede ser de cero.")
    .refine(
      (v) => Math.abs(v) <= TOPE_CENTAVOS,
      `Un solo ajuste no puede superar ${TOPE_CENTAVOS / 100} USD.`
    ),
  reason: motivo,
  reference: referencia,
});

const TOPE_PUNTOS = 100_000;

export const ajustePuntosSchema = z.object({
  points: z
    .number({ message: "Los puntos deben ser un número entero." })
    .int("Los puntos son enteros.")
    .refine((v) => v !== 0, "El ajuste no puede ser de cero.")
    .refine((v) => Math.abs(v) <= TOPE_PUNTOS, `Un solo ajuste no puede superar ${TOPE_PUNTOS} puntos.`),
  reason: motivo,
  reference: referencia,
});

export const usuarioIdSchema = z.string().uuid("Identificador de usuario no válido.");

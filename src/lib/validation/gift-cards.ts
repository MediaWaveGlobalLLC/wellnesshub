import { z } from "zod";

/**
 * Compra y canje de gift cards — `docs/05`.
 *
 * El importe NUNCA llega desde un producto oculto ni desde un precio del
 * cliente: se valida contra los presets o contra los límites del rango
 * personalizado, y es lo único con lo que se construye la sesión de Stripe.
 */

/** Presets del mockup 03 y de `docs/05`, en centavos. */
export const MONTOS_PRESET = [2500, 5000, 7500, 10000] as const;

/** Límites del importe personalizado. Server-side, no negociables desde la UI. */
export const MONTO_MINIMO = 1000; // $10
export const MONTO_MAXIMO = 50000; // $500

export const checkoutSchema = z
  .object({
    amountCents: z
      .number({ message: "Elige un monto." })
      .int("El monto va en centavos enteros.")
      .min(MONTO_MINIMO, `El mínimo es $${MONTO_MINIMO / 100}.`)
      .max(MONTO_MAXIMO, `El máximo es $${MONTO_MAXIMO / 100}.`),
    format: z.enum(["digital", "physical"], { message: "Elige un formato." }),
    recipientName: z
      .string()
      .trim()
      .min(2, "Escribe el nombre de quien la recibe.")
      .max(80, "Máximo 80 caracteres."),
    recipientEmail: z
      .string()
      .trim()
      .toLowerCase()
      .email("Introduce un correo válido.")
      .max(254)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    message: z
      .string()
      .trim()
      .max(120, "Máximo 120 caracteres.")
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  // El formato digital se entrega por correo: sin dirección no hay entrega.
  .refine((d) => d.format !== "digital" || Boolean(d.recipientEmail), {
    message: "Para el formato digital necesitamos el correo de quien la recibe.",
    path: ["recipientEmail"],
  });

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const canjeSchema = z.object({
  code: z.string().trim().min(1, "Escribe el código de tu gift card.").max(60),
});

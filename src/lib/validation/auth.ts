import { z } from "zod";

/**
 * Schemas de autenticación — docs/03 los sitúa en `src/lib/validation/`.
 *
 * Se comparten entre cliente y servidor: el cliente los usa para validación
 * inline y el servidor SIEMPRE vuelve a validar antes de tocar la base de datos
 * (docs/06). Nunca se confía en la validación del navegador.
 *
 * Los mensajes están en español porque son visibles en la UI (plan D15).
 */

const nombre = z
  .string()
  .trim()
  .min(2, "Debe tener al menos 2 caracteres.")
  .max(60, "Máximo 60 caracteres.")
  // Letras con acentos, ñ, apóstrofo, guion y espacio. Sin dígitos ni símbolos.
  .regex(/^[\p{L}\p{M}'’\- ]+$/u, "Solo letras, espacios y guiones.");

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "El correo es obligatorio.")
  .email("Introduce un correo electrónico válido.")
  .max(254, "El correo es demasiado largo.");

/**
 * Teléfono de Puerto Rico. Se acepta como lo escribe la gente —(939) 835-0044,
 * 939-835-0044, +1 939 835 0044— y se normaliza a E.164 para almacenarlo.
 */
const telefono = z
  .string()
  .trim()
  .transform((valor) => valor.replace(/[^\d+]/g, ""))
  .refine(
    (valor) => /^\+?1?\d{10}$/.test(valor),
    "Introduce un teléfono válido de 10 dígitos."
  )
  .transform((valor) => {
    const digitos = valor.replace(/\D/g, "").slice(-10);
    return `+1${digitos}`;
  });

/**
 * Contraseña. El mínimo de Supabase es 6; aquí se sube a 8 y se exige mezcla,
 * que es lo mínimo razonable para una cuenta con saldo monetario asociado.
 */
const password = z
  .string()
  .min(8, "Debe tener al menos 8 caracteres.")
  .max(72, "Máximo 72 caracteres.")
  .regex(/[a-záéíóúñ]/i, "Debe incluir al menos una letra.")
  .regex(/\d/, "Debe incluir al menos un número.");

export const registroSchema = z
  .object({
    firstName: nombre,
    lastName: nombre,
    email,
    phone: telefono,
    password,
    confirmPassword: z.string(),
    // El consentimiento es obligatorio — docs/00.
    acceptTerms: z
      .boolean()
      .refine((v) => v === true, "Debes aceptar los términos para continuar."),
    marketingOptIn: z.boolean().optional().default(false),
  })
  .refine((datos) => datos.password === datos.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "La contraseña es obligatoria."),
  // Destino tras entrar. Solo rutas internas: una URL absoluta sería un open
  // redirect (docs/06).
  siguiente: z
    .string()
    .optional()
    .refine(
      (v) => !v || (v.startsWith("/") && !v.startsWith("//")),
      "Destino no permitido."
    ),
});

export const solicitarResetSchema = z.object({ email });

export const nuevaPasswordSchema = z
  .object({
    password,
    confirmPassword: z.string(),
  })
  .refine((datos) => datos.password === datos.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

export type RegistroInput = z.infer<typeof registroSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SolicitarResetInput = z.infer<typeof solicitarResetSchema>;
export type NuevaPasswordInput = z.infer<typeof nuevaPasswordSchema>;

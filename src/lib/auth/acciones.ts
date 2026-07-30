"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { crearClienteServidor } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/env";
import {
  loginSchema,
  nuevaPasswordSchema,
  registroSchema,
  solicitarResetSchema,
} from "@/lib/validation/auth";

/**
 * Server actions de autenticación.
 *
 * Todas validan el payload en el servidor aunque el cliente ya haya validado
 * (docs/06). Devuelven un resultado tipado en lugar de lanzar, para que el
 * formulario pueda pintar errores por campo sin perder lo escrito.
 */
export type ResultadoAccion =
  | { ok: true; mensaje?: string }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        fieldErrors?: Record<string, string[]>;
      };
    };

const SIN_CONFIG: ResultadoAccion = {
  ok: false,
  error: {
    code: "supabase_no_configurado",
    message:
      "El sistema de cuentas todavía no está conectado. Inténtalo de nuevo en unos minutos.",
  },
};

/** URL absoluta del sitio, para los enlaces de verificación y reset. */
async function urlBase(): Promise<string> {
  const configurada = process.env.NEXT_PUBLIC_APP_URL;
  if (configurada) return configurada.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function deZod(error: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } }): ResultadoAccion {
  const { fieldErrors } = error.flatten();
  const limpio: Record<string, string[]> = {};
  for (const [campo, mensajes] of Object.entries(fieldErrors)) {
    if (mensajes?.length) limpio[campo] = mensajes;
  }
  return {
    ok: false,
    error: {
      code: "validacion",
      message: "Revisa los campos marcados.",
      fieldErrors: limpio,
    },
  };
}

export async function registrarse(datos: unknown): Promise<ResultadoAccion> {
  const parsed = registroSchema.safeParse(datos);
  if (!parsed.success) return deZod(parsed.error);
  if (!supabaseConfigurado()) return SIN_CONFIG;

  const { email, password, firstName, lastName, phone, marketingOptIn } = parsed.data;
  const supabase = await crearClienteServidor();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // El trigger handle_new_user lee estos campos para crear profiles,
      // wallets y loyalty_accounts con balance cero (docs/03).
      data: {
        first_name: firstName,
        last_name: lastName,
        phone,
        marketing_email_opt_in: marketingOptIn,
      },
      emailRedirectTo: `${await urlBase()}/auth/callback`,
    },
  });

  if (error) {
    // No se revela si el correo ya existe: eso permitiría enumerar usuarios.
    return {
      ok: false,
      error: {
        code: "registro_fallido",
        message:
          "No pudimos crear la cuenta ahora mismo. Revisa los datos e inténtalo de nuevo.",
      },
    };
  }

  // No se asume sesión verificada (docs/03): se va a la pantalla de confirmación.
  redirect("/registro/confirmar");
}

export async function iniciarSesion(datos: unknown): Promise<ResultadoAccion> {
  const parsed = loginSchema.safeParse(datos);
  if (!parsed.success) return deZod(parsed.error);
  if (!supabaseConfigurado()) return SIN_CONFIG;

  const { email, password, siguiente } = parsed.data;
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Mensaje genérico a propósito: distinguir "no existe" de "clave incorrecta"
    // permite enumerar cuentas.
    return {
      ok: false,
      error: {
        code: "credenciales_invalidas",
        message: "Correo o contraseña incorrectos.",
      },
    };
  }

  // `siguiente` ya está validado como ruta interna por el schema.
  redirect(siguiente && siguiente.startsWith("/") ? siguiente : "/perfil");
}

export async function cerrarSesion(): Promise<void> {
  if (supabaseConfigurado()) {
    const supabase = await crearClienteServidor();
    await supabase.auth.signOut();
  }
  redirect("/");
}

export async function solicitarReset(datos: unknown): Promise<ResultadoAccion> {
  const parsed = solicitarResetSchema.safeParse(datos);
  if (!parsed.success) return deZod(parsed.error);
  if (!supabaseConfigurado()) return SIN_CONFIG;

  const supabase = await crearClienteServidor();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await urlBase()}/auth/callback?siguiente=/recuperar/nueva`,
  });

  // Siempre la misma respuesta, exista o no la cuenta: no se filtra qué correos
  // están registrados.
  return {
    ok: true,
    mensaje:
      "Si ese correo tiene una cuenta, te enviamos un enlace para crear una contraseña nueva.",
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   Adaptadores para <form action={...}> + useActionState.
   Aceptan FormData para que los formularios funcionen aunque no cargue el JS.
   ────────────────────────────────────────────────────────────────────────── */

const texto = (fd: FormData, campo: string) => String(fd.get(campo) ?? "");
const marcado = (fd: FormData, campo: string) => fd.get(campo) === "on";

export async function registrarseForm(
  _previo: ResultadoAccion | null,
  formData: FormData
): Promise<ResultadoAccion> {
  return registrarse({
    firstName: texto(formData, "firstName"),
    lastName: texto(formData, "lastName"),
    email: texto(formData, "email"),
    phone: texto(formData, "phone"),
    password: texto(formData, "password"),
    confirmPassword: texto(formData, "confirmPassword"),
    acceptTerms: marcado(formData, "acceptTerms"),
    marketingOptIn: marcado(formData, "marketingOptIn"),
  });
}

export async function iniciarSesionForm(
  _previo: ResultadoAccion | null,
  formData: FormData
): Promise<ResultadoAccion> {
  return iniciarSesion({
    email: texto(formData, "email"),
    password: texto(formData, "password"),
    siguiente: texto(formData, "siguiente") || undefined,
  });
}

export async function solicitarResetForm(
  _previo: ResultadoAccion | null,
  formData: FormData
): Promise<ResultadoAccion> {
  return solicitarReset({ email: texto(formData, "email") });
}

export async function actualizarPasswordForm(
  _previo: ResultadoAccion | null,
  formData: FormData
): Promise<ResultadoAccion> {
  return actualizarPassword({
    password: texto(formData, "password"),
    confirmPassword: texto(formData, "confirmPassword"),
  });
}

export async function actualizarPassword(datos: unknown): Promise<ResultadoAccion> {
  const parsed = nuevaPasswordSchema.safeParse(datos);
  if (!parsed.success) return deZod(parsed.error);
  if (!supabaseConfigurado()) return SIN_CONFIG;

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: {
        code: "sesion_requerida",
        message: "El enlace expiró. Solicita uno nuevo para cambiar tu contraseña.",
      },
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      ok: false,
      error: {
        code: "password_no_actualizada",
        message: "No pudimos actualizar la contraseña. Solicita un enlace nuevo.",
      },
    };
  }

  redirect("/perfil");
}

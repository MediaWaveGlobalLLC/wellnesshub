import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/env";

/**
 * Verificación de sesión server-side.
 *
 * docs/06 exige que la autorización se compruebe en el servidor. El proxy
 * (src/proxy.ts) solo redirige de forma optimista; la comprobación real es esta.
 *
 * Siempre `getUser()`, nunca `getSession()`: getSession lee la cookie sin
 * validarla contra Supabase y por tanto es falsificable.
 */
export async function obtenerUsuario(): Promise<User | null> {
  if (!supabaseConfigurado()) return null;
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Igual que `obtenerUsuario`, pero corta el render si no hay sesión. */
export async function exigirSesion(destino?: string): Promise<User> {
  const usuario = await obtenerUsuario();
  if (!usuario) {
    const siguiente = destino ? `?siguiente=${encodeURIComponent(destino)}` : "";
    redirect(`/iniciar-sesion${siguiente}`);
  }
  return usuario;
}

import "server-only";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

/**
 * Cliente de servidor SIN sesión, para datos que son públicos de verdad.
 *
 * `crearClienteServidor()` lee cookies para saber quién eres, y eso obliga a
 * Next a renderizar dinámicamente cualquier página que lo use. Para la carta
 * eso es un coste que no compra nada: el menú es el mismo para todo el mundo.
 *
 * Sin cookies, /menu puede volver a ser estática y servirse desde la caché.
 *
 * Entra como `anon`, así que sigue pasando por RLS: solo ve lo que tenga
 * política de lectura pública. No es un atajo de permisos, es un atajo de
 * sesión.
 *
 * NO usar para nada que dependa del usuario —wallet, puntos, pedidos—: aquí no
 * hay `auth.uid()` y las políticas por usuario no devolverían ninguna fila.
 */
export function crearClientePublico() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      // No hay sesión que guardar ni que refrescar: es una lectura anónima.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { exigirConfigSupabase } from "./env";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 *
 * Se crea por petición: `cookies()` es asíncrono desde Next 15 y el cliente no
 * puede compartirse entre peticiones sin filtrar sesiones entre usuarios.
 */
export async function crearClienteServidor() {
  const { url, key } = exigirConfigSupabase();
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Un Server Component no puede escribir cookies. El refresco de sesión
          // lo hace el proxy (src/proxy.ts), así que aquí se ignora sin riesgo.
        }
      },
    },
  });
}

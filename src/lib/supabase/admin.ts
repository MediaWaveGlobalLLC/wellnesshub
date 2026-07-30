import "server-only";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

/**
 * Cliente con `service_role`.
 *
 * SALTA RLS POR COMPLETO. Solo puede usarse en rutas de servidor y únicamente
 * después de haber autorizado la operación (`docs/06`).
 *
 * El `import "server-only"` de arriba hace que el build falle si algún
 * componente cliente lo importa por accidente, en vez de descubrirlo cuando la
 * clave ya viaja en el bundle.
 */
export function crearClienteServicio() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY no está configurada. Las operaciones administrativas " +
        "la necesitan (ver docs/13_ENVIRONMENT.md)."
    );
  }

  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function servicioDisponible(): boolean {
  return Boolean(SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

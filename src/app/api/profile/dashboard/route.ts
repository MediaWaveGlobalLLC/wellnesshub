import { exito, fallo, noAutenticado, nuevoRequestId } from "@/lib/api/respuesta";
import { obtenerDashboard } from "@/lib/services/profile-service";
import { supabaseConfigurado } from "@/lib/supabase/env";

/**
 * GET /api/profile/dashboard — `docs/05`.
 *
 * Devuelve el agregado del perfil del usuario en sesión. Nunca datos de otro:
 * el servicio lee con la sesión y RLS filtra en la base.
 *
 * La página `/perfil` no consume este endpoint —es un Server Component y llama
 * al servicio directamente, ahorrándose un salto de red—. Existe para clientes
 * externos y para poder probar el contrato de la API por separado.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = nuevoRequestId();

  if (!supabaseConfigurado()) {
    return fallo("supabase_no_configurado", "El servicio de cuentas no está disponible.", {
      status: 503,
      requestId,
    });
  }

  try {
    const dashboard = await obtenerDashboard();
    if (!dashboard) return noAutenticado(requestId);
    return exito(dashboard, requestId);
  } catch (causa) {
    // Sin filtrar el detalle interno al cliente; el requestId permite cruzarlo
    // con el log del servidor.
    console.error(`[${requestId}] dashboard falló:`, causa);
    return fallo("error_interno", "No pudimos cargar tu perfil. Inténtalo de nuevo.", {
      status: 500,
      requestId,
    });
  }
}

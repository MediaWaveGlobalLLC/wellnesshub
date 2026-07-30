import type { NextRequest } from "next/server";
import { exito, fallo, noAutenticado, nuevoRequestId } from "@/lib/api/respuesta";
import { obtenerWallet, MOVIMIENTOS_POR_PAGINA } from "@/lib/services/wallet-service";
import { supabaseConfigurado } from "@/lib/supabase/env";

/**
 * GET /api/wallet — `docs/05`.
 *
 * Devuelve el saldo y los movimientos paginados del usuario en sesión. Nunca
 * datos de otro: la lectura va con su sesión y RLS filtra en la base.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestId = nuevoRequestId();

  if (!supabaseConfigurado()) {
    return fallo("supabase_no_configurado", "El servicio no está disponible.", {
      status: 503,
      requestId,
    });
  }

  // Página fuera de rango o no numérica cae a 0 en vez de reventar la consulta.
  const crudo = Number(request.nextUrl.searchParams.get("pagina"));
  const pagina = Number.isInteger(crudo) && crudo >= 0 ? crudo : 0;

  try {
    const wallet = await obtenerWallet(pagina);
    if (!wallet) return noAutenticado(requestId);

    return exito(
      {
        balanceCents: wallet.balanceCents,
        currency: wallet.moneda,
        transactions: wallet.movimientos,
        page: pagina,
        pageSize: MOVIMIENTOS_POR_PAGINA,
        total: wallet.total,
        hasMore: wallet.hayMas,
      },
      requestId
    );
  } catch (causa) {
    console.error(`[${requestId}] wallet falló:`, causa);
    return fallo("error_interno", "No pudimos cargar tu saldo. Inténtalo de nuevo.", {
      status: 500,
      requestId,
    });
  }
}

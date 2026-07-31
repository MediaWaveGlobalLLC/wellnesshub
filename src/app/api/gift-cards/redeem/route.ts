import type { NextRequest } from "next/server";
import { exito, fallo, nuevoRequestId } from "@/lib/api/respuesta";
import { canjear } from "@/lib/gift-cards/service";
import { canjeSchema } from "@/lib/validation/gift-cards";

/**
 * POST /api/gift-cards/redeem — `docs/05`.
 *
 * El código nunca se registra en logs. Los errores distinguen entre inválido,
 * ya canjeada, expirada y rate limited porque son estados que la persona
 * necesita entender; ninguno revela nada, porque para llegar aquí hay que
 * acertar un código de 128 bits.
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const requestId = nuevoRequestId();

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return fallo("json_invalido", "El cuerpo debe ser JSON válido.", { status: 400, requestId });
  }

  const parsed = canjeSchema.safeParse(cuerpo);
  if (!parsed.success) {
    return fallo("validacion", parsed.error.issues[0]?.message ?? "Revisa el código.", {
      status: 422,
      requestId,
    });
  }

  // Solo para el rate limit. No se asocia a la persona más allá de eso.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip");

  const resultado = await canjear(
    parsed.data.code,
    ip,
    parsed.data.amountCents ?? null,
    parsed.data.clientRequestId ?? null
  );

  if (!resultado.ok) {
    const status =
      resultado.codigo === "sesion_requerida"
        ? 401
        : resultado.codigo === "rate_limited"
          ? 429
          : 422;
    return fallo(resultado.codigo, resultado.mensaje, { status, requestId });
  }

  return exito(
    {
      creditedCents: resultado.creditedCents,
      newBalanceCents: resultado.newBalanceCents,
      receiptId: resultado.receiptId,
      cardBalanceCents: resultado.cardBalanceCents,
    },
    requestId
  );
}

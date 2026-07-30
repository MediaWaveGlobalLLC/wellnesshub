import type { NextRequest } from "next/server";
import { exito, fallo, nuevoRequestId } from "@/lib/api/respuesta";
import { ajustarPuntos, exigirAdmin } from "@/lib/services/admin-service";
import { ajustePuntosSchema, usuarioIdSchema } from "@/lib/validation/admin";
import { enMinutos, limitar } from "@/lib/seguridad/rate-limit";

/**
 * POST /api/admin/users/:id/points-adjustment — `docs/05`.
 *
 * Mismo patrón que el ajuste de saldo, con puntos enteros. Son sistemas
 * separados (`docs/00`): este endpoint no toca el wallet ni convierte nada.
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  const requestId = nuevoRequestId();

  const actor = await exigirAdmin();
  if (!actor) {
    return fallo("no_autorizado", "No tienes permisos para esta operación.", {
      status: 403,
      requestId,
    });
  }

  /*
    Freno de mano. Estos endpoints mueven dinero de clientes y hasta ahora no
    tenían ninguno: una sesión de administración robada podía vaciar cuentas a
    la velocidad que diera la red. El cupo va por actor, no por IP: quien manda
    es quién firma el ajuste.
  */
  const veredicto = await limitar("admin_ajuste", actor.id);
  if (!veredicto.permitido) {
    return fallo(
      "demasiados_ajustes",
      `Demasiados ajustes seguidos. Espera ${enMinutos(veredicto.reintentarEn)} minutos.`,
      { status: 429, requestId }
    );
  }

  const { id } = await contexto.params;
  const target = usuarioIdSchema.safeParse(id);
  if (!target.success) {
    return fallo("usuario_invalido", "Identificador de usuario no válido.", {
      status: 400,
      requestId,
    });
  }

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return fallo("json_invalido", "El cuerpo debe ser JSON válido.", { status: 400, requestId });
  }

  const parsed = ajustePuntosSchema.safeParse(cuerpo);
  if (!parsed.success) {
    const { fieldErrors } = parsed.error.flatten();
    const limpio: Record<string, string[]> = {};
    for (const [campo, mensajes] of Object.entries(fieldErrors)) {
      if (mensajes?.length) limpio[campo] = mensajes;
    }
    return fallo("validacion", "Revisa los datos del ajuste.", {
      status: 422,
      fieldErrors: limpio,
      requestId,
    });
  }

  const resultado = await ajustarPuntos(
    actor,
    target.data,
    parsed.data.points,
    parsed.data.reason,
    parsed.data.reference,
    requestId
  );

  if (!resultado.ok) {
    const status = resultado.codigo === "no_autorizado" ? 403 : 422;
    return fallo(resultado.codigo, resultado.mensaje, { status, requestId });
  }

  return exito(
    {
      transactionId: resultado.transactionId,
      newPointsBalance: resultado.nuevoSaldo,
    },
    requestId
  );
}

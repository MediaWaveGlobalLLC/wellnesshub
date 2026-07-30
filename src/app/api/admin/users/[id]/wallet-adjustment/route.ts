import type { NextRequest } from "next/server";
import { exito, fallo, nuevoRequestId } from "@/lib/api/respuesta";
import { ajustarWallet, exigirAdmin } from "@/lib/services/admin-service";
import { ajusteWalletSchema, usuarioIdSchema } from "@/lib/validation/admin";
import { enMinutos, limitar } from "@/lib/seguridad/rate-limit";

/**
 * POST /api/admin/users/:id/wallet-adjustment — `docs/05`.
 *
 * Ajuste manual de saldo con motivo obligatorio y registro de auditoría. El
 * ajuste y su audit_log ocurren en la misma transacción SQL: si uno falla, no
 * queda el otro.
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  const requestId = nuevoRequestId();

  // Autorizar ANTES de mirar el payload: un no-administrador no debe poder
  // deducir nada por la forma de los errores de validación.
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

  const parsed = ajusteWalletSchema.safeParse(cuerpo);
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

  const resultado = await ajustarWallet(
    actor,
    target.data,
    parsed.data.amountCents,
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
      newBalanceCents: resultado.nuevoSaldo,
    },
    requestId
  );
}

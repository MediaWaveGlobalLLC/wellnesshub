import type { NextRequest } from "next/server";
import { exito, fallo, nuevoRequestId } from "@/lib/api/respuesta";
import { crearCheckout } from "@/lib/gift-cards/service";
import { checkoutSchema } from "@/lib/validation/gift-cards";
import { stripeConfigurado } from "@/lib/stripe";
import { urlBaseDelSitio } from "@/lib/url-base";

/**
 * POST /api/gift-cards/checkout — `docs/05`.
 *
 * El importe se valida aquí contra los límites del servidor y es lo único con
 * lo que se construye la sesión de Stripe: no se acepta ningún precio que venga
 * del cliente.
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const requestId = nuevoRequestId();

  if (!stripeConfigurado()) {
    return fallo("stripe_no_configurado", "La compra no está disponible ahora mismo.", {
      status: 503,
      requestId,
    });
  }

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return fallo("json_invalido", "El cuerpo debe ser JSON válido.", { status: 400, requestId });
  }

  const parsed = checkoutSchema.safeParse(cuerpo);
  if (!parsed.success) {
    const { fieldErrors } = parsed.error.flatten();
    const limpio: Record<string, string[]> = {};
    for (const [campo, mensajes] of Object.entries(fieldErrors)) {
      if (mensajes?.length) limpio[campo] = mensajes;
    }
    return fallo("validacion", "Revisa los datos de la compra.", {
      status: 422,
      fieldErrors: limpio,
      requestId,
    });
  }

  // Normalizada: un `NEXT_PUBLIC_APP_URL` sin esquema hacía que Stripe
  // rechazara la sesión con `url_invalid` y tumbaba la compra entera.
  const urlBase = urlBaseDelSitio(request.nextUrl.origin);

  const resultado = await crearCheckout(parsed.data, urlBase);

  if (!resultado.ok) {
    const status = resultado.codigo === "sesion_requerida" ? 401 : 502;
    return fallo(resultado.codigo, resultado.mensaje, { status, requestId });
  }

  return exito({ checkoutUrl: resultado.checkoutUrl, orderId: resultado.orderId }, requestId);
}

import "server-only";

import Stripe from "stripe";

/**
 * Cliente de Stripe.
 *
 * Solo servidor. La clave secreta nunca lleva prefijo `NEXT_PUBLIC_` y por
 * tanto no puede acabar en el bundle del navegador (`docs/06`).
 */
let cliente: Stripe | null = null;

export function stripe(): Stripe {
  if (!cliente) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error(
        "STRIPE_SECRET_KEY no está configurada. Ver docs/13_ENVIRONMENT.md. " +
          "Empezar siempre en test mode."
      );
    }
    cliente = new Stripe(key);
  }
  return cliente;
}

export function stripeConfigurado(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function webhookSecretConfigurado(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}

/** Advierte si se está operando contra Stripe en modo real. */
export function esModoReal(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live_");
}

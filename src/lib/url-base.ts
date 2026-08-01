/**
 * URL base del sitio, la que Stripe usa para devolver a la gente después de pagar.
 *
 * `NEXT_PUBLIC_APP_URL` se escribe a mano en Vercel, y es facilísimo ponerla sin
 * esquema —«thewellnesshubpr.com»— porque así es como se dice un dominio en voz
 * alta. Stripe la rechaza con `url_invalid`: *An explicit scheme (such as https)
 * must be provided*.
 *
 * Pasó en producción y tumbó la compra de gift cards entera: el pedido se
 * creaba, Stripe devolvía 400 y en pantalla solo salía «No pudimos abrir el
 * pago». Por eso el valor se normaliza aquí en vez de confiar en que venga bien
 * escrito.
 */
export function urlBaseDelSitio(alternativa: string): string {
  const crudo = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "") ?? "";

  // Sin variable: la del propio request, que siempre trae esquema.
  if (!crudo) return alternativa.replace(/\/+$/, "");

  if (/^https?:\/\//i.test(crudo)) return crudo;

  // Con dominio pelado se asume https: es lo único que Stripe acepta fuera de
  // localhost, y el sitio se sirve por https en cualquier caso.
  return `https://${crudo.replace(/^\/+/, "")}`;
}

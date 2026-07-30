/**
 * Cabeceras de seguridad — `docs/06`.
 *
 * Se aplican en el proxy, así que cubren TODA respuesta: páginas, rutas de API
 * y estáticos. Ponerlas en `next.config.ts` habría dejado fuera lo que el proxy
 * responde por su cuenta, como las redirecciones de sesión.
 */

/**
 * Content Security Policy.
 *
 * SOBRE `script-src` — la decisión que más se nota
 * ────────────────────────────────────────────────
 * La versión fuerte de esta política sería `'nonce-…' 'strict-dynamic'`. Se
 * implementó, se probó contra un build de producción y se retiró: un nonce
 * cambia en cada petición y no puede hornearse en HTML prerenderizado, así que
 * `/`, `/menu` y `/registro` —que son estáticas— quedaban sin firmar y el
 * navegador bloqueaba TODOS los chunks de Next. La página se pintaba, no
 * hidrataba y ningún formulario respondía.
 *
 * Adoptarla obligaría a marcar dinámicas todas las páginas del sitio, incluidas
 * las de contenido puro. Es un cambio de arquitectura con coste real de
 * rendimiento y no corresponde decidirlo sin el dueño del proyecto, así que se
 * deja documentado como pendiente.
 *
 * Lo que sí protege esta política, que no es poco: bloquea cualquier script de
 * un dominio externo, impide el framing, impide enviar formularios a otro
 * origen y fija las conexiones salientes a Supabase. El hueco es `unsafe-inline`
 * frente a una inyección; se mitiga porque React escapa por defecto y el único
 * HTML que se inserta sin escapar es el SVG del QR, generado en el servidor.
 *
 * No queda ningún nonce a medias, y es deliberado: cuando `script-src` contiene
 * un nonce, el navegador IGNORA `'unsafe-inline'` por la regla de
 * retrocompatibilidad de CSP. Dejar el nonce «por si acaso» habría dado una
 * política distinta en las páginas dinámicas —donde Next sí firma— que en las
 * estáticas, que es exactamente el fallo que se acaba de arreglar.
 *
 * Otras decisiones:
 *
 * · `'unsafe-inline'` en `style-src` es inevitable: Next y Tailwind inyectan
 *   estilos en línea durante la hidratación y quitarlo deja la página sin CSS.
 *
 * · `connect-src` solo permite Supabase. Si mañana aparece otra llamada
 *   saliente, falla de forma visible en vez de irse sin que nadie lo note.
 *
 * · `frame-ancestors 'none'` impide el clickjacking sobre las pantallas de
 *   cuenta, donde hay saldo y datos personales.
 */
export function construirCSP(supabaseUrl: string): string {
  const supabase = supabaseUrl || "";
  // El realtime de Supabase usa websocket sobre el mismo host.
  const supabaseWs = supabase.replace(/^https:/, "wss:");

  const directivas: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", supabase, supabaseWs].filter(Boolean),
    // Stripe Checkout es una redirección a su dominio, no un iframe: no hace
    // falta abrir frame-src.
    "frame-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "object-src": ["'none'"],
    "upgrade-insecure-requests": [],
  };

  return Object.entries(directivas)
    .map(([clave, valores]) => (valores.length ? `${clave} ${valores.join(" ")}` : clave))
    .join("; ");
}

/**
 * Cabeceras que no dependen de la petición.
 *
 * HSTS no se incluye: lo sirve Vercel en el borde para todos sus dominios, y
 * duplicarlo desde aquí solo añade ruido.
 */
export const CABECERAS_ESTATICAS: Record<string, string> = {
  // Evita que el navegador adivine el tipo y ejecute como script algo que no lo es.
  "X-Content-Type-Options": "nosniff",
  // Redundante con frame-ancestors, pero cubre navegadores antiguos.
  "X-Frame-Options": "DENY",
  // No filtrar la ruta completa —que puede llevar un id de pedido— a terceros.
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // La aplicación no usa ninguna de estas capacidades.
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

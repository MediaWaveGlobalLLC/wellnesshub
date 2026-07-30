import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabaseConfigurado } from "@/lib/supabase/env";
import { CABECERAS_ESTATICAS, construirCSP } from "@/lib/seguridad/cabeceras";
import { decidirVisita } from "@/lib/analitica/clasificar";
import { registrarVisita } from "@/lib/analitica/registrar";

/**
 * Proxy de sesión — Next 16.
 *
 * En Next 16 el middleware se llama `proxy` y vive en `src/proxy.ts`.
 *
 * Hace TRES cosas y nada más:
 *  1. Refresca la cookie de sesión de Supabase para que no expire en navegación.
 *  2. Redirección optimista: manda a /iniciar-sesion a quien no tenga sesión.
 *  3. Cuenta la visita, de forma anónima y sin bloquear la respuesta.
 *
 * La documentación de Next es explícita en que el proxy NO es una solución de
 * autorización. Y `docs/06` exige verificación server-side. Por eso cada página
 * protegida vuelve a comprobar la sesión con `exigirSesion()`; esto es solo un
 * atajo de UX para evitar el parpadeo de una pantalla vacía.
 */

/** Prefijos que requieren sesión — `config/route-contracts.json`. */
const RUTAS_PRIVADAS = ["/perfil", "/wallet", "/gift-cards/confirmacion"];
const RUTAS_ADMIN = ["/admin"];

/** Rutas de entrada: si ya hay sesión, no tiene sentido volver a ellas. */
const RUTAS_INVITADO = ["/iniciar-sesion", "/registro", "/recuperar"];

/**
 * Aplica las cabeceras de seguridad a cualquier respuesta que salga de aquí.
 *
 * Se hace en una función para que no se pueda olvidar en ninguna de las tres
 * salidas del proxy: continuar, redirigir a login o redirigir a perfil.
 */
function conSeguridad(respuesta: NextResponse, csp: string): NextResponse {
  respuesta.headers.set("Content-Security-Policy", csp);
  for (const [clave, valor] of Object.entries(CABECERAS_ESTATICAS)) {
    respuesta.headers.set(clave, valor);
  }
  return respuesta;
}

/**
 * Cuenta la visita fuera del camino crítico.
 *
 * `event.waitUntil` mantiene viva la invocación hasta que la promesa acaba,
 * pero la respuesta ya se ha ido: el visitante no espera ni un milisegundo por
 * la analítica. Sin esto habría que elegir entre añadir una ida y vuelta a
 * Supabase a cada petición o no contar nada.
 *
 * Se llama al PRINCIPIO, antes de `getUser()`, y a propósito: si más adelante
 * el proxy redirige, la visita ya está contada. Una visita a `/perfil` sin
 * sesión sigue siendo una visita —alguien intentó entrar—, y perderla haría que
 * el embudo de registro pareciera más estrecho de lo que es.
 *
 * Nada de aquí puede lanzar hacia fuera: `registrarVisita` se traga sus propios
 * errores y `decidirVisita` es aritmética sobre cadenas.
 */
function contarVisita(request: NextRequest, event: NextFetchEvent): void {
  const visita = decidirVisita({
    method: request.method,
    pathname: request.nextUrl.pathname,
    host: request.nextUrl.hostname,
    cabeceras: request.headers,
  });

  if (visita) event.waitUntil(registrarVisita(visita));
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  contarVisita(request, event);

  /*
   * La CSP no lleva nonce. Aquí hubo uno, con `strict-dynamic`, y hubo que
   * quitarlo: un nonce cambia en cada petición y no puede hornearse en HTML
   * prerenderizado, así que `/`, `/menu` y `/registro` salían sin firmar y el
   * navegador bloqueaba todos los chunks de Next. La página se pintaba, no
   * hidrataba y ningún formulario respondía.
   *
   * Se detectó comprobando la consola contra un build de producción. Ni en
   * desarrollo —donde la CSP se relaja— ni con los siete gates se ve esto:
   * `scripts/verify-csp.mjs` existe para que no vuelva a pasar.
   */
  const csp = construirCSP(SUPABASE_URL);

  // Sin Supabase configurado, la web pública debe seguir sirviéndose igual.
  if (!supabaseConfigurado()) {
    return conSeguridad(NextResponse.next(), csp);
  }

  let response = NextResponse.next();

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() revalida el token contra Supabase. No usar getSession() aquí:
  // lee la cookie sin verificarla y es falsificable.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const esPrivada = [...RUTAS_PRIVADAS, ...RUTAS_ADMIN].some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (esPrivada && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/iniciar-sesion";
    // Se guarda el destino para volver tras entrar. Solo rutas internas:
    // aceptar una URL absoluta abriría un open redirect (docs/06).
    url.searchParams.set("siguiente", pathname);
    return conSeguridad(NextResponse.redirect(url), csp);
  }

  if (user && RUTAS_INVITADO.some((p) => pathname === p)) {
    const url = request.nextUrl.clone();
    url.pathname = "/perfil";
    url.search = "";
    return conSeguridad(NextResponse.redirect(url), csp);
  }

  return conSeguridad(response, csp);
}

export const config = {
  matcher: [
    /*
     * Todo excepto estáticos y assets de marca. Sin esta exclusión el proxy
     * revalidaría el token en cada imagen, multiplicando llamadas a Supabase.
     */
    "/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2)$).*)",
  ],
};

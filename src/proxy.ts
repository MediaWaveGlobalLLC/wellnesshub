import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabaseConfigurado } from "@/lib/supabase/env";

/**
 * Proxy de sesión — Next 16.
 *
 * En Next 16 el middleware se llama `proxy` y vive en `src/proxy.ts`.
 *
 * Hace DOS cosas y nada más:
 *  1. Refresca la cookie de sesión de Supabase para que no expire en navegación.
 *  2. Redirección optimista: manda a /iniciar-sesion a quien no tenga sesión.
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

export async function proxy(request: NextRequest) {
  // Sin Supabase configurado, la web pública debe seguir sirviéndose igual.
  if (!supabaseConfigurado()) return NextResponse.next();

  let response = NextResponse.next({ request });

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
    return NextResponse.redirect(url);
  }

  if (user && RUTAS_INVITADO.some((p) => pathname === p)) {
    const url = request.nextUrl.clone();
    url.pathname = "/perfil";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
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

import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/env";

/**
 * Callback de Supabase Auth.
 *
 * Aterrizan aquí el enlace de verificación de correo y el de recuperación de
 * contraseña. Se canjea el `code` por una sesión y se redirige.
 *
 * `siguiente` se valida como ruta interna: aceptar una URL absoluta desde el
 * query string sería un open redirect (docs/06).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const solicitado = searchParams.get("siguiente");

  const siguiente =
    solicitado && solicitado.startsWith("/") && !solicitado.startsWith("//")
      ? solicitado
      : "/perfil";

  if (!supabaseConfigurado() || !code) {
    return NextResponse.redirect(`${origin}/iniciar-sesion?error=enlace_invalido`);
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/iniciar-sesion?error=enlace_expirado`);
  }

  return NextResponse.redirect(`${origin}${siguiente}`);
}

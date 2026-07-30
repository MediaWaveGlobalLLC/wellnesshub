/**
 * Lectura de variables de entorno de Supabase.
 *
 * docs/13 fija los nombres. La clave publicable es la única que puede llegar al
 * navegador; `SUPABASE_SERVICE_ROLE_KEY` jamás se importa desde código cliente
 * (docs/06) y por eso vive en un módulo aparte marcado server-only.
 *
 * El proyecto debe compilar y servir la web pública aunque Supabase todavía no
 * esté configurado: las Fases 1 y 7 no dependen de él. Por eso la lectura es
 * tolerante y se expone `supabaseConfigurado()` para que cada superficie decida.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export function supabaseConfigurado(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_PUBLISHABLE_KEY.length > 0;
}

/** Lanza con un mensaje accionable en vez de un error críptico del SDK. */
export function exigirConfigSupabase(): { url: string; key: string } {
  if (!supabaseConfigurado()) {
    throw new Error(
      "Supabase no está configurado. Define NEXT_PUBLIC_SUPABASE_URL y " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local (ver docs/13_ENVIRONMENT.md)."
    );
  }
  return { url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY };
}

import type { NextConfig } from "next";
import path from "node:path";

/**
 * Host de Supabase para las fotos de perfil.
 *
 * Se deriva de la variable en vez de escribirlo: así el proyecto de pruebas y
 * el de producción funcionan con la misma configuración, y nadie tiene que
 * acordarse de cambiar un dominio aquí.
 *
 * Sin la variable no se declara ningún patrón. Es lo correcto: mejor que la
 * foto no cargue a que quede abierto un comodín.
 */
function hostDeSupabase(): URL | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

const supabase = hostDeSupabase();

const nextConfig: NextConfig = {
  // Hay otro package-lock.json más arriba en el árbol del usuario; sin esto Next
  // infiere mal la raíz del workspace.
  turbopack: { root: path.resolve(import.meta.dirname) },

  /*
    Fotos de perfil servidas desde el bucket `avatares`.

    El patrón se ata al host EXACTO y a la ruta pública de ese bucket, no a
    `/**`: un comodín convertiría `/_next/image` en un proxy de imágenes para
    cualquier cosa que hubiera en el proyecto de Supabase.

    Nota de `docs/09` (DEC-009): esto no lo cubre la CSP. `img-src` sigue siendo
    `'self'` y funciona precisamente porque `next/image` sirve la imagen desde
    nuestro propio origen; la barrera real es esta lista, no la cabecera.
  */
  images: supabase
    ? {
        remotePatterns: [
          {
            protocol: "https",
            hostname: supabase.hostname,
            pathname: "/storage/v1/object/public/avatares/**",
          },
        ],
      }
    : undefined,
};

export default nextConfig;

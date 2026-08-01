/**
 * Foto de perfil — validación de lo que llega.
 *
 * Puro y sin `server-only`: aquí no hay red ni secretos, solo bytes y reglas,
 * para poder probar la parte que decide qué entra sin levantar nada.
 *
 * La regla de fondo: **no se cree la extensión ni el `type` del navegador**. Un
 * `Content-Type: image/png` lo escribe quien envía el formulario. Lo único que
 * no se puede falsear sin dejar de ser una imagen son los primeros bytes, así
 * que el tipo se decide ahí y el nombre del fichero se descarta entero.
 */

/** 2 MB, el mismo tope que tiene el bucket. Dos frenos que dicen lo mismo. */
export const MAX_BYTES = 2 * 1024 * 1024;

export type TipoAvatar = { mime: string; extension: string };

const FIRMAS: { bytes: number[]; salto?: number; tipo: TipoAvatar }[] = [
  // JPEG: FF D8 FF
  { bytes: [0xff, 0xd8, 0xff], tipo: { mime: "image/jpeg", extension: "jpg" } },
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  {
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    tipo: { mime: "image/png", extension: "png" },
  },
];

/** "RIFF" .... "WEBP" — el tamaño va en medio, por eso no es una firma seguida. */
function esWebp(b: Uint8Array): boolean {
  if (b.length < 12) return false;
  const lee = (i: number, n: number) => String.fromCharCode(...b.slice(i, i + n));
  return lee(0, 4) === "RIFF" && lee(8, 4) === "WEBP";
}

/**
 * Tipo real por sus primeros bytes, o `null` si no es una imagen que aceptemos.
 *
 * Devolver `null` para un SVG es intencionado aunque sea una imagen: un SVG es
 * un documento con `<script>` dentro. Se sirve desde el dominio de Supabase y
 * no desde el nuestro, así que no robaría esta sesión, pero una foto de perfil
 * no necesita poder ejecutar nada.
 */
export function tipoReal(bytes: Uint8Array): TipoAvatar | null {
  for (const f of FIRMAS) {
    if (bytes.length < f.bytes.length) continue;
    if (f.bytes.every((b, i) => bytes[i] === b)) return f.tipo;
  }
  if (esWebp(bytes)) return { mime: "image/webp", extension: "webp" };
  return null;
}

export type Rechazo = { ok: false; error: string };
export type Aceptado = { ok: true; tipo: TipoAvatar };

/**
 * @param declarado el `type` que dice el navegador. Solo se usa para el mensaje
 *   de error; la decisión la toman los bytes.
 */
export function revisarAvatar(bytes: Uint8Array, declarado?: string): Aceptado | Rechazo {
  if (bytes.length === 0) return { ok: false, error: "El archivo llegó vacío." };

  if (bytes.length > MAX_BYTES) {
    return { ok: false, error: "La imagen pesa más de 2 MB. Prueba con una más pequeña." };
  }

  const tipo = tipoReal(bytes);
  if (!tipo) {
    const pista = declarado?.startsWith("image/") ? ` (${declarado} no nos vale)` : "";
    return { ok: false, error: `Solo aceptamos JPG, PNG o WebP${pista}.` };
  }

  return { ok: true, tipo };
}

/**
 * Ruta dentro del bucket: una carpeta por persona.
 *
 * El nombre es aleatorio, no el id de quien sube. Con `avatares/<user_id>.jpg`
 * bastaría con conocer un id para adivinar la URL de la foto de cualquiera, y
 * el bucket es de lectura pública. Con un nombre al azar la URL solo la tiene
 * quien la recibe de nosotros.
 *
 * La carpeta sí lleva el id: es lo que permite borrar lo viejo de una persona
 * sin tocar lo de nadie más.
 */
export function rutaDeAvatar(userId: string, extension: string, aleatorio: string): string {
  return `${userId}/${aleatorio}.${extension}`;
}

/**
 * De la URL pública guardada de vuelta a la ruta del bucket, para poder borrar.
 *
 * Devuelve `null` si la URL no es de nuestro bucket. Es la salvaguarda para que
 * un `avatar_url` manipulado no convierta el borrado en «bórrame ese otro
 * objeto»: si no reconocemos la forma, no se borra nada.
 */
export function rutaDesdeUrl(url: string | null, bucket = "avatares"): string | null {
  if (!url) return null;
  const marca = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marca);
  if (i === -1) return null;

  const ruta = url.slice(i + marca.length);
  // Sin `..`, sin ruta vacía y con la forma `carpeta/archivo` que escribimos.
  if (!ruta || ruta.includes("..") || !/^[^/]+\/[^/]+$/.test(ruta)) return null;
  return decodeURIComponent(ruta);
}

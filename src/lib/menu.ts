import { MENU, type MenuItem } from "@/lib/site";

/**
 * Índice del menú por slug.
 *
 * El menú es contenido, no base de datos: vive en `src/lib/site.ts` con los
 * precios transcritos del PDF oficial. `favorites` guarda el slug del producto,
 * así que aquí se deriva de forma estable y se resuelve de vuelta.
 */

export type ItemDeMenu = MenuItem & {
  slug: string;
  seccionId: string;
  seccionTitulo: string;
  mundo: "cafe" | "matcha" | "piel" | "comida";
};

/** "Matcha Clásico" → "matcha-clasico". Estable: sin acentos ni símbolos. */
export function slugDeItem(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const INDICE: Map<string, ItemDeMenu> = new Map();
for (const seccion of MENU) {
  for (const item of seccion.items) {
    const slug = slugDeItem(item.nombre);
    // El primero gana: si dos secciones repiten nombre, no se pisan en silencio.
    if (!INDICE.has(slug)) {
      INDICE.set(slug, {
        ...item,
        slug,
        seccionId: seccion.id,
        seccionTitulo: seccion.titulo.es,
        mundo: seccion.mundo,
      });
    }
  }
}

export function buscarItem(slug: string): ItemDeMenu | null {
  return INDICE.get(slug) ?? null;
}

/**
 * Resuelve varios slugs conservando el orden recibido y descartando los que ya
 * no existen — el menú cambia y un favorito puede quedar huérfano.
 */
export function resolverItems(slugs: string[]): ItemDeMenu[] {
  return slugs.map((s) => INDICE.get(s)).filter((x): x is ItemDeMenu => x !== undefined);
}

export function todosLosItems(): ItemDeMenu[] {
  return [...INDICE.values()];
}

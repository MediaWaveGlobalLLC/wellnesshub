import "server-only";

import { crearClientePublico } from "@/lib/supabase/publico";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { MENU } from "@/lib/site";
import { slugDeItem } from "@/lib/menu";
import type { CategoriaCatalogo, EstadoCategoria, Mundo, ProductoCatalogo } from "./tipos";

/**
 * Lectura del catálogo — `0011_catalogo.sql`.
 *
 * La base de datos es la fuente de verdad. Se lee con el cliente público, que
 * entra como `anon` y por tanto pasa por la política de lectura pública de RLS:
 * no hace falta `service_role` para pintar un menú.
 *
 * Con cliente SIN cookies a propósito. La primera versión usaba el cliente de
 * sesión y eso volvía dinámica la carta —Next lanza `DynamicServerError` en
 * cuanto alguien toca `cookies()` durante el prerender—, además de que el
 * `catch` de aquí abajo se tragaba ese error interno de Next, que es una señal
 * de control y no un fallo. La carta es igual para todo el mundo: no hay motivo
 * para leer la sesión ni para renunciar a servirla desde caché.
 */

/** Fila cruda tal y como la devuelve PostgREST con las relaciones anidadas. */
type FilaCategoria = {
  id: string;
  slug: string;
  nombre_es: string;
  mundo: Mundo;
  estado: EstadoCategoria;
  etiqueta_tamanos: string | null;
  orden: number;
  menu_productos: {
    id: string;
    slug: string;
    nombre: string;
    nota_es: string | null;
    destacado: boolean;
    disponible: boolean;
    es_modificador: boolean;
    orden: number;
    menu_variantes: {
      id: string;
      etiqueta: string | null;
      precio_cents: number;
      orden: number;
    }[];
  }[];
};

const SELECT = `
  id, slug, nombre_es, mundo, estado, etiqueta_tamanos, orden,
  menu_productos (
    id, slug, nombre, nota_es, destacado, disponible, es_modificador, orden,
    menu_variantes ( id, etiqueta, precio_cents, orden )
  )
`;

function porOrden<T extends { orden: number }>(filas: T[]): T[] {
  // Se ordena aquí y no en la consulta: PostgREST ordena las relaciones
  // anidadas con una sintaxis aparte que es fácil de romper en silencio, y
  // que un producto salga desordenado en la carta no da ningún error.
  return [...filas].sort((a, b) => a.orden - b.orden);
}

function mapear(filas: FilaCategoria[]): CategoriaCatalogo[] {
  return porOrden(filas).map((c) => ({
    id: c.id,
    slug: c.slug,
    nombre: c.nombre_es,
    mundo: c.mundo,
    estado: c.estado,
    etiquetaTamanos: c.etiqueta_tamanos,
    productos: porOrden(c.menu_productos ?? []).map((p) => ({
      id: p.id,
      slug: p.slug,
      nombre: p.nombre,
      nota: p.nota_es,
      destacado: p.destacado,
      disponible: p.disponible,
      esModificador: p.es_modificador,
      variantes: porOrden(p.menu_variantes ?? []).map((v) => ({
        id: v.id,
        etiqueta: v.etiqueta,
        precioCents: v.precio_cents,
      })),
    })),
  }));
}

/**
 * La carta transcrita en `site.ts`, con la forma del catálogo.
 *
 * Es la red de seguridad de la PÁGINA PÚBLICA, no del pedido. Si Supabase no
 * responde, es mejor enseñar la carta que enseñar un error: un visitante que
 * quiere saber si hay matcha no merece una pantalla rota por una incidencia de
 * base de datos.
 *
 * `tests/integration/catalogo-fidelidad.test.ts` garantiza que esta copia y la
 * base de datos dicen exactamente lo mismo el día que se sembró. Lo que NO
 * garantiza es que sigan iguales si alguien cambia un precio desde
 * administración: por eso este respaldo vale para mirar y no para cobrar.
 */
function catalogoDeRespaldo(): CategoriaCatalogo[] {
  return MENU.map((seccion) => ({
    id: `respaldo-${seccion.id}`,
    slug: seccion.id,
    nombre: seccion.titulo.es,
    mundo: seccion.mundo,
    estado: seccion.status,
    etiquetaTamanos: seccion.sizes ?? null,
    productos: seccion.items.map((item, j) => ({
      id: `respaldo-${seccion.id}-${j}`,
      slug: slugDeItem(item.nombre),
      nombre: item.nombre,
      nota: item.nota?.es ?? null,
      destacado: item.destacado === true,
      disponible: true,
      esModificador: false,
      variantes: item.precio.split("/").map((p, k, todos) => ({
        id: `respaldo-${seccion.id}-${j}-${k}`,
        etiqueta: todos.length > 1 ? (k === 0 ? "12 oz" : "16 oz") : null,
        precioCents: Math.round(Number(p.trim()) * 100),
      })),
    })),
  }));
}

/**
 * Catálogo completo para pintar la carta.
 *
 * Nunca lanza: la página pública no debe caerse porque la base de datos tenga
 * un mal minuto. Si hay que degradar, se degrada y se deja rastro en el log.
 */
export async function obtenerCatalogo(): Promise<{
  categorias: CategoriaCatalogo[];
  desdeRespaldo: boolean;
}> {
  if (!supabaseConfigurado()) {
    return { categorias: catalogoDeRespaldo(), desdeRespaldo: true };
  }

  try {
    const supabase = crearClientePublico();
    const { data, error } = await supabase.from("menu_categorias").select(SELECT);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      // Base viva pero catálogo vacío: la migración no llegó a aplicarse.
      console.error("[catalogo] la base respondió sin categorías; se usa el respaldo");
      return { categorias: catalogoDeRespaldo(), desdeRespaldo: true };
    }

    return { categorias: mapear(data as unknown as FilaCategoria[]), desdeRespaldo: false };
  } catch (e) {
    console.error("[catalogo] no se pudo leer, se usa el respaldo:", e);
    return { categorias: catalogoDeRespaldo(), desdeRespaldo: true };
  }
}

/**
 * Catálogo para COBRAR. Sin respaldo y lanzando si falla.
 *
 * La diferencia con `obtenerCatalogo` es deliberada y es la más importante de
 * este archivo: un precio de respaldo puede estar desactualizado, y cobrar con
 * un precio desactualizado no es degradar el servicio, es cobrar mal. Si la
 * base no responde, el pedido no sale.
 */
export async function obtenerCatalogoParaPedido(): Promise<CategoriaCatalogo[]> {
  if (!supabaseConfigurado()) {
    throw new Error("catálogo no disponible: Supabase no está configurado");
  }

  const supabase = crearClientePublico();
  const { data, error } = await supabase.from("menu_categorias").select(SELECT);

  if (error) throw new Error(`catálogo no disponible: ${error.message}`);
  if (!data || data.length === 0) throw new Error("catálogo vacío");

  return mapear(data as unknown as FilaCategoria[]);
}

/** Índice slug → producto, para resolver favoritos y líneas de pedido. */
export function indexarProductos(
  categorias: CategoriaCatalogo[]
): Map<string, ProductoCatalogo> {
  const indice = new Map<string, ProductoCatalogo>();
  for (const c of categorias) {
    for (const p of c.productos) {
      if (!indice.has(p.slug)) indice.set(p.slug, p);
    }
  }
  return indice;
}

import { varianteBase, type LineaPedido, type ProductoCatalogo } from "@/lib/catalogo/tipos";

/**
 * `?anadir=` — el puente entre «Mis favoritos» y el carrito de `/pedir`.
 *
 * Sin `server-only` y sin ninguna consulta: recibe el índice del catálogo ya
 * leído y devuelve líneas. Así se puede probar la parte que importa —qué se
 * acepta del enlace y qué se descarta— sin levantar una base de datos.
 */

/**
 * Tope de productos que puede traer un enlace.
 *
 * Ninguna pantalla manda más de uno, así que esto es solo el freno para una URL
 * escrita a mano: sin él, `?anadir=` repetido cien veces sembraría un carrito
 * de cien líneas. No cobraría de más —el total lo calcula `crear_pedido` en el
 * servidor— pero dejaría la pantalla inservible.
 */
export const MAX_PRECARGA = 10;

export type Precarga = {
  lineas: LineaPedido[];
  /** Algún slug pedido no se pudo añadir. La pantalla lo dice; no se calla. */
  huboDescartes: boolean;
};

/**
 * Del enlace solo se acepta el SLUG.
 *
 * La variante y el precio los pone el servidor: la más barata del producto, que
 * es la misma que se preselecciona al añadir desde la carta. Un enlace
 * manipulado pide otro producto, nunca otro precio.
 */
export function resolverPrecarga(
  anadir: string | string[] | undefined,
  indice: Map<string, ProductoCatalogo>
): Precarga {
  if (!anadir) return { lineas: [], huboDescartes: false };

  const pedidos = Array.isArray(anadir) ? anadir : [anadir];
  const slugs = [...new Set(pedidos)].slice(0, MAX_PRECARGA);

  const lineas: LineaPedido[] = [];
  // Lo que se corta por el tope también es un descarte: pedir doce y recibir
  // diez sin decir nada es la clase de silencio que hace dudar del carrito.
  let huboDescartes = new Set(pedidos).size > slugs.length;

  for (const slug of slugs) {
    const producto = indice.get(slug);
    const variante = producto ? varianteBase(producto) : null;

    // Agotado, retirado o sin precio: no entra.
    if (!producto || !producto.disponible || !variante) {
      huboDescartes = true;
      continue;
    }

    lineas.push({
      varianteId: variante.id,
      productoId: producto.id,
      nombre: producto.nombre,
      etiqueta: variante.etiqueta,
      precioCents: variante.precioCents,
      cantidad: 1,
    });
  }

  return { lineas, huboDescartes };
}

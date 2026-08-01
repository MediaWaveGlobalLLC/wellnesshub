import { describe, expect, it } from "vitest";

import { MAX_PRECARGA, resolverPrecarga } from "@/lib/pedidos/precarga";
import type { ProductoCatalogo } from "@/lib/catalogo/tipos";

/**
 * `?anadir=` — lo que se acepta de un enlace y lo que se descarta.
 *
 * Es el puente entre «Mis favoritos» y el carrito, y lo único que viaja por él
 * es un slug. Estas pruebas fijan las dos cosas que importan: que el precio no
 * llegue nunca desde fuera, y que lo descartado se avise en vez de callarse.
 */

function producto(over: Partial<ProductoCatalogo> = {}): ProductoCatalogo {
  return {
    id: "p1",
    slug: "latte",
    nombre: "Latte",
    nota: null,
    destacado: false,
    disponible: true,
    esModificador: false,
    archivado: false,
    imagenClave: null,
    imagen: null,
    variantes: [
      { id: "v-16", etiqueta: "16 oz", precioCents: 675 },
      { id: "v-12", etiqueta: "12 oz", precioCents: 550 },
    ],
    ...over,
  };
}

function indice(...productos: ProductoCatalogo[]) {
  return new Map(productos.map((p) => [p.slug, p]));
}

describe("resolverPrecarga", () => {
  it("sin parámetro no precarga nada ni se queja", () => {
    expect(resolverPrecarga(undefined, indice(producto()))).toEqual({
      lineas: [],
      huboDescartes: false,
    });
  });

  it("resuelve el slug a la variante MÁS BARATA, no a la primera", () => {
    const { lineas, huboDescartes } = resolverPrecarga("latte", indice(producto()));

    expect(huboDescartes).toBe(false);
    expect(lineas).toEqual([
      {
        varianteId: "v-12",
        productoId: "p1",
        nombre: "Latte",
        etiqueta: "12 oz",
        precioCents: 550,
        cantidad: 1,
      },
    ]);
  });

  it("el precio sale del catálogo: el enlace no puede traerlo", () => {
    // No hay forma de expresar un precio en la URL —solo el slug— y aun así se
    // deja escrito: si alguien añadiera un parámetro de precio, este test
    // seguiría comprobando que lo que se cobra sale del catálogo.
    const { lineas } = resolverPrecarga("latte", indice(producto()));
    expect(lineas[0]!.precioCents).toBe(550);
  });

  it("un producto agotado no entra, y se avisa", () => {
    const { lineas, huboDescartes } = resolverPrecarga(
      "latte",
      indice(producto({ disponible: false }))
    );

    expect(lineas).toEqual([]);
    expect(huboDescartes).toBe(true);
  });

  it("un producto sin variantes no entra: no se puede cobrar", () => {
    const { lineas, huboDescartes } = resolverPrecarga(
      "latte",
      indice(producto({ variantes: [] }))
    );

    expect(lineas).toEqual([]);
    expect(huboDescartes).toBe(true);
  });

  it("un slug que no existe no entra, y se avisa", () => {
    const { lineas, huboDescartes } = resolverPrecarga("no-existe", indice(producto()));

    expect(lineas).toEqual([]);
    expect(huboDescartes).toBe(true);
  });

  it("el mismo slug repetido cuenta una vez", () => {
    const { lineas, huboDescartes } = resolverPrecarga(
      ["latte", "latte", "latte"],
      indice(producto())
    );

    expect(lineas).toHaveLength(1);
    expect(lineas[0]!.cantidad).toBe(1);
    expect(huboDescartes).toBe(false);
  });

  it("acepta varios productos distintos conservando el orden", () => {
    const cafe = producto({ id: "p2", slug: "cafe", nombre: "Café", variantes: [
      { id: "v-cafe", etiqueta: null, precioCents: 300 },
    ] });

    const { lineas } = resolverPrecarga(["cafe", "latte"], indice(producto(), cafe));

    expect(lineas.map((l) => l.nombre)).toEqual(["Café", "Latte"]);
  });

  it("corta en el tope y lo declara como descarte", () => {
    const muchos = Array.from({ length: MAX_PRECARGA + 3 }, (_, i) =>
      producto({ id: `p${i}`, slug: `item-${i}` })
    );

    const { lineas, huboDescartes } = resolverPrecarga(
      muchos.map((p) => p.slug),
      indice(...muchos)
    );

    expect(lineas).toHaveLength(MAX_PRECARGA);
    // Cortar en silencio dejaría creer que entró todo.
    expect(huboDescartes).toBe(true);
  });

  it("mezcla válidos e inválidos: entra lo bueno y se avisa de lo otro", () => {
    const agotado = producto({ id: "p3", slug: "matcha", disponible: false });

    const { lineas, huboDescartes } = resolverPrecarga(
      ["latte", "matcha", "fantasma"],
      indice(producto(), agotado)
    );

    expect(lineas.map((l) => l.nombre)).toEqual(["Latte"]);
    expect(huboDescartes).toBe(true);
  });
});

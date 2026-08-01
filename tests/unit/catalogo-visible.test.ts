import { describe, expect, it } from "vitest";

import { soloDisponibles, type CategoriaCatalogo, type ProductoCatalogo } from "@/lib/catalogo/tipos";

/**
 * Qué ve el público cuando la dueña apaga cosas en el panel.
 *
 * La regla vieja —agotado se queda en la carta, tachado— dejó el 1 de agosto de
 * 2026 la carta pública con treinta de treinta y un productos rotulados
 * «Agotado». Estas pruebas fijan la regla nueva para que nadie la deshaga sin
 * darse cuenta.
 */

function producto(over: Partial<ProductoCatalogo> = {}): ProductoCatalogo {
  return {
    id: "p",
    slug: "latte",
    nombre: "Latte",
    nota: null,
    destacado: false,
    disponible: true,
    esModificador: false,
    archivado: false,
    imagenClave: null,
    imagen: null,
    variantes: [{ id: "v", etiqueta: null, precioCents: 600 }],
    ...over,
  };
}

function categoria(nombre: string, productos: ProductoCatalogo[]): CategoriaCatalogo {
  return {
    id: `c-${nombre}`,
    slug: nombre,
    nombre,
    mundo: "cafe",
    estado: "hoy",
    etiquetaTamanos: null,
    productos,
  };
}

describe("soloDisponibles", () => {
  it("un producto apagado desaparece de la carta", () => {
    const cats = [
      categoria("cafes", [
        producto({ id: "1", slug: "latte", nombre: "Latte" }),
        producto({ id: "2", slug: "espresso", nombre: "Espresso", disponible: false }),
      ]),
    ];

    const visibles = soloDisponibles(cats);

    expect(visibles).toHaveLength(1);
    expect(visibles[0]!.productos.map((p) => p.nombre)).toEqual(["Latte"]);
  });

  it("una sección donde no queda nada disponible tampoco se enseña", () => {
    const cats = [
      categoria("cafes", [producto({ disponible: false })]),
      categoria("matcha", [producto({ id: "3", slug: "matcha", nombre: "Matcha" })]),
    ];

    expect(soloDisponibles(cats).map((c) => c.nombre)).toEqual(["matcha"]);
  });

  it("una sección recién creada, sin productos, no se enseña", () => {
    // Es exactamente lo que pasó al crear «Bebidas de Temporada»: un recuadro
    // con título y nada debajo.
    const cats = [categoria("bebidas-de-temporada", [])];
    expect(soloDisponibles(cats)).toEqual([]);
  });

  it("si se apaga todo, no queda ninguna sección", () => {
    const cats = [
      categoria("cafes", [producto({ disponible: false })]),
      categoria("matcha", [producto({ id: "3", disponible: false })]),
    ];

    expect(soloDisponibles(cats)).toEqual([]);
  });

  it("no muta el catálogo que recibe", () => {
    const original = [
      categoria("cafes", [producto(), producto({ id: "2", disponible: false })]),
    ];

    soloDisponibles(original);

    // El panel usa el mismo catálogo y necesita ver lo apagado para encenderlo.
    expect(original[0]!.productos).toHaveLength(2);
  });

  it("un producto disponible pasa entero, sin tocarle nada", () => {
    const p = producto({ nota: "con avena", destacado: true });
    const [c] = soloDisponibles([categoria("cafes", [p])]);

    expect(c!.productos[0]).toEqual(p);
  });
});

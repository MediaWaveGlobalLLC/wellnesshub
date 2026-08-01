import { describe, expect, it } from "vitest";

import { precioDeCarta, precioLegible, type VarianteCatalogo } from "@/lib/catalogo/tipos";

/**
 * El precio tal y como se lee en /menu.
 *
 * `precioDeCarta` existe para reproducir la cadena que antes estaba escrita a
 * mano en `site.ts` —"4.25 / 4.75"—, así que lo primero que se comprueba aquí es
 * que sigue reproduciéndola.
 */

function variantes(...centavos: number[]): VarianteCatalogo[] {
  return centavos.map((precioCents, i) => ({
    id: `v${i}`,
    etiqueta: null,
    precioCents,
  }));
}

describe("precioDeCarta", () => {
  it("un solo precio se escribe tal cual", () => {
    expect(precioDeCarta(variantes(875))).toBe("8.75");
  });

  it("dos tamaños se separan con barra, en el orden en que vienen", () => {
    // El Americano de la carta oficial. Esta cadena está en el PDF.
    expect(precioDeCarta(variantes(425, 475))).toBe("4.25 / 4.75");
  });

  it("no repite un precio que se dice dos veces", () => {
    /*
      Una variante no siempre es un tamaño: en el Coffee Party lo que se elige
      es el SABOR, y las tres donas cuestan lo mismo. Sin esto la carta diría
      "4.75 / 4.75 / 4.75", que se lee como si costaran catorce dólares.
    */
    expect(precioDeCarta(variantes(475, 475, 475))).toBe("4.75");
  });

  it("agrupa aunque los repetidos no vengan seguidos", () => {
    // Deduplicar solo el anterior habría dejado pasar "8.95 / 4.75 / 8.95".
    expect(precioDeCarta(variantes(895, 475, 895))).toBe("8.95 / 4.75");
  });

  it("sin variantes devuelve cadena vacía y no revienta", () => {
    // Pasa de verdad: un producto recién creado desde el panel todavía no tiene
    // precio, y /menu lo pinta antes de que nadie le ponga uno.
    expect(precioDeCarta([])).toBe("");
  });

  it("los centavos exactos no se pierden por el camino", () => {
    // 0.1 + 0.2 no es 0.3. Por eso el precio son enteros y la división llega
    // solo al final, para pintar.
    expect(precioLegible(1495)).toBe("14.95");
    expect(precioLegible(5)).toBe("0.05");
    expect(precioLegible(0)).toBe("0.00");
  });
});

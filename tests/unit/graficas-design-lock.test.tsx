// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  BarrasHorizontales,
  GraficaBarras,
  GraficaLinea,
  Sparkline,
} from "@/components/admin/graficas/Grafica";
import type { Punto } from "@/components/admin/graficas/escala";

/**
 * El design lock, convertido en prueba.
 *
 * `npm run validate:design` lee el CÓDIGO FUENTE línea a línea. Eso basta para
 * un hex escrito a mano, pero no ve lo que sale renderizado: un color que se
 * componga en tiempo de ejecución —de un token, de una variable, de una
 * interpolación— pasaría el validador y llegaría igual al navegador.
 *
 * Aquí se renderiza cada gráfica y se mira el HTML resultante. Es la red que
 * cubre justo el hueco del validador.
 */

const serie: Punto[] = [
  { etiqueta: "lun", valor: 3 },
  { etiqueta: "mar", valor: 8 },
  { etiqueta: "mié", valor: 0 },
  { etiqueta: "jue", valor: 12 },
];

const GRAFICAS: [string, () => React.ReactElement][] = [
  ["GraficaBarras", () => <GraficaBarras serie={serie} titulo="Altas por día" />],
  ["GraficaLinea", () => <GraficaLinea serie={serie} titulo="Crédito por día" />],
  ["Sparkline", () => <Sparkline serie={serie} titulo="Tendencia" />],
  ["BarrasHorizontales", () => <BarrasHorizontales serie={serie} titulo="Top favoritos" />],
];

/** Familias de color que el validador prohíbe (`validate-design-system.mjs`). */
const FAMILIAS_PROHIBIDAS = [
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "cyan",
  "teal",
];

describe.each(GRAFICAS)("%s respeta el design lock", (_nombre, montar) => {
  const html = () => render(montar()).container.innerHTML;

  it("no emite ningún color literal", () => {
    const salida = html();
    expect(salida).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(salida).not.toMatch(/\b(?:rgb|rgba|hsl|hsla|oklch|lab|lch)\s*\(/i);
  });

  it("no emite gradientes", () => {
    const salida = html();
    expect(salida).not.toMatch(/gradient/i);
    // Los elementos SVG de degradado dentro de un <defs> son la vía por la que
    // los meten las librerías de gráficas. Por eso no se usa ninguna.
    expect(salida).not.toMatch(/<(?:linear|radial)Grad/i);
  });

  it("no usa ninguna familia de color prohibida", () => {
    const salida = html();
    for (const familia of FAMILIAS_PROHIBIDAS) {
      expect(
        new RegExp(`(?:fill|stroke|bg|text|border)-${familia}-`).test(salida),
        `apareció la familia ${familia}`
      ).toBe(false);
    }
  });

  it("no carga nada de fuera", () => {
    // La CSP es `script-src 'self'` y `img-src 'self' data: blob:`.
    expect(html()).not.toMatch(/https?:\/\//);
  });
});

describe("robustez ante datos raros", () => {
  it("una serie vacía no revienta", () => {
    for (const Componente of [GraficaBarras, GraficaLinea, BarrasHorizontales]) {
      expect(() => render(<Componente serie={[]} titulo="Vacío" />)).not.toThrow();
    }
    expect(() => render(<Sparkline serie={[]} titulo="Vacío" />)).not.toThrow();
  });

  it("todo a cero no produce atributos NaN", () => {
    // Un NaN en un atributo de SVG no da error: deja el lienzo en blanco. Es el
    // fallo más difícil de ver porque parece «no hay datos».
    const ceros = serie.map((p) => ({ ...p, valor: 0 }));
    const { container } = render(<GraficaBarras serie={ceros} titulo="Ceros" />);
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
  });

  it("un solo punto tampoco", () => {
    const { container } = render(
      <GraficaLinea serie={[{ etiqueta: "hoy", valor: 5 }]} titulo="Un dato" />
    );
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
  });

  it("un solo punto no rellena el área", () => {
    /*
      Con un dato la raya cruza todo el ancho para que se vea, pero rellenarla
      pinta el lienzo entero y se lee como «está lleno». Un bloque sólido
      comunica una magnitud que no existe.
    */
    const { container } = render(
      <GraficaLinea serie={[{ etiqueta: "hoy", valor: 5 }]} titulo="Un dato" />
    );
    expect(container.querySelector("polygon")).toBeNull();
    // Pero la línea sí está: no se pierde el dato.
    expect(container.querySelector("polyline")).not.toBeNull();
  });
});

describe("accesibilidad", () => {
  it("cada gráfica se anuncia como imagen con su descripción", () => {
    for (const [, montar] of GRAFICAS.slice(0, 3)) {
      const { container } = render(montar());
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("role")).toBe("img");
      expect(svg?.getAttribute("aria-label")).toBeTruthy();
      expect(svg?.querySelector("title")?.textContent).toBeTruthy();
    }
  });

  it("las gráficas con ejes llevan los datos en una tabla para lectores", () => {
    // Un lector de pantalla no puede interpretar un <path>. Sin esta tabla, la
    // gráfica es un agujero para quien no ve.
    for (const Componente of [GraficaBarras, GraficaLinea]) {
      const { container } = render(<Componente serie={serie} titulo="Con datos" />);
      const tabla = container.querySelector("table");
      expect(tabla).not.toBeNull();
      // Una fila por dato.
      expect(tabla!.querySelectorAll("tbody tr")).toHaveLength(serie.length);
    }
  });
});

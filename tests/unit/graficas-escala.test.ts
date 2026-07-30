import { describe, expect, it } from "vitest";

import {
  area,
  barras,
  escalaLineal,
  LIENZO,
  maximoDe,
  puntosPolilinea,
  techoBonito,
  ticks,
  variacion,
  type Punto,
} from "@/components/admin/graficas/escala";

/**
 * Los casos que rompen una gráfica no son visuales, son aritméticos: series
 * vacías, un solo punto, todos los valores iguales, todo a cero. Ahí es donde
 * aparece la división por cero y donde un `NaN` acaba dentro de un atributo SVG
 * dejando el lienzo en blanco sin dar ningún error.
 */

const serie = (valores: number[]): Punto[] =>
  valores.map((v, i) => ({ etiqueta: `d${i}`, valor: v }));

describe("escalaLineal", () => {
  it("mapea los extremos del dominio a los del rango", () => {
    expect(escalaLineal(0, [0, 100], [0, 200])).toBe(0);
    expect(escalaLineal(100, [0, 100], [0, 200])).toBe(200);
    expect(escalaLineal(50, [0, 100], [0, 200])).toBe(100);
  });

  it("funciona con el rango invertido, que es el caso del eje Y", () => {
    // En SVG el 0 está arriba: el valor más alto va a la coordenada más baja.
    expect(escalaLineal(0, [0, 10], [240, 0])).toBe(240);
    expect(escalaLineal(10, [0, 10], [240, 0])).toBe(0);
  });

  it("un dominio de un solo valor devuelve el centro, no Infinity", () => {
    // Todas las barras iguales: (v - d0) / 0 sería Infinity y el SVG quedaría
    // en blanco sin avisar.
    const r = escalaLineal(5, [5, 5], [0, 100]);
    expect(r).toBe(50);
    expect(Number.isFinite(r)).toBe(true);
  });
});

describe("techoBonito", () => {
  it("redondea hacia arriba a 1, 2, 5 o 10 por su magnitud", () => {
    expect(techoBonito(7)).toBe(10);
    expect(techoBonito(11)).toBe(20);
    expect(techoBonito(45)).toBe(50);
    expect(techoBonito(230)).toBe(500);
    expect(techoBonito(8437)).toBe(10000);
  });

  it("nunca devuelve cero, ni con series vacías o negativas", () => {
    // Un techo de cero haría que toda la gráfica dividiera por cero.
    expect(techoBonito(0)).toBe(1);
    expect(techoBonito(-5)).toBe(1);
  });
});

describe("ticks", () => {
  it("empieza en cero y termina en el techo", () => {
    const t = ticks(45);
    expect(t[0]).toBe(0);
    expect(t.at(-1)).toBe(50);
  });

  it("devuelve entre 3 y 6 marcas, nunca una ni catorce", () => {
    for (const max of [0, 1, 7, 99, 1234, 987654]) {
      const t = ticks(max);
      expect(t.length).toBeGreaterThanOrEqual(3);
      expect(t.length).toBeLessThanOrEqual(6);
    }
  });

  it("todas las marcas son finitas", () => {
    expect(ticks(0).every(Number.isFinite)).toBe(true);
  });
});

describe("puntosPolilinea", () => {
  it("una serie vacía no produce puntos", () => {
    expect(puntosPolilinea([], 0)).toEqual([]);
  });

  it("un solo punto produce una raya horizontal, no nada", () => {
    // Un <polyline> con una sola coordenada no dibuja: se vería un lienzo
    // vacío teniendo un dato.
    const p = puntosPolilinea(serie([5]), 5);
    expect(p).toHaveLength(2);
    expect(p[0]![1]).toBe(p[1]![1]);
  });

  it("reparte los puntos de borde a borde", () => {
    const { x0, x1 } = area(LIENZO);
    const p = puntosPolilinea(serie([1, 2, 3]), 3);
    expect(p[0]![0]).toBe(x0);
    expect(p.at(-1)![0]).toBe(x1);
  });

  it("todas las coordenadas son finitas incluso con todo a cero", () => {
    const p = puntosPolilinea(serie([0, 0, 0, 0]), 0);
    expect(p.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
  });

  it("el valor mayor queda por encima del menor en pantalla", () => {
    const p = puntosPolilinea(serie([1, 10]), 10);
    // Menor Y = más arriba.
    expect(p[1]![1]).toBeLessThan(p[0]![1]);
  });
});

describe("barras", () => {
  it("una serie vacía no produce barras", () => {
    expect(barras([], 0)).toEqual([]);
  });

  it("ninguna barra tiene altura negativa", () => {
    // Una altura negativa en un <rect> no se dibuja y además es un error de
    // atributo en algunos navegadores.
    const b = barras(serie([0, 5, 0, 10]), 10);
    expect(b.every((r) => r.alto >= 0)).toBe(true);
  });

  it("con todo a cero salen barras de altura cero, no un fallo", () => {
    const b = barras(serie([0, 0, 0]), 0);
    expect(b).toHaveLength(3);
    expect(b.every((r) => r.alto === 0 && Number.isFinite(r.x))).toBe(true);
  });

  it("las barras no se solapan entre sí", () => {
    const b = barras(serie([1, 2, 3, 4, 5]), 5);
    for (let i = 1; i < b.length; i++) {
      expect(b[i]!.x).toBeGreaterThanOrEqual(b[i - 1]!.x + b[i - 1]!.ancho);
    }
  });

  it("todas caben dentro del lienzo", () => {
    const { x0, x1 } = area(LIENZO);
    const b = barras(serie([3, 1, 4, 1, 5, 9, 2, 6]), 9);
    for (const r of b) {
      expect(r.x).toBeGreaterThanOrEqual(x0);
      expect(r.x + r.ancho).toBeLessThanOrEqual(x1 + 0.01);
    }
  });

  it("una barra siempre tiene ancho, aunque haya muchísimas", () => {
    const b = barras(serie(Array.from({ length: 400 }, () => 1)), 1);
    expect(b.every((r) => r.ancho >= 1)).toBe(true);
  });
});

describe("maximoDe", () => {
  it("es cero con serie vacía", () => {
    expect(maximoDe([])).toBe(0);
  });

  it("ignora negativos hacia abajo de cero", () => {
    expect(maximoDe(serie([-5, -2]))).toBe(0);
  });
});

describe("variacion", () => {
  it("calcula el porcentaje respecto al periodo anterior", () => {
    expect(variacion(150, 100)).toBe(50);
    expect(variacion(50, 100)).toBe(-50);
  });

  it("devuelve null si el periodo anterior fue cero", () => {
    // «Subió un infinito por ciento» no es información: la pantalla dirá
    // «sin comparación».
    expect(variacion(10, 0)).toBeNull();
    expect(variacion(0, 0)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { calcularProgreso, formatearDolares, formatearPuntos, type Nivel } from "@/lib/loyalty";

/** Umbrales sembrados en la migración 0005. */
const NIVELES: Nivel[] = [
  { key: "semilla", label: "Semilla", minPoints: 0, sortOrder: 1, description: null },
  { key: "brote", label: "Brote", minPoints: 500, sortOrder: 2, description: null },
  { key: "raiz", label: "Raíz", minPoints: 2000, sortOrder: 3, description: null },
  { key: "florecer", label: "Florecer", minPoints: 5000, sortOrder: 4, description: null },
];

describe("calcularProgreso", () => {
  it("reproduce los números del mockup 02", () => {
    // El mockup muestra nivel Brote, 750 / 2.000 pts y 1.250 para el siguiente.
    const p = calcularProgreso(750, NIVELES);
    expect(p.actual.key).toBe("brote");
    expect(p.siguiente?.key).toBe("raiz");
    expect(p.faltan).toBe(1250);
    expect(p.meta).toBe(2000);
  });

  it("empieza en semilla con cero puntos", () => {
    const p = calcularProgreso(0, NIVELES);
    expect(p.actual.key).toBe("semilla");
    expect(p.siguiente?.key).toBe("brote");
    expect(p.faltan).toBe(500);
    expect(p.fraccion).toBe(0);
  });

  it("sube de nivel justo al alcanzar el umbral", () => {
    expect(calcularProgreso(499, NIVELES).actual.key).toBe("semilla");
    expect(calcularProgreso(500, NIVELES).actual.key).toBe("brote");
    expect(calcularProgreso(1999, NIVELES).actual.key).toBe("brote");
    expect(calcularProgreso(2000, NIVELES).actual.key).toBe("raiz");
  });

  it("en el nivel máximo no hay siguiente y la barra va llena", () => {
    const p = calcularProgreso(9999, NIVELES);
    expect(p.actual.key).toBe("florecer");
    expect(p.siguiente).toBeNull();
    expect(p.faltan).toBe(0);
    expect(p.fraccion).toBe(1);
  });

  it("la fracción concuerda con la etiqueta que se pinta al lado", () => {
    // La barra lleva escrito "750 / 2.000 pts": debe representar esa misma
    // proporción, no el avance dentro del tramo (que sería 250/1.500).
    const p = calcularProgreso(750, NIVELES);
    expect(p.fraccion).toBeCloseTo(750 / 2000);
  });

  it("no se rompe con los umbrales desordenados", () => {
    const revueltos = [...NIVELES].reverse();
    expect(calcularProgreso(750, revueltos).actual.key).toBe("brote");
  });

  it("trata un saldo negativo o fraccionario como entero no negativo", () => {
    expect(calcularProgreso(-50, NIVELES).puntos).toBe(0);
    expect(calcularProgreso(750.9, NIVELES).puntos).toBe(750);
  });

  it("falla claro si no hay niveles configurados", () => {
    expect(() => calcularProgreso(100, [])).toThrow(/loyalty_tiers/);
  });
});

describe("formato", () => {
  it("muestra el crédito en dólares", () => {
    expect(formatearDolares(6840)).toContain("68.40");
    expect(formatearDolares(0)).toContain("0.00");
  });

  it("separa los millares de los puntos, como el mockup", () => {
    expect(formatearPuntos(1350)).toBe("1,350");
  });
});

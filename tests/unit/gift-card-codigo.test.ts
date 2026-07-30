// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import {
  generarCodigo,
  hashCodigo,
  hashesIguales,
  normalizarCodigo,
  pareceCodigoValido,
} from "@/lib/gift-cards/codigo";

beforeAll(() => {
  process.env.GIFT_CARD_PEPPER = "pepper-de-pruebas-con-longitud-suficiente-abc";
});

describe("generación", () => {
  it("produce el formato por bloques con prefijo de marca", () => {
    const { codigo } = generarCodigo();
    expect(codigo).toMatch(/^SMB(-[0-9A-Z]{5}){5}-[0-9A-Z]$/);
  });

  it("no usa símbolos ambiguos: sin I, L, O ni U", () => {
    for (let i = 0; i < 200; i++) {
      const { codigo } = generarCodigo();
      expect(codigo.slice(4)).not.toMatch(/[ILOU]/);
    }
  });

  it("los últimos cuatro coinciden con el final del código", () => {
    const { codigo, last4 } = generarCodigo();
    expect(normalizarCodigo(codigo).slice(-4)).toBe(last4);
  });

  it("no repite: 2.000 códigos, 2.000 valores distintos", () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 2000; i++) vistos.add(generarCodigo().codigo);
    expect(vistos.size).toBe(2000);
  });

  it("mantiene los 128 bits de entropía exigidos por docs/06", () => {
    // 26 símbolos de un alfabeto de 32 = 26 × 5 = 130 bits.
    const normalizado = normalizarCodigo(generarCodigo().codigo);
    expect(normalizado).toHaveLength(26);
    expect(normalizado.length * 5).toBeGreaterThanOrEqual(128);
  });
});

describe("normalización de lo que escribe la persona", () => {
  it("acepta el código tal cual se envía", () => {
    const { codigo } = generarCodigo();
    expect(pareceCodigoValido(normalizarCodigo(codigo))).toBe(true);
  });

  it("da igual el prefijo, los guiones, los espacios y las mayúsculas", () => {
    const { codigo } = generarCodigo();
    const canonico = normalizarCodigo(codigo);
    const variantes = [
      codigo.toLowerCase(),
      codigo.replace(/-/g, ""),
      codigo.replace(/-/g, " "),
      codigo.replace(/^SMB-/, ""),
      `  ${codigo}  `,
    ];
    for (const v of variantes) expect(normalizarCodigo(v)).toBe(canonico);
  });

  it("corrige las confusiones típicas al copiar a mano", () => {
    // I y L se leen como 1, O como 0, U como V.
    expect(normalizarCodigo("I")).toBe("1");
    expect(normalizarCodigo("L")).toBe("1");
    expect(normalizarCodigo("O")).toBe("0");
    expect(normalizarCodigo("U")).toBe("V");
  });

  /*
   * Regresión: el prefijo se quitaba con `^SMB`, y como S, M y B están en el
   * alfabeto, un código legítimo que empezara por esas tres letras perdía sus
   * tres primeros símbolos y se rechazaba como inválido.
   */
  it("no recorta un código que empieza por S, M, B", () => {
    const cuerpo = "SMB" + "23456789ABCDEFGHJKMNPQRST";
    expect(cuerpo).toHaveLength(28);
    const codigoSinPrefijo = cuerpo.slice(0, 26);
    expect(normalizarCodigo(codigoSinPrefijo)).toBe(codigoSinPrefijo);
    expect(pareceCodigoValido(normalizarCodigo(codigoSinPrefijo))).toBe(true);
  });

  it("sí quita el prefijo cuando la longitud delata que lo lleva", () => {
    const cuerpo = "23456789ABCDEFGHJKMNPQRSTV";
    expect(cuerpo).toHaveLength(26);
    expect(normalizarCodigo(`SMB-${cuerpo}`)).toBe(cuerpo);
    expect(normalizarCodigo(`  smb ${cuerpo}  `)).toBe(cuerpo);
  });

  it("rechaza longitudes que no son de código", () => {
    expect(pareceCodigoValido("ABC")).toBe(false);
    expect(pareceCodigoValido("")).toBe(false);
    expect(pareceCodigoValido("A".repeat(30))).toBe(false);
  });
});

describe("hash", () => {
  it("es estable para el mismo código", () => {
    const { codigo } = generarCodigo();
    expect(hashCodigo(codigo)).toBe(hashCodigo(codigo));
  });

  it("no depende del formato con el que se escriba", () => {
    const { codigo } = generarCodigo();
    expect(hashCodigo(codigo.toLowerCase().replace(/-/g, ""))).toBe(hashCodigo(codigo));
  });

  it("dos códigos distintos dan hashes distintos", () => {
    expect(hashCodigo(generarCodigo().codigo)).not.toBe(hashCodigo(generarCodigo().codigo));
  });

  it("nunca contiene el código en claro", () => {
    const { codigo } = generarCodigo();
    const hash = hashCodigo(codigo);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(normalizarCodigo(codigo));
  });

  it("cambia por completo si cambia el pepper", () => {
    const { codigo } = generarCodigo();
    const conA = hashCodigo(codigo);
    process.env.GIFT_CARD_PEPPER = "otro-pepper-igual-de-largo-para-la-prueba-xyz";
    const conB = hashCodigo(codigo);
    process.env.GIFT_CARD_PEPPER = "pepper-de-pruebas-con-longitud-suficiente-abc";
    expect(conA).not.toBe(conB);
  });

  it("exige un pepper configurado y suficientemente largo", () => {
    const previo = process.env.GIFT_CARD_PEPPER;
    process.env.GIFT_CARD_PEPPER = "corto";
    expect(() => hashCodigo("SMB-AAAAA")).toThrow(/GIFT_CARD_PEPPER/);
    process.env.GIFT_CARD_PEPPER = previo;
  });
});

describe("comparación de hashes", () => {
  it("reconoce iguales y distintos", () => {
    const a = "a".repeat(64);
    expect(hashesIguales(a, a)).toBe(true);
    expect(hashesIguales(a, "b".repeat(64))).toBe(false);
    expect(hashesIguales(a, "abc")).toBe(false);
  });
});

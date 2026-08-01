import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Los iconos de aplicación existen y son lo que dicen ser.
 *
 * `favicon.ico` lo escribe `scripts/build-app-icons.mjs` a mano, byte a byte:
 * cabecera, tabla de entradas y PNG dentro. Un desplazamiento mal calculado
 * produce un fichero que Node lee sin quejarse y que el navegador pinta como
 * un icono roto — y nadie mira su propia pestaña con lupa. Esto lo caza.
 *
 * No se comprueba el dibujo, que es cosa de mirarlo. Se comprueba la fontanería.
 */

const APP = path.join(process.cwd(), "src/app");

/** Lee la tabla de entradas de un .ico. */
function leerIco(buf: Buffer) {
  expect(buf.readUInt16LE(0), "campo reservado").toBe(0);
  expect(buf.readUInt16LE(2), "tipo: 1 = icono").toBe(1);

  const total = buf.readUInt16LE(4);
  const entradas = [];
  for (let i = 0; i < total; i++) {
    const o = 6 + i * 16;
    entradas.push({
      // 0 en el ancho significa 256, que es como el formato codifica el máximo.
      lado: buf.readUInt8(o) || 256,
      alto: buf.readUInt8(o + 1) || 256,
      bytes: buf.readUInt32LE(o + 8),
      offset: buf.readUInt32LE(o + 12),
    });
  }
  return entradas;
}

const PNG_MAGICO = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("iconos de aplicación", () => {
  it("favicon.ico trae los tres tamaños que Next sirve en /favicon.ico", () => {
    const buf = fs.readFileSync(path.join(APP, "favicon.ico"));
    const entradas = leerIco(buf);

    expect(entradas.map((e) => e.lado)).toEqual([16, 32, 48]);
    // Cuadrados: un icono con proporción no cuadrada lo estira el navegador.
    for (const e of entradas) expect(e.alto, `alto de ${e.lado}`).toBe(e.lado);
  });

  it("cada entrada del ico apunta a un PNG de verdad, dentro del fichero", () => {
    const buf = fs.readFileSync(path.join(APP, "favicon.ico"));
    const entradas = leerIco(buf);

    for (const e of entradas) {
      // El fallo real que esto persigue: un offset que se sale, o que solapa.
      expect(e.offset + e.bytes, `la entrada de ${e.lado} se sale del fichero`).toBeLessThanOrEqual(
        buf.length
      );
      const png = buf.subarray(e.offset, e.offset + e.bytes);
      expect(png.subarray(0, 8).equals(PNG_MAGICO), `la entrada de ${e.lado} no es un PNG`).toBe(
        true
      );
    }

    // Y que no sobre ni falte ningún byte entre la tabla y el final.
    const primera = Math.min(...entradas.map((e) => e.offset));
    expect(primera, "la primera imagen debe ir justo tras la tabla").toBe(
      6 + entradas.length * 16
    );
    const ultima = Math.max(...entradas.map((e) => e.offset + e.bytes));
    expect(ultima, "sobran bytes al final del ico").toBe(buf.length);
  });

  it("están el icono de pestaña y el de iOS, y son PNG", () => {
    for (const nombre of ["icon.png", "apple-icon.png"]) {
      const buf = fs.readFileSync(path.join(APP, nombre));
      expect(buf.subarray(0, 8).equals(PNG_MAGICO), `${nombre} no es un PNG`).toBe(true);

      // Ancho y alto viven en el IHDR, que en un PNG siempre empieza en el byte 16.
      const ancho = buf.readUInt32BE(16);
      const alto = buf.readUInt32BE(20);
      expect(ancho, `${nombre} no es cuadrado`).toBe(alto);
      expect(ancho, `${nombre} demasiado pequeño`).toBeGreaterThanOrEqual(180);
    }
  });
});

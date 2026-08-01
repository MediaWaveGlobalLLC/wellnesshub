import { describe, expect, it } from "vitest";

import {
  MAX_BYTES,
  revisarAvatar,
  rutaDeAvatar,
  rutaDesdeUrl,
  tipoReal,
} from "@/lib/perfil/avatar";

/**
 * Qué se acepta como foto de perfil.
 *
 * El bucket es de lectura pública, así que lo que entre aquí lo puede pedir
 * cualquiera que tenga la URL. Estas pruebas fijan que la decisión la toman los
 * bytes y nunca el nombre ni el `Content-Type` que manda el navegador.
 */

function conFirma(firma: number[], relleno = 64): Uint8Array {
  const b = new Uint8Array(firma.length + relleno);
  b.set(firma, 0);
  return b;
}

const JPEG = conFirma([0xff, 0xd8, 0xff, 0xe0]);
const PNG = conFirma([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function webp(): Uint8Array {
  const b = new Uint8Array(64);
  const escribe = (texto: string, en: number) => {
    for (let i = 0; i < texto.length; i++) b[en + i] = texto.charCodeAt(i);
  };
  escribe("RIFF", 0);
  escribe("WEBP", 8);
  return b;
}

describe("tipoReal", () => {
  it("reconoce JPEG, PNG y WebP por sus primeros bytes", () => {
    expect(tipoReal(JPEG)).toEqual({ mime: "image/jpeg", extension: "jpg" });
    expect(tipoReal(PNG)).toEqual({ mime: "image/png", extension: "png" });
    expect(tipoReal(webp())).toEqual({ mime: "image/webp", extension: "webp" });
  });

  it("un SVG no pasa, aunque sea una imagen", () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');
    expect(tipoReal(svg)).toBeNull();
  });

  it("un HTML disfrazado no pasa", () => {
    const html = new TextEncoder().encode("<!doctype html><script>alert(1)</script>");
    expect(tipoReal(html)).toBeNull();
  });

  it("un archivo más corto que la firma no revienta", () => {
    expect(tipoReal(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(tipoReal(new Uint8Array([]))).toBeNull();
  });

  it("RIFF que no es WEBP no pasa (un WAV empieza igual)", () => {
    const wav = new Uint8Array(64);
    const escribe = (t: string, en: number) => {
      for (let i = 0; i < t.length; i++) wav[en + i] = t.charCodeAt(i);
    };
    escribe("RIFF", 0);
    escribe("WAVE", 8);
    expect(tipoReal(wav)).toBeNull();
  });
});

describe("revisarAvatar", () => {
  it("acepta una imagen de verdad", () => {
    expect(revisarAvatar(JPEG, "image/jpeg")).toEqual({
      ok: true,
      tipo: { mime: "image/jpeg", extension: "jpg" },
    });
  });

  it("NO se cree el Content-Type: decide por los bytes", () => {
    const html = new TextEncoder().encode("<!doctype html><script>alert(1)</script>");
    const r = revisarAvatar(html, "image/png");

    expect(r.ok).toBe(false);
  });

  it("un JPEG declarado como texto entra igual: mandan los bytes", () => {
    const r = revisarAvatar(JPEG, "text/plain");
    expect(r).toEqual({ ok: true, tipo: { mime: "image/jpeg", extension: "jpg" } });
  });

  it("rechaza lo que pasa de 2 MB", () => {
    const gordo = new Uint8Array(MAX_BYTES + 1);
    gordo.set([0xff, 0xd8, 0xff], 0);

    const r = revisarAvatar(gordo, "image/jpeg");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/2 MB/);
  });

  it("justo en el tope todavía entra", () => {
    const justo = new Uint8Array(MAX_BYTES);
    justo.set([0xff, 0xd8, 0xff], 0);
    expect(revisarAvatar(justo).ok).toBe(true);
  });

  it("rechaza un archivo vacío", () => {
    expect(revisarAvatar(new Uint8Array([])).ok).toBe(false);
  });
});

describe("rutaDeAvatar", () => {
  it("carpeta por persona y nombre al azar", () => {
    const ruta = rutaDeAvatar("11111111-1111-1111-1111-111111111111", "jpg", "abc-123");
    expect(ruta).toBe("11111111-1111-1111-1111-111111111111/abc-123.jpg");
  });

  it("el nombre NO es el id: la URL no se puede adivinar", () => {
    const id = "11111111-1111-1111-1111-111111111111";
    const ruta = rutaDeAvatar(id, "jpg", "abc-123");
    expect(ruta.split("/")[1]).not.toContain(id);
  });
});

describe("rutaDesdeUrl", () => {
  const base = "https://proyecto.supabase.co/storage/v1/object/public/avatares/";

  it("saca la ruta de una URL nuestra", () => {
    expect(rutaDesdeUrl(`${base}usuario-1/foto.jpg`)).toBe("usuario-1/foto.jpg");
  });

  it("descarta una URL de otro sitio", () => {
    expect(rutaDesdeUrl("https://otro.example.com/avatares/usuario-1/foto.jpg")).toBeNull();
  });

  it("descarta otro bucket del mismo proyecto", () => {
    expect(
      rutaDesdeUrl("https://proyecto.supabase.co/storage/v1/object/public/privado/secreto.pdf")
    ).toBeNull();
  });

  it("descarta rutas con salto de directorio", () => {
    expect(rutaDesdeUrl(`${base}../../otra/cosa.jpg`)).toBeNull();
  });

  it("descarta una ruta que no tenga la forma carpeta/archivo", () => {
    expect(rutaDesdeUrl(`${base}suelto.jpg`)).toBeNull();
    expect(rutaDesdeUrl(`${base}a/b/c.jpg`)).toBeNull();
    expect(rutaDesdeUrl(base)).toBeNull();
  });

  it("null entra y null sale", () => {
    expect(rutaDesdeUrl(null)).toBeNull();
  });

  it("deshace el escapado de la URL", () => {
    expect(rutaDesdeUrl(`${base}usuario%201/foto.jpg`)).toBe("usuario 1/foto.jpg");
  });
});

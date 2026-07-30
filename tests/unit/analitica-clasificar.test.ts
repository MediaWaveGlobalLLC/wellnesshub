import { describe, expect, it } from "vitest";

import {
  clasificarOrigen,
  decidirVisita,
  esNavegacion,
  esRobot,
  normalizarRuta,
  ORIGENES,
  RUTA_OTRAS,
} from "@/lib/analitica/clasificar";
import contrato from "../../config/route-contracts.json";

/** `Headers` de verdad: es lo que recibe el proxy. */
function cab(pares: Record<string, string>): Headers {
  return new Headers(pares);
}

const NAVEGADOR =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

describe("normalizarRuta", () => {
  it("acepta las rutas del contrato tal cual", () => {
    for (const ruta of [...contrato.public, ...contrato.authenticated]) {
      expect(normalizarRuta(ruta)).toBe(ruta);
    }
  });

  it("nunca cuenta el panel de administración", () => {
    // Las visitas de la dueña a su propio panel taparían las de los clientes en
    // «páginas más vistas», que es justo lo que la pantalla existe para enseñar.
    expect(normalizarRuta("/admin")).toBeNull();
    expect(normalizarRuta("/admin/visitas")).toBeNull();
    expect(normalizarRuta("/admin/usuarios/8f14e45f-ceea-4d4c-9c8e-4d4c9c8e4d4c")).toBeNull();
  });

  it("ni la API, ni los internos de Next, ni la página de diseño", () => {
    expect(normalizarRuta("/api/checkout")).toBeNull();
    expect(normalizarRuta("/_next/data/algo.json")).toBeNull();
    expect(normalizarRuta("/design-system")).toBeNull();
  });

  it("`/menu` y `/menu/` son la misma fila", () => {
    expect(normalizarRuta("/menu/")).toBe("/menu");
    expect(normalizarRuta("/")).toBe("/");
  });

  it("colapsa identificadores en vez de guardarlos", () => {
    // El caso que importa: un UUID en la ruta es el identificador de una
    // persona. Si llegara entero a la base, la tabla dejaría de ser anónima.
    const conUuid = normalizarRuta("/pedido/8f14e45f-ceea-4d4c-9c8e-4d4c9c8e4d4c");
    expect(conUuid).toBe(RUTA_OTRAS);
    expect(conUuid).not.toContain("8f14e45f");

    expect(normalizarRuta("/pedido/12345")).toBe(RUTA_OTRAS);
  });

  it("todo lo que no es del contrato cae en un solo cubo", () => {
    // Sin esto, cada URL inventada por un escáner sería una fila nueva.
    for (const basura of ["/wp-admin", "/.env", "/pagina-que-no-existe", "/MENU"]) {
      expect(normalizarRuta(basura)).toBe(RUTA_OTRAS);
    }
  });

  it("una ruta absurdamente larga no revienta el CHECK de la tabla", () => {
    // La columna acepta 80 caracteres. Devolver algo más largo haría que la
    // inserción fallara en producción y la visita se perdiera sin explicación.
    const larga = "/" + "a/".repeat(100);
    expect(normalizarRuta(larga)).toBe(RUTA_OTRAS);
    expect(normalizarRuta(larga)!.length).toBeLessThanOrEqual(80);
  });

  it("rechaza lo que no empieza por barra", () => {
    expect(normalizarRuta("menu")).toBeNull();
    expect(normalizarRuta("")).toBeNull();
  });

  it("todo lo que devuelve encaja en el CHECK de la columna", () => {
    const permitido = /^\/[A-Za-z0-9/_[\]-]*$/;
    const candidatos = [...contrato.public, ...contrato.authenticated, RUTA_OTRAS];
    for (const ruta of candidatos) {
      expect(ruta).toMatch(permitido);
      expect(ruta.length).toBeLessThanOrEqual(80);
    }
  });
});

describe("clasificarOrigen", () => {
  it("sin referente es directo", () => {
    expect(clasificarOrigen(null, "siembra.pr")).toBe("directo");
    expect(clasificarOrigen("", "siembra.pr")).toBe("directo");
  });

  it("desde la propia web es interno, no directo", () => {
    // Este es el que falsearía todo lo demás: quien llega de Instagram y luego
    // pincha «Menú» generaría una visita «directa» y la categoría equivocada
    // acabaría siendo mayoría.
    expect(clasificarOrigen("https://siembra.pr/menu", "siembra.pr")).toBe("interno");
    expect(clasificarOrigen("https://www.siembra.pr/", "siembra.pr")).toBe("interno");
  });

  it("reconoce las redes sin quedarse con el enlace", () => {
    expect(clasificarOrigen("https://l.instagram.com/?u=algo", "siembra.pr")).toBe("instagram");
    expect(clasificarOrigen("https://www.instagram.com/p/Cxyz/", "siembra.pr")).toBe("instagram");
    expect(clasificarOrigen("https://l.facebook.com/l.php?u=x", "siembra.pr")).toBe("facebook");
    expect(clasificarOrigen("https://fb.me/algo", "siembra.pr")).toBe("facebook");
    expect(clasificarOrigen("https://www.tiktok.com/@siembra", "siembra.pr")).toBe("tiktok");
    expect(clasificarOrigen("https://wa.me/17878001234", "siembra.pr")).toBe("whatsapp");
    expect(clasificarOrigen("android-app://com.whatsapp", "siembra.pr")).toBe("whatsapp");
  });

  it("reconoce Google en cualquier dominio de país", () => {
    for (const r of [
      "https://www.google.com/",
      "https://www.google.com.pr/",
      "https://google.es/search?q=siembra",
      "https://news.google.com/",
    ]) {
      expect(clasificarOrigen(r, "siembra.pr")).toBe("google");
    }
  });

  it("no confunde un dominio que solo CONTIENE el nombre", () => {
    // `instagram-clone.com` no es Instagram, y `notgoogle.com` no es Google.
    expect(clasificarOrigen("https://instagram-clone.com/x", "siembra.pr")).toBe("otro");
    expect(clasificarOrigen("https://notgoogle.com/x", "siembra.pr")).toBe("otro");
    // Y `evilsiembra.pr` no es esta web.
    expect(clasificarOrigen("https://evilsiembra.pr/", "siembra.pr")).toBe("otro");
  });

  it("un referente roto no revienta ni inventa categoría", () => {
    expect(clasificarOrigen("no-es-una-url", "siembra.pr")).toBe("otro");
  });

  it("solo devuelve valores del CHECK de la tabla", () => {
    const entradas = [null, "", "https://siembra.pr/", "https://x.com/", "roto", "https://google.com/"];
    for (const e of entradas) {
      expect(ORIGENES).toContain(clasificarOrigen(e, "siembra.pr"));
    }
  });
});

describe("esNavegacion", () => {
  it("cuenta la carga de una página", () => {
    // Cabeceras reales de Chrome al abrir una dirección.
    expect(
      esNavegacion(
        cab({
          "sec-fetch-dest": "document",
          "sec-fetch-mode": "navigate",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        })
      )
    ).toBe(true);
  });

  it("NO cuenta ningún fetch, venga de donde venga", () => {
    /*
      El motivo de existir de esta función. Next precarga los `<Link>` que
      entran en pantalla o reciben el ratón: pasar el cursor por el menú
      principal dispara seis peticiones a seis páginas que nadie abrió, y todas
      son `fetch`.

      Se descartan por `sec-fetch-dest` y NO por las cabeceras `rsc` /
      `next-router-prefetch`: Next 16 las quita antes de que el proxy vea la
      petición. Comprobado contra un build de producción mandando a la vez
      `rsc: 1` y una cabecera inventada; llegó la inventada y no las de Next.
    */
    expect(esNavegacion(cab({ "sec-fetch-dest": "empty", accept: "*/*" }))).toBe(false);
    // Ni aunque el fetch pida HTML: `sec-fetch-dest` manda sobre `accept`.
    expect(esNavegacion(cab({ "sec-fetch-dest": "empty", accept: "text/html" }))).toBe(false);
  });

  it("NO cuenta una precarga especulativa del navegador", () => {
    // Speculation Rules precarga documentos enteros: llega como `document` y
    // solo `sec-purpose` lo delata.
    expect(
      esNavegacion(
        cab({
          "sec-fetch-dest": "document",
          "sec-purpose": "prefetch;prerender",
          accept: "text/html",
        })
      )
    ).toBe(false);
  });

  it("sin Sec-Fetch-* se cae al respaldo por `accept`", () => {
    // Safari anterior a 16.4 no manda Sec-Fetch-*. Sin respaldo desaparecería
    // de las cifras sin que nada avisara.
    expect(esNavegacion(cab({ accept: "text/html,application/xhtml+xml" }))).toBe(true);
    expect(esNavegacion(cab({ accept: "application/json" }))).toBe(false);
    expect(esNavegacion(cab({}))).toBe(false);
  });
});

describe("esRobot", () => {
  it("deja pasar navegadores de verdad", () => {
    expect(esRobot(NAVEGADOR)).toBe(false);
    expect(
      esRobot(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
      )
    ).toBe(false);
  });

  it("descarta rastreadores, sondas y previsualizadores", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "vercel-screenshot/1.0",
      "curl/8.4.0",
      "python-requests/2.31.0",
      "Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0.0.0",
      "facebookexternalhit/1.1",
      "WhatsApp/2.23",
    ]) {
      expect(esRobot(ua)).toBe(true);
    }
  });

  it("sin user-agent se descarta", () => {
    // Un navegador siempre lo manda. Que falte es señal de cliente automatizado.
    expect(esRobot(null)).toBe(true);
    expect(esRobot("   ")).toBe(true);
  });
});

describe("decidirVisita", () => {
  const base = {
    method: "GET",
    pathname: "/menu",
    host: "siembra.pr",
    cabeceras: cab({
      "sec-fetch-dest": "document",
      accept: "text/html",
      "user-agent": NAVEGADOR,
    }),
  };

  it("una visita normal se cuenta", () => {
    expect(decidirVisita(base)).toEqual({ ruta: "/menu", origen: "directo" });
  });

  it("conserva la procedencia externa", () => {
    expect(
      decidirVisita({
        ...base,
        cabeceras: cab({
          "sec-fetch-dest": "document",
          accept: "text/html",
          "user-agent": NAVEGADOR,
          referer: "https://l.instagram.com/?u=https%3A%2F%2Fsiembra.pr%2Fmenu",
        }),
      })
    ).toEqual({ ruta: "/menu", origen: "instagram" });
  });

  it("un POST no es una visita", () => {
    // El envío de un formulario no abre una página: la página ya se contó, y la
    // redirección posterior se cuenta por su cuenta.
    expect(decidirVisita({ ...base, method: "POST" })).toBeNull();
  });

  it("el robot se descarta antes de mirar la ruta", () => {
    expect(
      decidirVisita({
        ...base,
        cabeceras: cab({
          "sec-fetch-dest": "document",
          accept: "text/html",
          "user-agent": "Googlebot/2.1",
        }),
      })
    ).toBeNull();
  });

  it("la precarga se descarta aunque la ruta sea buena", () => {
    expect(
      decidirVisita({
        ...base,
        cabeceras: cab({
          "sec-fetch-dest": "empty",
          accept: "*/*",
          "user-agent": NAVEGADOR,
        }),
      })
    ).toBeNull();
  });

  it("el panel no se cuenta ni siendo una navegación perfecta", () => {
    expect(decidirVisita({ ...base, pathname: "/admin/visitas" })).toBeNull();
  });
});

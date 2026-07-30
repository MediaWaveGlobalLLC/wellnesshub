import { NextResponse, type NextRequest } from "next/server";

import { actorPuede, exigirDuena } from "@/lib/services/admin-service";
import { listarNewsletter } from "@/lib/services/operaciones";

/**
 * Exportación de la lista de correo en CSV.
 *
 * Es una ruta y no una server action porque el resultado es un FICHERO: con
 * `Content-Disposition: attachment` el navegador lo descarga solo, sin
 * JavaScript que construya un Blob ni una página que se traiga la lista entera
 * para poder ofrecerla.
 *
 * Autoriza igual que la pantalla, y no «porque venga de la pantalla»: una ruta
 * que devuelve todos los correos del negocio tiene que comprobarlo ella misma.
 */

export const dynamic = "force-dynamic";

/**
 * Escapado CSV, con el freno de inyección de fórmulas.
 *
 * Un valor que empiece por `=`, `+`, `-` o `@` lo interpretan Excel y Sheets
 * como fórmula al abrir el fichero. Con correos es difícil que pase, pero
 * `source` es texto que llega desde el formulario público: se antepone un
 * apóstrofo, que es lo que ambas hojas de cálculo entienden como «esto es
 * texto».
 */
function csv(valor: string | null): string {
  const v = valor ?? "";
  const seguro = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${seguro.replace(/"/g, '""')}"`;
}

/** Fecha ISO corta, que es la que una hoja de cálculo entiende sin pelearse. */
function dia(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

export async function GET(request: NextRequest) {
  const actor = await exigirDuena();
  if (!actor || !actorPuede(actor, "ver_newsletter")) {
    // 404 y no 403: quien no puede verla no debería ni saber que existe.
    return new NextResponse("No encontrado", { status: 404 });
  }

  const consulta = (request.nextUrl.searchParams.get("q") ?? "").trim();

  /*
    Se pagina en bloques de 500 —el tope que acepta la función SQL— en vez de
    pedir «todo». Sin esto habría que elegir entre un límite arbitrario que
    recorta la exportación en silencio o una consulta sin techo.
  */
  const filas: string[] = ["email,origen,alta,confirmado,baja"];
  const BLOQUE = 500;

  for (let pagina = 1; ; pagina++) {
    const { suscriptores, total } = await listarNewsletter(consulta, pagina, BLOQUE);

    for (const s of suscriptores) {
      filas.push(
        [csv(s.email), csv(s.origen), csv(dia(s.altaAt)), csv(dia(s.confirmadoAt)), csv(dia(s.bajaAt))].join(",")
      );
    }

    if (suscriptores.length === 0 || pagina * BLOQUE >= total) break;
  }

  const hoy = new Date().toISOString().slice(0, 10);

  return new NextResponse(
    // BOM al principio: sin él, Excel en Windows abre el fichero en la
    // codificación del sistema y los acentos salen rotos.
    "﻿" + filas.join("\r\n") + "\r\n",
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="siembra-newsletter-${hoy}.csv"`,
        // Una lista de correos no se guarda en ninguna caché intermedia.
        "Cache-Control": "no-store",
      },
    }
  );
}

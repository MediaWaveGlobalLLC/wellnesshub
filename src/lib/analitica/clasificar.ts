import contrato from "../../../config/route-contracts.json";

/**
 * Decidir QUÉ se cuenta y CÓMO se etiqueta — `0016_analitica.sql`.
 *
 * Todo lo de aquí son funciones puras sobre cabeceras y cadenas: ni red, ni
 * base de datos, ni `NextRequest`. Se prueban con objetos literales
 * (`tests/unit/analitica-clasificar.test.ts`) y es donde vive el 90 % de las
 * decisiones difíciles de esta fase. La parte que escribe en Postgres
 * (`registrar.ts`) es media docena de líneas justamente porque aquí ya está
 * todo resuelto.
 *
 * SIN `server-only`: no hay ni un secreto en este archivo, y el proxy corre en
 * el runtime edge, donde ese paquete no siempre está bien condicionado. El
 * secreto vive en `registrar.ts`, que sí está aislado.
 */

/** Categorías de procedencia. Idénticas al CHECK de `visitas_agregado`. */
export const ORIGENES = [
  "directo",
  "interno",
  "instagram",
  "facebook",
  "tiktok",
  "whatsapp",
  "google",
  "otro",
] as const;

export type Origen = (typeof ORIGENES)[number];

/**
 * Cubo para todo lo que no es una ruta del contrato: 404, enlaces rotos,
 * sondas de robots que fingen ser un navegador, páginas huérfanas.
 *
 * Sin él, cada URL inventada por un escáner sería una fila nueva y la tabla
 * crecería sin techo. Con él, la cardinalidad está acotada por el contrato de
 * rutas y ese tráfico sigue viéndose, agrupado y con su nombre.
 */
export const RUTA_OTRAS = "/[otras]";

/**
 * Rutas que SÍ se cuentan.
 *
 * Sale de `config/route-contracts.json` para que no haya dos listas que se
 * desincronicen. Se excluye a propósito el bloque `admin`: el panel lo abre la
 * dueña, y sus propias visitas en «páginas más vistas» taparían las de los
 * clientes, que es lo que la pantalla existe para enseñar.
 */
const RUTAS = new Set<string>([...contrato.public, ...contrato.authenticated]);

/** Prefijos que nunca se cuentan, ni siquiera como `(otras)`. */
const EXCLUIDOS = ["/admin", "/api", "/_next", "/design-system"];

/**
 * Segmento que es un identificador y no un nombre de página.
 *
 * UUID, número, o cualquier cadena larga sin vocales reconocibles (un token).
 * Se colapsan a `[id]` ANTES de tocar la base de datos: `/admin/usuarios/<uuid>`
 * lleva dentro el identificador de una persona, y guardarlo convertiría una
 * tabla anónima en una que no lo es.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esIdentificador(segmento: string): boolean {
  return UUID.test(segmento) || /^\d+$/.test(segmento) || segmento.length > 40;
}

/**
 * Ruta del contrato, `(otras)`, o `null` si no debe contarse en absoluto.
 *
 * @param pathname solo el camino, ya sin cadena de consulta (`nextUrl.pathname`
 *   nunca la trae). Los parámetros son donde se cuelan los datos personales
 *   —`?email=`, `?token=`— y por eso no se miran ni para descartarlos.
 */
export function normalizarRuta(pathname: string): string | null {
  if (!pathname.startsWith("/")) return null;

  // Sin barra final: `/menu` y `/menu/` son la misma página y deben sumar en la
  // misma fila. La raíz se queda como está.
  const limpio = pathname.length > 1 ? pathname.replace(/\/+$/, "") : "/";

  if (EXCLUIDOS.some((p) => limpio === p || limpio.startsWith(`${p}/`))) return null;

  const patron =
    limpio === "/"
      ? "/"
      : "/" +
        limpio
          .slice(1)
          .split("/")
          .map((s) => (esIdentificador(s) ? "[id]" : s))
          .join("/");

  if (patron.length > 80) return RUTA_OTRAS;

  return RUTAS.has(patron) ? patron : RUTA_OTRAS;
}

/** Dominios conocidos → categoría. El primero que encaje gana. */
const FUENTES: [RegExp, Origen][] = [
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)(facebook\.com|fb\.me|fb\.com)$/, "facebook"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  // `wa.me` es el acortador oficial; `com.whatsapp` aparece cuando Android
  // manda el referente como `android-app://`.
  [/(^|\.)(whatsapp\.com|wa\.me)$|^com\.whatsapp$/, "whatsapp"],
  // `google.com`, `google.es`, `google.com.pr`, `news.google.com`…
  [/(^|\.)google\.[a-z.]+$/, "google"],
];

/**
 * De dónde llega esta visita.
 *
 * Del `referer` se saca el HOST y se tira todo lo demás, que es donde viven el
 * identificador de la publicación y los parámetros de campaña.
 *
 * @param propio el host de esta web, para distinguir la navegación interna.
 */
export function clasificarOrigen(
  referer: string | null | undefined,
  propio: string
): Origen {
  // Sin referente: alguien tecleó la dirección, la tenía guardada, o llegó
  // desde una app que no lo manda. También un F5. No hay forma de separarlos
  // sin marcar la sesión, y marcarla es exactamente lo que no se hace aquí.
  if (!referer) return "directo";

  let host: string;
  try {
    host = new URL(referer).hostname.toLowerCase();
  } catch {
    return "otro";
  }

  if (!host) return "otro";

  const yo = propio.toLowerCase().split(":")[0] ?? "";
  if (yo && (host === yo || host.endsWith(`.${yo}`))) return "interno";

  for (const [patron, origen] of FUENTES) {
    if (patron.test(host)) return origen;
  }

  return "otro";
}

/**
 * Robots, escáneres y comprobaciones automáticas.
 *
 * El user-agent se LEE para decidir si contar y se descarta acto seguido; no
 * hay columna donde guardarlo ni se manda a ninguna parte. Sin este filtro, las
 * comprobaciones de salud de Vercel y los rastreadores de buscadores irían
 * dentro del mismo número que las personas, y la gráfica dejaría de significar
 * «cuánta gente entra».
 */
const ROBOTS =
  /bot|crawler|spider|slurp|scrapy|curl|wget|python-requests|axios|node-fetch|go-http|okhttp|headless|lighthouse|pagespeed|monitor|uptime|pingdom|vercel|facebookexternalhit|whatsapp|telegram|discord|skype|embedly|quora link preview/i;

export function esRobot(userAgent: string | null | undefined): boolean {
  // Un navegador siempre manda user-agent. Que no venga ninguno es señal de
  // cliente automatizado, no de una persona con mucha privacidad.
  if (!userAgent || userAgent.trim().length === 0) return true;
  return ROBOTS.test(userAgent);
}

/** Lo mínimo que hace falta de una petición. Un `Headers` encaja tal cual. */
export type Cabeceras = { get(nombre: string): string | null };

/**
 * ¿Esto es una persona abriendo una página, o ruido?
 *
 * El caso que obliga a existir a esta función son los PREFETCH. Next precarga
 * los `<Link>` que entran en pantalla o que reciben el ratón por encima: pasar
 * el cursor por el menú principal dispara seis peticiones a seis páginas que
 * nadie ha abierto. Contarlas multiplicaría las visitas por el número de
 * enlaces visibles y las páginas del menú saldrían siempre las primeras del
 * ranking, hubiera entrado alguien o no.
 *
 * SE CUENTAN CARGAS DE DOCUMENTO. Nada más.
 * --------------------------------------------
 * La primera versión miraba `rsc` y `next-router-prefetch`, que es como se
 * distinguen una precarga y un clic del router. No funciona: **Next 16 quita
 * sus propias cabeceras antes de que el proxy vea la petición.** Comprobado
 * mandando a la vez `rsc: 1` y una cabecera inventada; la inventada llegó y las
 * de Next no. Aquel código no descartaba precargas, simplemente nunca se
 * ejecutaba, y el comentario que lo explicaba era mentira.
 *
 * Lo que sí llega es `Sec-Fetch-Dest`, que el navegador pone y nadie toca:
 * `document` en una carga de página y `empty` en cualquier `fetch`. Con eso, un
 * clic dentro de la web —que Next resuelve por `fetch` sin recargar— tampoco
 * suma. Se pierde precisión y hay que decirlo en pantalla, pero es preferible a
 * la alternativa: un número inflado por precargas que nadie llegó a mirar.
 *
 * El respaldo por `accept` es para los navegadores viejos que no mandan
 * `Sec-Fetch-*` (Safari anterior a 16.4). Sin él desaparecerían de las cifras
 * sin que nada avisara.
 */
export function esNavegacion(cabeceras: Cabeceras): boolean {
  // Precarga especulativa del navegador (Speculation Rules). Llega como
  // `document`, así que sin esto pasaría el filtro de abajo.
  if ((cabeceras.get("sec-purpose") ?? "").includes("prefetch")) return false;

  const destino = cabeceras.get("sec-fetch-dest");
  if (destino !== null) return destino === "document";

  return (cabeceras.get("accept") ?? "").includes("text/html");
}

export type Visita = { ruta: string; origen: Origen };

/**
 * La decisión completa: qué visita registrar, o ninguna.
 *
 * Una sola entrada en vez de tres funciones que el proxy tenga que componer en
 * el orden correcto. El orden importa —descartar robots antes de normalizar la
 * ruta— y dejarlo escrito una vez aquí es más barato que confiar en recordarlo.
 */
export function decidirVisita(peticion: {
  method: string;
  pathname: string;
  host: string;
  cabeceras: Cabeceras;
}): Visita | null {
  // Un envío de formulario no es una visita nueva: la página ya se contó al
  // abrirla, y la redirección posterior se contará por su cuenta.
  if (peticion.method !== "GET") return null;

  if (esRobot(peticion.cabeceras.get("user-agent"))) return null;
  if (!esNavegacion(peticion.cabeceras)) return null;

  const ruta = normalizarRuta(peticion.pathname);
  if (ruta === null) return null;

  return { ruta, origen: clasificarOrigen(peticion.cabeceras.get("referer"), peticion.host) };
}

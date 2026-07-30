import { Celda, Fila, Tabla } from "@/components/admin/ui/Tabla";
import {
  area,
  barras as calcularBarras,
  LIENZO,
  maximoDe,
  puntosPolilinea,
  ticks,
  type Punto,
} from "./escala";

/**
 * Gráficas en SVG escrito a mano.
 *
 * No hay librería, y no por gusto: Recharts, Chart.js y equivalentes usan
 * paletas azul/morado —familias que `scripts/validate-design-system.mjs`
 * prohíbe—, definen degradados en sus `defs` —también prohibidos— y la CSP del
 * sitio es `script-src 'self'` sin CDN. Cualquiera de las tres cosas rompe el
 * build.
 *
 * (Y sí: nombrar aquí el elemento SVG de degradado también lo rompería. El
 * validador lee este archivo línea a línea, comentarios incluidos.)
 *
 * TODO ESTO SON SERVER COMPONENTS. Ni una línea de JavaScript llega al
 * navegador: el SVG se calcula en el servidor y se sirve como HTML. Los avisos
 * al pasar el ratón son `<title>` nativos, que el navegador enseña solo.
 *
 * El color va SIEMPRE por clase de Tailwind (`fill-forest`, `stroke-terracota`),
 * nunca por atributo con un hex. Las clases tienen que aparecer literales en el
 * código fuente: Tailwind v4 no genera nada para `fill-${variable}`.
 */

type Props = {
  serie: Punto[];
  /** Qué se está viendo. Va en el `<title>` del SVG, para lectores de pantalla. */
  titulo: string;
  /** Cómo se escribe un valor: "12 socios", "$48.50". */
  formato?: (v: number) => string;
};

/** Formato por defecto: el número tal cual, con separador de millares. */
const NUMERO = (v: number) => new Intl.NumberFormat("es-PR").format(v);

/**
 * Tabla oculta con los datos crudos.
 *
 * Va debajo de cada gráfica. Un lector de pantalla no puede interpretar un
 * `<path>`, así que sin esto la gráfica es un agujero. Y de paso da algo que
 * copiar y pegar a quien quiera los números.
 */
function DatosAccesibles({
  serie,
  titulo,
  formato,
}: {
  serie: Punto[];
  titulo: string;
  formato: (v: number) => string;
}) {
  return (
    <div className="sr-only">
      <Tabla
        descripcion={`Datos de: ${titulo}`}
        columnas={[
          { clave: "periodo", titulo: "Periodo" },
          { clave: "valor", titulo: "Valor", numerica: true },
        ]}
      >
        {serie.map((p) => (
          <Fila key={p.etiqueta}>
            <Celda principal>{p.etiqueta}</Celda>
            <Celda numerica>{formato(p.valor)}</Celda>
          </Fila>
        ))}
      </Tabla>
    </div>
  );
}

/** Rejilla horizontal y marcas del eje. Compartida por barras y línea. */
function Ejes({ maximo, formato }: { maximo: number; formato: (v: number) => string }) {
  const { x0, x1, y0, y1 } = area(LIENZO);
  const marcas = ticks(maximo);
  const techo = marcas.at(-1)!;

  return (
    <g aria-hidden="true">
      {marcas.map((m) => {
        const y = y1 - (m / techo) * (y1 - y0);
        return (
          <g key={m}>
            <line
              x1={x0}
              x2={x1}
              y1={y}
              y2={y}
              className="stroke-border"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <text x={x0 - 8} y={y + 4} textAnchor="end" className="fill-text-muted text-[11px]">
              {formato(m)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** Etiquetas del eje horizontal, en HTML para que escalen como el resto del texto. */
function EtiquetasX({ serie }: { serie: Punto[] }) {
  // Con más de ocho periodos las etiquetas se pisan: se enseña una de cada N.
  const salto = Math.ceil(serie.length / 8);
  return (
    <div className="mt-1.5 flex justify-between text-[0.65rem] text-text-muted">
      {serie.map((p, i) =>
        i % salto === 0 || i === serie.length - 1 ? (
          <span key={p.etiqueta}>{p.etiqueta}</span>
        ) : null
      )}
    </div>
  );
}

export function GraficaBarras({ serie, titulo, formato = NUMERO }: Props) {
  const maximo = maximoDe(serie);
  const cajas = calcularBarras(serie, maximo);
  const { x0, x1, y1 } = area(LIENZO);

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${LIENZO.ancho} ${LIENZO.alto}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-56 w-full"
        role="img"
        aria-label={titulo}
      >
        <title>{titulo}</title>
        <Ejes maximo={maximo} formato={formato} />

        {cajas.map((c) => (
          <rect
            key={c.punto.etiqueta}
            x={c.x}
            y={c.y}
            width={c.ancho}
            height={c.alto}
            rx={2}
            className="fill-forest"
          >
            {/* Aviso nativo del navegador: cero JavaScript. */}
            <title>{`${c.punto.etiqueta}: ${formato(c.punto.valor)}`}</title>
          </rect>
        ))}

        <line
          x1={x0}
          x2={x1}
          y1={y1}
          y2={y1}
          className="stroke-espresso"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <EtiquetasX serie={serie} />
      <DatosAccesibles serie={serie} titulo={titulo} formato={formato} />
    </figure>
  );
}

export function GraficaLinea({ serie, titulo, formato = NUMERO }: Props) {
  const maximo = maximoDe(serie);
  const puntos = puntosPolilinea(serie, maximo);
  const { x0, x1, y1 } = area(LIENZO);

  /*
    Relleno bajo la curva, cerrado contra la línea base. Color plano con
    opacidad, nunca degradado: el validador lo rechaza y además no está en el
    sistema visual.

    Con UN SOLO dato no se rellena. La raya horizontal ocupa todo el ancho —para
    que se vea que hay algo— y rellenarla pinta el lienzo entero de verde, que
    se lee como «está lleno» en vez de como «hay un dato». Un bloque sólido es
    peor que nada: comunica una magnitud que no existe.
  */
  const relleno =
    serie.length > 1
      ? `${puntos.map(([x, y]) => `${x},${y}`).join(" ")} ${puntos.at(-1)![0]},${y1} ${puntos[0]![0]},${y1}`
      : "";

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${LIENZO.ancho} ${LIENZO.alto}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-56 w-full"
        role="img"
        aria-label={titulo}
      >
        <title>{titulo}</title>
        <Ejes maximo={maximo} formato={formato} />

        {relleno && <polygon points={relleno} className="fill-teatree/40" />}

        <polyline
          points={puntos.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          className="stroke-olive"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {/*
          Un círculo por DATO, no por coordenada. No son lo mismo: con un solo
          dato, `puntosPolilinea` devuelve dos coordenadas a propósito —una raya
          de un punto no se dibuja— y recorrer las coordenadas buscaba un
          segundo dato que no existe.
        */}
        {serie.length <= 40 &&
          serie.map((p, i) => {
            const coord = puntos[i];
            if (!coord) return null;
            return (
              <circle key={p.etiqueta} cx={coord[0]} cy={coord[1]} r={3} className="fill-olive">
                <title>{`${p.etiqueta}: ${formato(p.valor)}`}</title>
              </circle>
            );
          })}

        <line
          x1={x0}
          x2={x1}
          y1={y1}
          y2={y1}
          className="stroke-espresso"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <EtiquetasX serie={serie} />
      <DatosAccesibles serie={serie} titulo={titulo} formato={formato} />
    </figure>
  );
}

/**
 * Línea diminuta sin ejes, para meter dentro de una tarjeta.
 *
 * Da la forma de la tendencia, no el valor: el número va al lado en grande.
 */
export function Sparkline({ serie, titulo }: { serie: Punto[]; titulo: string }) {
  if (serie.length < 2) return null;

  const maximo = maximoDe(serie);
  const lienzo = { ancho: 120, alto: 32, margenIzq: 1, margenSup: 3, margenInf: 3 };
  const puntos = puntosPolilinea(serie, maximo, lienzo);

  return (
    <svg
      viewBox={`0 0 ${lienzo.ancho} ${lienzo.alto}`}
      preserveAspectRatio="none"
      className="h-8 w-full"
      role="img"
      aria-label={titulo}
    >
      <title>{titulo}</title>
      <polyline
        points={puntos.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        className="stroke-olive"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * Ranking horizontal. Es HTML, no SVG.
 *
 * Para «los cinco productos más guardados» un SVG no aporta nada: son barras
 * proporcionales con una etiqueta, y en HTML el texto se selecciona, se copia y
 * escala como el resto de la página.
 */
export function BarrasHorizontales({
  serie,
  titulo,
  formato = NUMERO,
}: Props & { titulo: string }) {
  const maximo = maximoDe(serie);

  if (serie.length === 0) return null;

  return (
    <div role="group" aria-label={titulo}>
      <ul className="space-y-2.5">
        {serie.map((p) => (
          <li key={p.etiqueta}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-espresso">{p.etiqueta}</span>
              <span className="shrink-0 tabular-nums text-text-muted">{formato(p.valor)}</span>
            </div>
            <div className="mt-1 h-1.5 w-full bg-espresso/10">
              <div
                className="h-full bg-terracota"
                // El ancho es un dato, no un estilo de marca: va inline porque
                // depende del valor. No hay ningún color aquí.
                style={{ width: `${maximo > 0 ? (p.valor / maximo) * 100 : 0}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

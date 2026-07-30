import "server-only";

import { crearClienteServicio } from "@/lib/supabase/admin";
import type { Punto } from "@/components/admin/graficas/escala";

/**
 * Series temporales para el panel — `0013_metricas.sql`.
 *
 * Todo se agrega en SQL. Aquí solo se pide el rango y se le pone formato a las
 * etiquetas; ni una suma se hace en JavaScript, que es justo lo que producía el
 * número falso del crédito en circulación.
 */

export type Metrica =
  | "altas"
  | "credito_emitido"
  | "credito_canjeado"
  | "puntos_emitidos"
  | "puntos_canjeados"
  | "giftcards_gmv"
  | "giftcards_pedidos"
  | "suscriptores";

export type Grano = "dia" | "semana" | "mes";

/** Rangos que ofrece la pantalla. */
export const RANGOS = {
  "7d": { dias: 7, grano: "dia" as Grano, etiqueta: "7 días" },
  "30d": { dias: 30, grano: "dia" as Grano, etiqueta: "30 días" },
  // A partir de tres meses se agrupa por semana: 90 barras no caben en una
  // pantalla de móvil y se convierten en un peine ilegible.
  "90d": { dias: 90, grano: "semana" as Grano, etiqueta: "90 días" },
  "12m": { dias: 365, grano: "mes" as Grano, etiqueta: "12 meses" },
} as const;

export type ClaveRango = keyof typeof RANGOS;

export function esRangoValido(v: string | undefined): v is ClaveRango {
  return v !== undefined && v in RANGOS;
}

/**
 * Fechas en formato `YYYY-MM-DD`, que es lo que espera el parámetro `date`.
 *
 * Exportada porque el servicio de visitas usa los MISMOS rangos. Duplicar este
 * cálculo es como acaban dos pantallas diciendo «últimos 30 días» y midiendo
 * ventanas distintas.
 */
export function ventana(dias: number): { desde: string; hasta: string } {
  const hoy = new Date();
  const desde = new Date(hoy);
  desde.setDate(hoy.getDate() - (dias - 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { desde: iso(desde), hasta: iso(hoy) };
}

const FORMATO_ETIQUETA: Record<Grano, Intl.DateTimeFormatOptions> = {
  dia: { day: "numeric", month: "short" },
  semana: { day: "numeric", month: "short" },
  mes: { month: "short", year: "2-digit" },
};

export function etiquetar(iso: string, grano: Grano): string {
  return new Intl.DateTimeFormat("es-PR", {
    ...FORMATO_ETIQUETA[grano],
    timeZone: "America/Puerto_Rico",
  }).format(new Date(iso));
}

/**
 * Serie lista para pintar.
 *
 * La función SQL ya devuelve todos los periodos del rango, incluidos los que
 * valen cero, así que aquí no hay que rellenar huecos: una semana sin altas
 * llega como un cero y se dibuja como un valle, no desaparece.
 */
export async function serie(
  metrica: Metrica,
  rango: ClaveRango = "30d"
): Promise<Punto[]> {
  const { dias, grano } = RANGOS[rango];
  const { desde, hasta } = ventana(dias);

  const servicio = crearClienteServicio();
  const { data, error } = await servicio.rpc("metricas_serie", {
    p_metrica: metrica,
    p_desde: desde,
    p_hasta: hasta,
    p_grano: grano,
  });

  if (error) throw new Error(`No se pudo leer la métrica ${metrica}: ${error.message}`);

  return ((data ?? []) as { periodo: string; valor: string }[]).map((f) => ({
    etiqueta: etiquetar(f.periodo, grano),
    valor: Number(f.valor),
  }));
}

/** Varias series a la vez. Una ida y vuelta por métrica, en paralelo. */
export async function seriesDe(
  metricas: Metrica[],
  rango: ClaveRango = "30d"
): Promise<Record<string, Punto[]>> {
  const resultados = await Promise.all(metricas.map((m) => serie(m, rango)));
  return Object.fromEntries(metricas.map((m, i) => [m, resultados[i]!]));
}

/** Suma de una serie. Para el total del periodo junto a la gráfica. */
export function total(puntos: Punto[]): number {
  return puntos.reduce((s, p) => s + p.valor, 0);
}

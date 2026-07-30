import "server-only";

import { crearClienteServicio } from "@/lib/supabase/admin";
import { etiquetar, RANGOS, ventana, type ClaveRango } from "@/lib/services/metricas";
import type { Origen } from "@/lib/analitica/clasificar";
import type { Punto } from "@/components/admin/graficas/escala";

/**
 * Lectura de la analítica de visitas — `0016_analitica.sql`.
 *
 * Mismos rangos que `/admin/metricas` (`RANGOS`), y la misma ventana de fechas
 * calculada por la misma función: dos pantallas que dicen «últimos 30 días»
 * tienen que estar midiendo los mismos 30 días.
 *
 * Todo llega ya sumado desde Postgres. Aquí solo se traducen etiquetas.
 */

export type ResumenVisitas = {
  total: number;
  /** El mismo número de días justo antes del rango. Sin esto, un total no dice nada. */
  totalAnterior: number;
  /** Cuántas páginas distintas se vieron. */
  rutas: number;
  /** Hora del día (0–23, en Puerto Rico) con más tráfico. `null` si no hay ninguna visita. */
  horaPunta: number | null;
};

export type TrozoOrigen = { origen: Origen; visitas: number };

/**
 * Nombres de las páginas.
 *
 * Un ranking que dice `/gift-cards/confirmacion` obliga a traducir mentalmente
 * cada línea. Las que no estén aquí se enseñan tal cual: es preferible una ruta
 * cruda a inventarle un nombre bonito a algo que no se sabe qué es.
 */
const NOMBRE_RUTA: Record<string, string> = {
  "/": "Portada",
  "/menu": "Menú",
  "/nosotros": "Nuestra historia",
  "/comunidad": "Comunidad",
  "/visitanos": "Contacto",
  "/gift-cards": "Gift cards",
  "/gift-cards/confirmacion": "Gift cards · confirmación",
  "/registro": "Registro",
  "/registro/confirmar": "Registro · confirmar correo",
  "/iniciar-sesion": "Iniciar sesión",
  "/recuperar": "Recuperar contraseña",
  "/recuperar/nueva": "Contraseña nueva",
  "/terminos": "Términos",
  "/privacidad": "Privacidad",
  "/perfil": "Perfil",
  "/perfil/editar": "Perfil · editar",
  "/perfil/pedidos": "Perfil · pedidos",
  "/perfil/favoritos": "Perfil · favoritos",
  "/perfil/eventos": "Perfil · eventos",
  "/wallet": "Wallet",
  "/wallet/canjear": "Wallet · canjear",
  "/[otras]": "Páginas que no existen",
};

export function nombreDeRuta(ruta: string): string {
  return NOMBRE_RUTA[ruta] ?? ruta;
}

export const NOMBRE_ORIGEN: Record<Origen, string> = {
  directo: "Directo",
  interno: "Dentro de la web",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  google: "Google",
  otro: "Otros sitios",
};

/** «9 a. m. – 10 a. m.» Una hora suelta se lee mal como franja. */
export function franjaHoraria(hora: number): string {
  const doce = (h: number) =>
    `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "a. m." : "p. m."}`;
  return `${doce(hora)} – ${doce((hora + 1) % 24)}`;
}

function servicio() {
  return crearClienteServicio();
}

export async function resumenVisitas(rango: ClaveRango): Promise<ResumenVisitas> {
  const { desde, hasta } = ventana(RANGOS[rango].dias);

  const { data, error } = await servicio().rpc("metricas_visitas_resumen", {
    p_desde: desde,
    p_hasta: hasta,
  });

  if (error) throw new Error(`No se pudo leer el resumen de visitas: ${error.message}`);

  const f = (Array.isArray(data) ? data[0] : null) as
    | { total: string; total_anterior: string; rutas: string; hora_punta: number | null }
    | null
    | undefined;

  return {
    total: Number(f?.total ?? 0),
    totalAnterior: Number(f?.total_anterior ?? 0),
    rutas: Number(f?.rutas ?? 0),
    horaPunta: f?.hora_punta ?? null,
  };
}

export async function serieVisitas(rango: ClaveRango): Promise<Punto[]> {
  const { dias, grano } = RANGOS[rango];
  const { desde, hasta } = ventana(dias);

  const { data, error } = await servicio().rpc("metricas_visitas_serie", {
    p_desde: desde,
    p_hasta: hasta,
    p_grano: grano,
  });

  if (error) throw new Error(`No se pudo leer la serie de visitas: ${error.message}`);

  return ((data ?? []) as { periodo: string; visitas: string }[]).map((f) => ({
    etiqueta: etiquetar(f.periodo, grano),
    valor: Number(f.visitas),
  }));
}

export async function rutasVisitadas(rango: ClaveRango, limite = 12): Promise<Punto[]> {
  const { desde, hasta } = ventana(RANGOS[rango].dias);

  const { data, error } = await servicio().rpc("metricas_visitas_rutas", {
    p_desde: desde,
    p_hasta: hasta,
    p_limite: limite,
  });

  if (error) throw new Error(`No se pudieron leer las páginas más vistas: ${error.message}`);

  return ((data ?? []) as { ruta: string; visitas: string }[]).map((f) => ({
    etiqueta: nombreDeRuta(f.ruta),
    valor: Number(f.visitas),
  }));
}

export async function origenVisitas(rango: ClaveRango): Promise<TrozoOrigen[]> {
  const { desde, hasta } = ventana(RANGOS[rango].dias);

  const { data, error } = await servicio().rpc("metricas_visitas_origen", {
    p_desde: desde,
    p_hasta: hasta,
  });

  if (error) throw new Error(`No se pudo leer el origen del tráfico: ${error.message}`);

  return ((data ?? []) as { origen: Origen; visitas: string }[]).map((f) => ({
    origen: f.origen,
    visitas: Number(f.visitas),
  }));
}

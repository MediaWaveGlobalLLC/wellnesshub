/**
 * Formas y etiquetas de la configuración de lealtad.
 *
 * SIN `server-only`, y en su propio módulo, por la misma razón que
 * `services/permisos.ts`: los componentes de cliente necesitan estos tipos y
 * estas etiquetas para pintar, y aquí no hay ningún secreto.
 *
 * Estaban dentro de `services/lealtad-admin.ts`, que sí es server-only. El
 * build falló y con razón: importar de ahí desde un `"use client"` arrastraba
 * al bundle del navegador el módulo que crea el cliente con `service_role`. El
 * centinela existe exactamente para eso.
 */

/** Qué puede hacer el sistema con una regla, hoy. */
export type Aplicacion = "automatica" | "manual" | "bloqueada";

export const NOMBRE_APLICACION: Record<Aplicacion, string> = {
  automatica: "La da el sistema",
  manual: "La das tú",
  bloqueada: "Todavía no se puede",
};

export type ReglaLealtad = {
  clave: string;
  puntos: number;
  etiqueta: string;
  activa: boolean;
  aplicacion: Aplicacion;
  /** Por qué está bloqueada, o quién la da. Nunca vacío en las bloqueadas. */
  nota: string | null;
  vecesAplicada: number;
  puntosDados: number;
};

export type NivelLealtad = {
  clave: string;
  etiqueta: string;
  minimo: number;
  orden: number;
  descripcion: string | null;
  miembros: number;
};

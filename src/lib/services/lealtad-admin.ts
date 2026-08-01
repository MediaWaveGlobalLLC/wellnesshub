import "server-only";

import { crearClienteServicio } from "@/lib/supabase/admin";
import type { Aplicacion, NivelLealtad, ReglaLealtad } from "@/lib/lealtad/tipos";

/**
 * Configuración de lealtad y salud técnica — `0018_lealtad_y_salud.sql`.
 *
 * `loyalty_rules` se sembró en `0005` con las siete reglas del Brand Book y
 * ningún archivo de `src/` la leía: eran siete filas que describían cómo se
 * ganan puntos sin dar un punto a nadie. Esto es la lectura que faltaba.
 *
 * Los TIPOS viven en `@/lib/lealtad/tipos`, no aquí: este módulo es
 * `server-only` y los componentes de cliente los necesitan para pintar.
 */

function servicio() {
  return crearClienteServicio();
}

export async function listarReglas(): Promise<ReglaLealtad[]> {
  const { data, error } = await servicio().rpc("admin_lealtad_reglas");
  if (error) throw new Error(`No se pudieron leer las reglas: ${error.message}`);

  type Fila = {
    clave: string;
    puntos: string;
    etiqueta: string;
    activa: boolean;
    aplicacion: Aplicacion;
    nota: string | null;
    veces_aplicada: string;
    puntos_dados: string;
  };

  return ((data ?? []) as Fila[]).map((r) => ({
    clave: r.clave,
    puntos: Number(r.puntos),
    etiqueta: r.etiqueta,
    activa: r.activa,
    aplicacion: r.aplicacion,
    nota: r.nota,
    vecesAplicada: Number(r.veces_aplicada),
    puntosDados: Number(r.puntos_dados),
  }));
}

export async function listarNiveles(): Promise<NivelLealtad[]> {
  const { data, error } = await servicio().rpc("admin_lealtad_niveles");
  if (error) throw new Error(`No se pudieron leer los niveles: ${error.message}`);

  type Fila = {
    clave: string;
    etiqueta: string;
    minimo: string;
    orden: number;
    descripcion: string | null;
    miembros: string;
  };

  return ((data ?? []) as Fila[]).map((n) => ({
    clave: n.clave,
    etiqueta: n.etiqueta,
    minimo: Number(n.minimo),
    orden: n.orden,
    descripcion: n.descripcion,
    miembros: Number(n.miembros),
  }));
}

/* ── Salud técnica ───────────────────────────────────────────────────────── */

export type Salud = {
  webhooksTotal: number;
  webhooksFallidos: number;
  /** En `processing` desde hace más de cinco minutos: se quedaron a medias. */
  webhooksProcesando: number;
  webhooksFallidos7d: number;
  webhookUltimo: string | null;
  webhookLatenciaMediaMs: number;
  canjesIntentos: number;
  canjesFallidos: number;
  canjesFallidos7d: number;
  /** Tres fallos o más en una semana sin ninguno bueno. */
  canjesPersonasAtascadas: number;
  bloqueosActivos: number;
  bloqueosLoginActivos: number;
  auditoriaEntradas: number;
  auditoriaUltima: string | null;
};

export async function obtenerSalud(): Promise<Salud> {
  const { data, error } = await servicio().rpc("metricas_salud").single();
  if (error || !data) throw new Error(`No se pudo leer la salud: ${error?.message}`);

  const d = data as Record<string, string | number | null>;
  const n = (clave: string) => Number(d[clave] ?? 0);
  const f = (clave: string) => (d[clave] as string | null) ?? null;

  return {
    webhooksTotal: n("webhooks_total"),
    webhooksFallidos: n("webhooks_fallidos"),
    webhooksProcesando: n("webhooks_procesando"),
    webhooksFallidos7d: n("webhooks_fallidos_7d"),
    webhookUltimo: f("webhook_ultimo"),
    webhookLatenciaMediaMs: n("webhook_latencia_media_ms"),
    canjesIntentos: n("canjes_intentos"),
    canjesFallidos: n("canjes_fallidos"),
    canjesFallidos7d: n("canjes_fallidos_7d"),
    canjesPersonasAtascadas: n("canjes_personas_atascadas"),
    bloqueosActivos: n("bloqueos_activos"),
    bloqueosLoginActivos: n("bloqueos_login_activos"),
    auditoriaEntradas: n("auditoria_entradas"),
    auditoriaUltima: f("auditoria_ultima"),
  };
}

export type Webhook = {
  eventoId: string;
  tipo: string;
  estado: string;
  creadoAt: string;
  procesadoAt: string | null;
  error: string | null;
};

export async function webhooksRecientes(limite = 20): Promise<Webhook[]> {
  const { data, error } = await servicio().rpc("admin_webhooks_recientes", {
    p_limite: limite,
  });
  if (error) throw new Error(`No se pudieron leer los webhooks: ${error.message}`);

  type Fila = {
    evento_id: string;
    tipo: string;
    estado: string;
    creado_at: string;
    procesado_at: string | null;
    error: string | null;
  };

  return ((data ?? []) as Fila[]).map((w) => ({
    eventoId: w.evento_id,
    tipo: w.tipo,
    estado: w.estado,
    creadoAt: w.creado_at,
    procesadoAt: w.procesado_at,
    error: w.error,
  }));
}

/* ── Recompensas — `0020_recompensas.sql` ────────────────────────────────── */

export type RecompensaAdmin = {
  id: string;
  nombre: string;
  descripcion: string | null;
  costoPuntos: number;
  imagenClave: string | null;
  /** `null` = sin límite. */
  existencias: number | null;
  orden: number;
  activa: boolean;
  vecesCanjeada: number;
  pendientes: number;
};

export type CanjePendiente = {
  id: string;
  codigo: string;
  nombre: string;
  costoPuntos: number;
  creado: string;
  persona: string | null;
  email: string | null;
};

export async function listarRecompensasAdmin(): Promise<RecompensaAdmin[]> {
  const { data, error } = await servicio().rpc("admin_recompensas_listar");
  if (error) throw new Error(`No se pudieron leer las recompensas: ${error.message}`);

  type Fila = {
    id: string;
    nombre: string;
    descripcion: string | null;
    costo_puntos: string;
    imagen_clave: string | null;
    existencias: number | null;
    orden: number;
    activa: boolean;
    veces_canjeada: string;
    pendientes: string;
  };

  return ((data ?? []) as Fila[]).map((r) => ({
    id: r.id,
    nombre: r.nombre,
    descripcion: r.descripcion,
    costoPuntos: Number(r.costo_puntos),
    imagenClave: r.imagen_clave,
    existencias: r.existencias === null ? null : Number(r.existencias),
    orden: Number(r.orden),
    activa: r.activa,
    vecesCanjeada: Number(r.veces_canjeada),
    pendientes: Number(r.pendientes),
  }));
}

/** La cola del mostrador: lo canjeado y aún sin recoger, lo más viejo primero. */
export async function listarCanjesPendientes(): Promise<CanjePendiente[]> {
  const { data, error } = await servicio().rpc("admin_canjes_pendientes");
  if (error) throw new Error(`No se pudieron leer los canjes: ${error.message}`);

  type Fila = {
    id: string;
    codigo: string;
    nombre: string;
    costo_puntos: string;
    creado: string;
    persona: string | null;
    email: string | null;
  };

  return ((data ?? []) as Fila[]).map((r) => ({
    id: r.id,
    codigo: r.codigo,
    nombre: r.nombre,
    costoPuntos: Number(r.costo_puntos),
    creado: r.creado,
    // El RPC devuelve cadena vacía si el perfil no tiene nombre todavía.
    persona: r.persona && r.persona.length > 0 ? r.persona : null,
    email: r.email,
  }));
}

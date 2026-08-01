import "server-only";

import { crearClienteServidor } from "@/lib/supabase/server";
import { BRAND_ASSETS, type BrandAsset } from "@/lib/brand-assets.generated";

/**
 * Catálogo de recompensas y canjes de la persona — `0020_recompensas.sql`.
 *
 * Se lee con la sesión del usuario, no con la clave de servicio: `loyalty_rewards`
 * publica su catálogo activo y `loyalty_redemptions` deja ver solo lo propio.
 * Es RLS quien impide leer los canjes de otro, así que ninguna consulta de aquí
 * filtra por `user_id` a mano y por tanto ninguna puede olvidarse de hacerlo.
 */

export type Recompensa = {
  id: string;
  nombre: string;
  descripcion: string | null;
  costoPuntos: number;
  /** Ya resuelta contra el manifiesto: `null` si no tiene o si la clave no existe. */
  imagen: BrandAsset | null;
  /** `null` = sin límite. 0 = agotada. */
  existencias: number | null;
  /** Si el saldo actual da para canjearla. */
  alcanza: boolean;
};

export type CanjePropio = {
  id: string;
  codigo: string;
  nombre: string;
  costoPuntos: number;
  estado: "pendiente" | "entregada" | "cancelada";
  creado: string;
};

/**
 * Resuelve la clave guardada contra el manifiesto de marca.
 *
 * La base guarda una clave, no una URL (`0020`). Si alguien renombra un asset y
 * el manifiesto se regenera, la clave vieja deja de existir: entonces se pinta
 * la tarjeta sin foto en vez de romper la página con una imagen rota.
 */
function resolverImagen(clave: string | null): BrandAsset | null {
  if (!clave) return null;
  const assets = BRAND_ASSETS as Record<string, BrandAsset>;
  return assets[clave] ?? null;
}

export async function listarRecompensas(puntos: number): Promise<Recompensa[]> {
  const supabase = await crearClienteServidor();

  // La política solo deja ver las activas, así que no hace falta filtrar aquí.
  const { data } = await supabase
    .from("loyalty_rewards")
    .select("id, nombre, descripcion, costo_puntos, imagen_clave, existencias")
    .order("orden", { ascending: true })
    .order("costo_puntos", { ascending: true });

  return (data ?? []).map((r) => {
    const costoPuntos = Number(r.costo_puntos);
    const existencias = r.existencias === null ? null : Number(r.existencias);
    return {
      id: r.id,
      nombre: r.nombre,
      descripcion: r.descripcion,
      costoPuntos,
      imagen: resolverImagen(r.imagen_clave),
      existencias,
      alcanza: puntos >= costoPuntos && (existencias === null || existencias > 0),
    };
  });
}

/** Los canjes que la persona todavía tiene que recoger. */
export async function canjesPendientes(): Promise<CanjePropio[]> {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("loyalty_redemptions")
    .select("id, codigo, nombre, costo_puntos, estado, created_at")
    .eq("estado", "pendiente")
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id,
    codigo: r.codigo,
    nombre: r.nombre,
    costoPuntos: Number(r.costo_puntos),
    estado: r.estado as CanjePropio["estado"],
    creado: r.created_at,
  }));
}

import "server-only";

import { crearClienteServidor } from "@/lib/supabase/server";
import { calcularProgreso, type Nivel, type ProgresoMembresia } from "@/lib/loyalty";
import { resolverItems, type ItemDeMenu } from "@/lib/menu";

/**
 * Servicio de perfil — `docs/03`.
 *
 * Reúne en una sola llamada lo que el mockup 02 pinta de golpe. Todo se lee con
 * la sesión del usuario, así que RLS es quien garantiza el aislamiento: este
 * código no filtra por user_id "a mano" y por tanto no puede olvidarse de
 * hacerlo en una consulta.
 *
 * La UI no calcula nada de negocio: recibe el progreso ya resuelto.
 */

export type ActividadReciente = {
  id: string;
  puntos: number;
  descripcion: string;
  tipo: string;
  fecha: string;
};

export type ProximoEvento = {
  slug: string;
  titulo: string;
  descripcion: string | null;
  inicio: string;
  fin: string | null;
  lugar: string;
  imagenSlug: string | null;
};

export type DashboardPerfil = {
  perfil: {
    nombre: string | null;
    apellido: string | null;
    email: string | null;
    telefono: string | null;
    memberId: string;
    avatarUrl: string | null;
    marketingOptIn: boolean;
  };
  membresia: ProgresoMembresia;
  walletCents: number;
  actividad: ActividadReciente[];
  favoritos: ItemDeMenu[];
  proximoEvento: ProximoEvento | null;
  qrToken: string | null;
};

/** Etiqueta legible para el ledger de puntos, según el tipo de movimiento. */
const ETIQUETA_TIPO: Record<string, string> = {
  earn: "Puntos ganados",
  redeem: "Canje de recompensa",
  promotion: "Promoción",
  admin_adjustment: "Ajuste de servicio",
  correction: "Corrección",
  expiration: "Puntos expirados",
};

export async function obtenerDashboard(): Promise<DashboardPerfil | null> {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  /*
   * En paralelo: son lecturas independientes y encadenarlas multiplicaría la
   * latencia de una pantalla que ya carga siete bloques.
   */
  const [perfilRes, walletRes, lealtadRes, nivelesRes, actividadRes, favoritosRes, eventoRes, qrRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("first_name, last_name, phone, member_id, avatar_url, marketing_email_opt_in")
        .eq("id", user.id)
        .maybeSingle(),
      supabase.from("wallets").select("balance_cents").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("loyalty_accounts")
        .select("points_balance")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.from("loyalty_tiers").select("key, label, min_points, sort_order, description"),
      supabase
        .from("loyalty_transactions")
        .select("id, points, description, transaction_type, created_at")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("favorites")
        .select("item_slug")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("event_bookings")
        .select("status, events(slug, title, description, starts_at, ends_at, location, image_slug)")
        .eq("status", "confirmada")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.rpc("obtener_qr_token"),
    ]);

  // El perfil siempre existe: lo crea el trigger al dar de alta. Si falta, algo
  // se rompió en el alta y es mejor enterarse que pintar una pantalla a medias.
  if (!perfilRes.data) return null;

  const niveles: Nivel[] = (nivelesRes.data ?? []).map((n) => ({
    key: n.key,
    label: n.label,
    minPoints: Number(n.min_points),
    sortOrder: n.sort_order,
    description: n.description,
  }));

  const puntos = Number(lealtadRes.data?.points_balance ?? 0);

  const actividad: ActividadReciente[] = (actividadRes.data ?? []).map((m) => ({
    id: m.id,
    puntos: Number(m.points),
    descripcion: m.description ?? ETIQUETA_TIPO[m.transaction_type] ?? "Movimiento",
    tipo: m.transaction_type,
    fecha: m.created_at,
  }));

  // El próximo taller es el más cercano en el futuro, no el reservado más
  // recientemente: se ordena por fecha del evento, no de la reserva.
  const eventos = (eventoRes.data ?? [])
    .flatMap((b) => {
      const e = b.events as unknown as {
        slug: string;
        title: string;
        description: string | null;
        starts_at: string;
        ends_at: string | null;
        location: string;
        image_slug: string | null;
      } | null;
      return e ? [e] : [];
    })
    .filter((e) => new Date(e.starts_at).getTime() >= Date.now())
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  const proximo = eventos[0];

  return {
    perfil: {
      nombre: perfilRes.data.first_name,
      apellido: perfilRes.data.last_name,
      email: user.email ?? null,
      telefono: perfilRes.data.phone,
      memberId: perfilRes.data.member_id,
      avatarUrl: perfilRes.data.avatar_url,
      marketingOptIn: perfilRes.data.marketing_email_opt_in,
    },
    membresia: calcularProgreso(puntos, niveles),
    walletCents: Number(walletRes.data?.balance_cents ?? 0),
    actividad,
    favoritos: resolverItems((favoritosRes.data ?? []).map((f) => f.item_slug)),
    proximoEvento: proximo
      ? {
          slug: proximo.slug,
          titulo: proximo.title,
          descripcion: proximo.description,
          inicio: proximo.starts_at,
          fin: proximo.ends_at,
          lugar: proximo.location,
          imagenSlug: proximo.image_slug,
        }
      : null,
    qrToken: typeof qrRes.data === "string" ? qrRes.data : null,
  };
}

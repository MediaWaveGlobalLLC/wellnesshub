import "server-only";

import { crearClienteServicio } from "@/lib/supabase/admin";

/**
 * Lecturas del panel administrativo — `docs/00`.
 *
 * Todas usan `service_role` y por tanto SALTAN RLS: es la única forma de que
 * soporte pueda ver la cuenta de otra persona. Por eso ningún módulo de este
 * archivo se importa sin haber pasado antes por `exigirAdmin()`; la
 * autorización vive en la página, no aquí.
 */

export type ResumenUsuario = {
  id: string;
  memberId: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  puntos: number;
  nivel: string;
  saldoCents: number;
  alta: string;
};

/**
 * Busca por nombre, apellido, correo, teléfono o member ID.
 *
 * El correo vive en `auth.users` y el resto en `profiles`, así que se busca en
 * los dos sitios y se unen los resultados.
 */
export async function buscarUsuarios(consulta: string, limite = 25): Promise<ResumenUsuario[]> {
  const servicio = crearClienteServicio();
  const q = consulta.trim();

  let ids: string[] | null = null;

  if (q.length > 0) {
    // `%` y `_` son comodines de LIKE: escaparlos evita que una búsqueda con
    // guion bajo devuelva a todo el mundo.
    const patron = `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`;

    const [porPerfil, porCorreo] = await Promise.all([
      servicio
        .from("profiles")
        .select("id")
        .or(
          `first_name.ilike.${patron},last_name.ilike.${patron},` +
            `phone.ilike.${patron},member_id.ilike.${patron}`
        )
        .limit(limite),
      servicio.auth.admin.listUsers({ page: 1, perPage: 200 }),
    ]);

    const deCorreo = (porCorreo.data?.users ?? [])
      .filter((u) => u.email?.toLowerCase().includes(q.toLowerCase()))
      .map((u) => u.id);

    ids = [...new Set([...(porPerfil.data ?? []).map((p) => p.id), ...deCorreo])].slice(0, limite);
    if (ids.length === 0) return [];
  }

  let perfilQuery = servicio
    .from("profiles")
    .select("id, first_name, last_name, phone, member_id, created_at")
    .order("created_at", { ascending: false })
    .limit(limite);

  if (ids) perfilQuery = perfilQuery.in("id", ids);

  const { data: perfiles } = await perfilQuery;
  if (!perfiles?.length) return [];

  const encontrados = perfiles.map((p) => p.id);

  const [{ data: lealtad }, { data: wallets }, listado] = await Promise.all([
    servicio.from("loyalty_accounts_con_nivel").select("user_id, points_balance, tier").in("user_id", encontrados),
    servicio.from("wallets").select("user_id, balance_cents").in("user_id", encontrados),
    servicio.auth.admin.listUsers({ page: 1, perPage: 200 }),
  ]);

  const puntosPor = new Map((lealtad ?? []).map((l) => [l.user_id, l]));
  const saldoPor = new Map((wallets ?? []).map((w) => [w.user_id, Number(w.balance_cents)]));
  const correoPor = new Map((listado.data?.users ?? []).map((u) => [u.id, u.email ?? null]));

  return perfiles.map((p) => ({
    id: p.id,
    memberId: p.member_id,
    nombre: [p.first_name, p.last_name].filter(Boolean).join(" ") || "—",
    email: correoPor.get(p.id) ?? null,
    telefono: p.phone,
    puntos: Number(puntosPor.get(p.id)?.points_balance ?? 0),
    nivel: puntosPor.get(p.id)?.tier ?? "semilla",
    saldoCents: saldoPor.get(p.id) ?? 0,
    alta: p.created_at,
  }));
}

export type Movimiento = {
  id: string;
  cantidad: number;
  saldoDespues: number;
  tipo: string;
  descripcion: string | null;
  fecha: string;
};

export type FichaUsuario = ResumenUsuario & {
  movimientosWallet: Movimiento[];
  movimientosPuntos: Movimiento[];
};

export async function obtenerFicha(userId: string): Promise<FichaUsuario | null> {
  const [usuarios, { data: wallet }, { data: puntos }] = await Promise.all([
    buscarUsuariosPorId(userId),
    crearClienteServicio()
      .from("wallet_transactions")
      .select("id, amount_cents, balance_after_cents, transaction_type, description, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30),
    crearClienteServicio()
      .from("loyalty_transactions")
      .select("id, points, balance_after, transaction_type, description, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (!usuarios) return null;

  return {
    ...usuarios,
    movimientosWallet: (wallet ?? []).map((m) => ({
      id: m.id,
      cantidad: Number(m.amount_cents),
      saldoDespues: Number(m.balance_after_cents),
      tipo: m.transaction_type,
      descripcion: m.description,
      fecha: m.created_at,
    })),
    movimientosPuntos: (puntos ?? []).map((m) => ({
      id: m.id,
      cantidad: Number(m.points),
      saldoDespues: Number(m.balance_after),
      tipo: m.transaction_type,
      descripcion: m.description,
      fecha: m.created_at,
    })),
  };
}

async function buscarUsuariosPorId(userId: string): Promise<ResumenUsuario | null> {
  const servicio = crearClienteServicio();

  const [{ data: perfil }, { data: lealtad }, { data: wallet }, usuario] = await Promise.all([
    servicio
      .from("profiles")
      .select("id, first_name, last_name, phone, member_id, created_at")
      .eq("id", userId)
      .maybeSingle(),
    servicio
      .from("loyalty_accounts_con_nivel")
      .select("points_balance, tier")
      .eq("user_id", userId)
      .maybeSingle(),
    servicio.from("wallets").select("balance_cents").eq("user_id", userId).maybeSingle(),
    servicio.auth.admin.getUserById(userId),
  ]);

  if (!perfil) return null;

  return {
    id: perfil.id,
    memberId: perfil.member_id,
    nombre: [perfil.first_name, perfil.last_name].filter(Boolean).join(" ") || "—",
    email: usuario.data.user?.email ?? null,
    telefono: perfil.phone,
    puntos: Number(lealtad?.points_balance ?? 0),
    nivel: lealtad?.tier ?? "semilla",
    saldoCents: Number(wallet?.balance_cents ?? 0),
    alta: perfil.created_at,
  };
}

/* ── Pedidos de gift card ────────────────────────────────────────────────── */

export type PedidoGiftCard = {
  id: string;
  estado: string;
  centavos: number;
  formato: string;
  destinatario: string;
  correoDestinatario: string | null;
  creado: string;
  pagado: string | null;
  /** Últimos cuatro del código. El código completo no existe en la base. */
  last4: string | null;
  estadoTarjeta: string | null;
};

export async function listarPedidos(limite = 50): Promise<PedidoGiftCard[]> {
  const servicio = crearClienteServicio();
  const { data } = await servicio
    .from("gift_card_orders")
    .select(
      "id, status, amount_cents, format, recipient_name, recipient_email, created_at, paid_at, " +
        "gift_cards(code_last4, status)"
    )
    .order("created_at", { ascending: false })
    .limit(limite);

  /*
   * El cliente de Supabase tipa un select anidado como unión con su tipo de
   * error, así que la forma se declara aquí en vez de pelear con el genérico.
   */
  type FilaPedido = {
    id: string;
    status: string;
    amount_cents: number | string;
    format: string;
    recipient_name: string;
    recipient_email: string | null;
    created_at: string;
    paid_at: string | null;
    gift_cards: { code_last4: string; status: string }[] | { code_last4: string; status: string } | null;
  };

  return ((data ?? []) as unknown as FilaPedido[]).map((o) => {
    const tarjeta = Array.isArray(o.gift_cards) ? o.gift_cards[0] : o.gift_cards;
    return {
      id: o.id,
      estado: o.status,
      centavos: Number(o.amount_cents),
      formato: o.format,
      destinatario: o.recipient_name,
      correoDestinatario: o.recipient_email,
      creado: o.created_at,
      pagado: o.paid_at,
      last4: tarjeta?.code_last4 ?? null,
      estadoTarjeta: tarjeta?.status ?? null,
    };
  });
}

/* ── Auditoría ───────────────────────────────────────────────────────────── */

export type EntradaAuditoria = {
  id: string;
  accion: string;
  entidad: string;
  motivo: string | null;
  actor: string | null;
  objetivo: string | null;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
  requestId: string | null;
  fecha: string;
};

export async function listarAuditoria(limite = 100): Promise<EntradaAuditoria[]> {
  const servicio = crearClienteServicio();
  const { data } = await servicio
    .from("audit_logs")
    .select(
      "id, action, entity_type, reason, actor_user_id, target_user_id, before_data, after_data, request_id, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limite);

  return (data ?? []).map((l) => ({
    id: l.id,
    accion: l.action,
    entidad: l.entity_type,
    motivo: l.reason,
    actor: l.actor_user_id,
    objetivo: l.target_user_id,
    antes: l.before_data,
    despues: l.after_data,
    requestId: l.request_id,
    fecha: l.created_at,
  }));
}

/* ── Resumen ─────────────────────────────────────────────────────────────── */

export async function obtenerResumen() {
  const servicio = crearClienteServicio();

  const [miembros, saldos, pedidos, ajustes] = await Promise.all([
    servicio.from("profiles").select("id", { count: "exact", head: true }),
    servicio.from("wallets").select("balance_cents"),
    servicio.from("gift_card_orders").select("status"),
    servicio.from("audit_logs").select("id", { count: "exact", head: true }),
  ]);

  const totalSaldo = (saldos.data ?? []).reduce((s, w) => s + Number(w.balance_cents), 0);
  const pagados = (pedidos.data ?? []).filter((p) => p.status === "paid").length;

  return {
    miembros: miembros.count ?? 0,
    saldoTotalCents: totalSaldo,
    pedidosTotales: pedidos.data?.length ?? 0,
    pedidosPagados: pagados,
    entradasAuditoria: ajustes.count ?? 0,
  };
}

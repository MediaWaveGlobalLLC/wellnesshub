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

export type PaginaUsuarios = {
  usuarios: ResumenUsuario[];
  total: number;
  pagina: number;
  porPagina: number;
};

/**
 * Busca por nombre, apellido, correo, teléfono o member ID.
 *
 * Una sola consulta, en `admin_buscar_usuarios` (`0014_perfil_email.sql`).
 *
 * La versión anterior hacía cuatro viajes y cruzaba en memoria, y el correo lo
 * sacaba de `listUsers({ perPage: 200 })`. Ese 200 era un techo silencioso: a
 * partir del socio 201, buscar por correo devolvía «Sin resultados» sobre
 * cuentas que existían. Ahora el correo vive en `profiles` y se busca con un
 * `ilike` normal.
 */
export async function buscarUsuarios(
  consulta: string,
  pagina = 1,
  porPagina = 25
): Promise<PaginaUsuarios> {
  const servicio = crearClienteServicio();
  const paginaSegura = Math.max(1, Math.trunc(pagina));

  type Fila = {
    id: string;
    member_id: string;
    nombre: string | null;
    email: string | null;
    telefono: string | null;
    puntos: number;
    nivel: string;
    saldo_cents: number;
    alta: string;
    total: number;
  };

  const { data, error } = await servicio.rpc("admin_buscar_usuarios", {
    p_consulta: consulta.trim(),
    p_limite: porPagina,
    p_offset: (paginaSegura - 1) * porPagina,
  });

  if (error) throw new Error(`No se pudo buscar usuarios: ${error.message}`);

  const filas = (data ?? []) as Fila[];

  return {
    // `count(*) over ()` viaja en cada fila; sin filas no hay total, y sin
    // resultados el total es cero de todos modos.
    total: filas.length > 0 ? Number(filas[0]!.total) : 0,
    pagina: paginaSegura,
    porPagina,
    usuarios: filas.map((f) => ({
      id: f.id,
      memberId: f.member_id,
      nombre: f.nombre ?? "—",
      email: f.email,
      telefono: f.telefono,
      puntos: Number(f.puntos),
      nivel: f.nivel,
      saldoCents: Number(f.saldo_cents),
      alta: f.alta,
    })),
  };
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

  // Ya no hace falta preguntar a la API de Auth por el correo: desde
  // `0014_perfil_email.sql` vive en `profiles`, sincronizado por trigger.
  const [{ data: perfil }, { data: lealtad }, { data: wallet }] = await Promise.all([
    servicio
      .from("profiles")
      .select("id, first_name, last_name, phone, email, member_id, created_at")
      .eq("id", userId)
      .maybeSingle(),
    servicio
      .from("loyalty_accounts_con_nivel")
      .select("points_balance, tier")
      .eq("user_id", userId)
      .maybeSingle(),
    servicio.from("wallets").select("balance_cents").eq("user_id", userId).maybeSingle(),
  ]);

  if (!perfil) return null;

  return {
    id: perfil.id,
    memberId: perfil.member_id,
    nombre: [perfil.first_name, perfil.last_name].filter(Boolean).join(" ") || "—",
    email: perfil.email,
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

/** Quién hizo algo o a quién se lo hicieron, en legible. */
export type Persona = { id: string; nombre: string; email: string | null };

export type EntradaAuditoria = {
  id: string;
  accion: string;
  entidad: string;
  motivo: string | null;
  actor: Persona | null;
  objetivo: Persona | null;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
  requestId: string | null;
  fecha: string;
};

export type PaginaAuditoria = {
  entradas: EntradaAuditoria[];
  total: number;
  pagina: number;
  porPagina: number;
};

/**
 * Rastro de acciones administrativas, con las personas resueltas.
 *
 * Antes devolvía `actor_user_id` a secas —un UUID— y la página ni lo pintaba.
 * Un registro de auditoría que no dice quién hizo el cambio no sirve para lo
 * único que existe: saber quién tocó el dinero de un cliente.
 *
 * Se resuelven en una segunda consulta acotada a los ids que aparecen en la
 * página. No se puede anidar desde PostgREST porque `audit_logs.actor_user_id`
 * apunta a `auth.users`, no a `profiles`.
 */
export async function listarAuditoria(
  pagina = 1,
  porPagina = 50,
  filtroAccion?: string
): Promise<PaginaAuditoria> {
  const servicio = crearClienteServicio();
  const paginaSegura = Math.max(1, Math.trunc(pagina));
  const desde = (paginaSegura - 1) * porPagina;

  let consulta = servicio
    .from("audit_logs")
    .select(
      "id, action, entity_type, reason, actor_user_id, target_user_id, before_data, after_data, request_id, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    // Desempate estable: dos entradas del mismo segundo empatan, y sin segundo
    // criterio la paginación puede repetir una y saltarse otra.
    .order("id", { ascending: false })
    .range(desde, desde + porPagina - 1);

  if (filtroAccion) consulta = consulta.eq("action", filtroAccion);

  const { data, count } = await consulta;
  const filas = data ?? [];

  const ids = [
    ...new Set(
      filas.flatMap((l) => [l.actor_user_id, l.target_user_id]).filter((x): x is string => Boolean(x))
    ),
  ];

  const personas = new Map<string, Persona>();
  if (ids.length > 0) {
    const { data: perfiles } = await servicio
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", ids);

    for (const p of perfiles ?? []) {
      personas.set(p.id, {
        id: p.id,
        // Si la cuenta se borró, el perfil ya no está: se enseña el id en vez
        // de una fila vacía. El rastro sobrevive a la cuenta a propósito.
        nombre: [p.first_name, p.last_name].filter(Boolean).join(" ") || "—",
        email: p.email,
      });
    }
  }

  const resolver = (id: string | null): Persona | null =>
    id ? (personas.get(id) ?? { id, nombre: "Cuenta eliminada", email: null }) : null;

  return {
    total: count ?? 0,
    pagina: paginaSegura,
    porPagina,
    entradas: filas.map((l) => ({
      id: l.id,
      accion: l.action,
      entidad: l.entity_type,
      motivo: l.reason,
      actor: resolver(l.actor_user_id),
      objetivo: resolver(l.target_user_id),
      antes: l.before_data,
      despues: l.after_data,
      requestId: l.request_id,
      fecha: l.created_at,
    })),
  };
}

/* ── Resumen ─────────────────────────────────────────────────────────────── */

export type Resumen = {
  miembros: number;
  miembros7d: number;
  miembros30d: number;
  conMarketing: number;
  correoConfirmado: number;
  perfilVisitado: number;
  saldoTotalCents: number;
  walletsConSaldo: number;
  puntosTotal: number;
  pedidosTotales: number;
  pedidosPagados: number;
  giftcardsGmvCents: number;
  giftcardsSinCanjear: number;
  giftcardsBreakageCents: number;
  suscriptores: number;
  entradasAuditoria: number;
};

/**
 * Foto del negocio. Todo agregado en SQL (`0013_metricas.sql`).
 *
 * La versión anterior hacía `.from("wallets").select("balance_cents")` y sumaba
 * en JavaScript. El cliente de Supabase devuelve como mucho 1.000 filas, así
 * que con 1.001 miembros el crédito en circulación empezaba a enseñar menos del
 * real. Sin error y sin aviso, sobre el número que dice cuánto debe el negocio.
 */
export async function obtenerResumen(): Promise<Resumen> {
  const servicio = crearClienteServicio();

  const { data, error } = await servicio.rpc("metricas_resumen").single();
  if (error || !data) throw new Error(`No se pudo leer el resumen: ${error?.message}`);

  const d = data as Record<string, string | number>;
  const n = (clave: string) => Number(d[clave] ?? 0);

  return {
    miembros: n("miembros"),
    miembros7d: n("miembros_7d"),
    miembros30d: n("miembros_30d"),
    conMarketing: n("con_marketing"),
    correoConfirmado: n("correo_confirmado"),
    perfilVisitado: n("perfil_visitado"),
    saldoTotalCents: n("saldo_total_cents"),
    walletsConSaldo: n("wallets_con_saldo"),
    puntosTotal: n("puntos_total"),
    pedidosTotales: n("pedidos_totales"),
    pedidosPagados: n("pedidos_pagados"),
    giftcardsGmvCents: n("giftcards_gmv_cents"),
    giftcardsSinCanjear: n("giftcards_sin_canjear"),
    giftcardsBreakageCents: n("giftcards_breakage_cents"),
    suscriptores: n("suscriptores"),
    entradasAuditoria: n("entradas_auditoria"),
  };
}

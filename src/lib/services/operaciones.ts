import "server-only";

import { crearClienteServicio } from "@/lib/supabase/admin";
import type { Rol } from "./permisos";

/**
 * Lecturas de las operaciones del panel — `0017_operaciones_admin.sql`.
 *
 * Los conteos vienen agregados de SQL. Ninguna función de aquí trae filas para
 * contarlas fuera: el cliente de Supabase corta a 1.000 y un evento lleno
 * empezaría a decir un aforo más bajo que el real, que es exactamente el fallo
 * silencioso que corrigió 0013 con el crédito en circulación.
 */

function servicio() {
  return crearClienteServicio();
}

/* ── Eventos ─────────────────────────────────────────────────────────────── */

export type EventoAdmin = {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string | null;
  iniciaAt: string;
  terminaAt: string | null;
  lugar: string;
  /** `null` = sin límite de plazas. */
  aforo: number | null;
  publicado: boolean;
  confirmadas: number;
  asistieron: number;
  ausentes: number;
  canceladas: number;
};

/**
 * Todos los eventos, ya repartidos en próximos y pasados.
 *
 * El reparto se hace AQUÍ y no en la página. Mirar el reloj durante el render
 * de un componente es una función impura —el compilador de React lo rechaza, y
 * con razón: el corte cambiaría entre dos renders y un evento que empieza
 * dentro de un minuto saltaría de lista a mitad de una interacción—. Este
 * módulo es `server-only` y no es un componente: aquí el reloj se lee una vez
 * por petición y el resultado ya llega decidido.
 */
export async function listarEventos(): Promise<{
  todos: EventoAdmin[];
  proximos: EventoAdmin[];
  pasados: EventoAdmin[];
}> {
  const todos = await leerEventos();
  const ahora = Date.now();

  return {
    todos,
    proximos: todos.filter((e) => new Date(e.iniciaAt).getTime() >= ahora),
    pasados: todos.filter((e) => new Date(e.iniciaAt).getTime() < ahora),
  };
}

async function leerEventos(): Promise<EventoAdmin[]> {
  const { data, error } = await servicio().rpc("admin_eventos_listar");
  if (error) throw new Error(`No se pudieron leer los eventos: ${error.message}`);

  type Fila = {
    id: string;
    slug: string;
    titulo: string;
    descripcion: string | null;
    inicia_at: string;
    termina_at: string | null;
    lugar: string;
    aforo: number | null;
    publicado: boolean;
    confirmadas: string;
    asistieron: string;
    ausentes: string;
    canceladas: string;
  };

  return ((data ?? []) as Fila[]).map((e) => ({
    id: e.id,
    slug: e.slug,
    titulo: e.titulo,
    descripcion: e.descripcion,
    iniciaAt: e.inicia_at,
    terminaAt: e.termina_at,
    lugar: e.lugar,
    aforo: e.aforo,
    publicado: e.publicado,
    confirmadas: Number(e.confirmadas),
    asistieron: Number(e.asistieron),
    ausentes: Number(e.ausentes),
    canceladas: Number(e.canceladas),
  }));
}

export type ReservaAdmin = {
  id: string;
  userId: string;
  nombre: string;
  email: string | null;
  memberId: string | null;
  estado: "confirmada" | "cancelada" | "asistio" | "ausente";
  reservadoAt: string;
};

export async function listarReservas(eventoId: string): Promise<ReservaAdmin[]> {
  const { data, error } = await servicio().rpc("admin_evento_reservas", {
    p_evento_id: eventoId,
  });
  if (error) throw new Error(`No se pudo leer la lista de asistencia: ${error.message}`);

  type Fila = {
    reserva_id: string;
    user_id: string;
    nombre: string;
    email: string | null;
    member_id: string | null;
    estado: ReservaAdmin["estado"];
    reservado_at: string;
  };

  return ((data ?? []) as Fila[]).map((r) => ({
    id: r.reserva_id,
    userId: r.user_id,
    nombre: r.nombre,
    email: r.email,
    memberId: r.member_id,
    estado: r.estado,
    reservadoAt: r.reservado_at,
  }));
}

/* ── Newsletter ──────────────────────────────────────────────────────────── */

export type Suscriptor = {
  email: string;
  origen: string;
  confirmadoAt: string | null;
  bajaAt: string | null;
  altaAt: string;
};

export type PaginaNewsletter = {
  suscriptores: Suscriptor[];
  total: number;
  pagina: number;
  porPagina: number;
};

export async function listarNewsletter(
  consulta = "",
  pagina = 1,
  porPagina = 50
): Promise<PaginaNewsletter> {
  const paginaSegura = Math.max(1, Math.trunc(pagina));

  const { data, error } = await servicio().rpc("admin_newsletter_listar", {
    p_consulta: consulta.trim(),
    p_limite: porPagina,
    p_offset: (paginaSegura - 1) * porPagina,
  });

  if (error) throw new Error(`No se pudo leer la lista de correo: ${error.message}`);

  type Fila = {
    email: string;
    origen: string;
    confirmado_at: string | null;
    baja_at: string | null;
    alta_at: string;
    total: string;
  };

  const filas = (data ?? []) as Fila[];

  return {
    // `count(*) over ()` viaja en cada fila; sin filas, el total es cero igual.
    total: filas.length > 0 ? Number(filas[0]!.total) : 0,
    pagina: paginaSegura,
    porPagina,
    suscriptores: filas.map((f) => ({
      email: f.email,
      origen: f.origen,
      confirmadoAt: f.confirmado_at,
      bajaAt: f.baja_at,
      altaAt: f.alta_at,
    })),
  };
}

/* ── Administradoras ─────────────────────────────────────────────────────── */

export type Administradora = {
  userId: string;
  nombre: string;
  email: string | null;
  rol: Rol;
  nota: string | null;
  concedidoPor: string | null;
  altaAt: string;
};

export async function listarAdmins(): Promise<Administradora[]> {
  const { data, error } = await servicio().rpc("admin_listar_admins");
  if (error) throw new Error(`No se pudo leer el equipo: ${error.message}`);

  type Fila = {
    user_id: string;
    nombre: string;
    email: string | null;
    rol: Rol;
    nota: string | null;
    concedido_por: string | null;
    alta_at: string;
  };

  return ((data ?? []) as Fila[]).map((a) => ({
    userId: a.user_id,
    nombre: a.nombre,
    email: a.email,
    rol: a.rol,
    nota: a.nota,
    concedidoPor: a.concedido_por,
    altaAt: a.alta_at,
  }));
}

/* ── Gift cards ──────────────────────────────────────────────────────────── */

export type TarjetaAdmin = {
  /** `null` cuando el pedido nunca llegó a pagarse: no hay tarjeta emitida. */
  id: string | null;
  pedidoId: string;
  estadoPedido: string;
  estadoTarjeta: string | null;
  /** Lo que se emitió y se cobró. No cambia nunca. */
  centavos: number;
  /** Lo que queda por gastar. `null` si no hay tarjeta emitida. */
  saldoCents: number | null;
  formato: string;
  destinatario: string;
  correoDestinatario: string | null;
  compradorEmail: string | null;
  last4: string | null;
  creado: string;
  pagado: string | null;
  canjeadoAt: string | null;
};

/**
 * Pedidos con su tarjeta, buscables por destinatario, correo o últimos cuatro.
 *
 * Se sigue leyendo con PostgREST y no con una función nueva: aquí no hay
 * ninguna suma que pueda mentir por el corte de mil filas, solo una página de
 * cincuenta pedidos.
 */
export async function listarPedidosGiftCard(
  consulta = "",
  pagina = 1,
  porPagina = 25
): Promise<{ pedidos: TarjetaAdmin[]; total: number; pagina: number; porPagina: number }> {
  const paginaSegura = Math.max(1, Math.trunc(pagina));
  const desde = (paginaSegura - 1) * porPagina;
  const q = consulta.trim();

  let consultaSb = servicio()
    .from("gift_card_orders")
    .select(
      "id, status, amount_cents, format, recipient_name, recipient_email, created_at, paid_at, " +
        "purchaser_user_id, gift_cards(id, code_last4, status, redeemed_at, balance_cents)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    // Desempate estable: dos pedidos del mismo instante bailarían entre páginas.
    .order("id", { ascending: false })
    .range(desde, desde + porPagina - 1);

  if (q) {
    // `or` de PostgREST: nombre o correo del destinatario. Los últimos cuatro
    // viven en la tabla anidada y no se pueden filtrar desde aquí, así que se
    // resuelven abajo sobre la página traída.
    consultaSb = consultaSb.or(
      `recipient_name.ilike.%${q}%,recipient_email.ilike.%${q}%`
    );
  }

  const { data, count, error } = await consultaSb;
  if (error) throw new Error(`No se pudieron leer los pedidos: ${error.message}`);

  type FilaPedido = {
    id: string;
    status: string;
    amount_cents: number | string;
    format: string;
    recipient_name: string;
    recipient_email: string | null;
    created_at: string;
    paid_at: string | null;
    purchaser_user_id: string;
    gift_cards: FilaTarjeta[] | FilaTarjeta | null;
  };

  type FilaTarjeta = {
    id: string;
    code_last4: string;
    status: string;
    redeemed_at: string | null;
    balance_cents: number | string;
  };

  const filas = (data ?? []) as unknown as FilaPedido[];

  // Correo de quien compró, en una segunda consulta acotada a esta página.
  const compradores = [...new Set(filas.map((f) => f.purchaser_user_id))];
  const correos = new Map<string, string | null>();
  if (compradores.length > 0) {
    const { data: perfiles } = await servicio()
      .from("profiles")
      .select("id, email")
      .in("id", compradores);
    for (const p of perfiles ?? []) correos.set(p.id, p.email);
  }

  return {
    total: count ?? 0,
    pagina: paginaSegura,
    porPagina,
    pedidos: filas.map((o) => {
      const t = Array.isArray(o.gift_cards) ? o.gift_cards[0] : o.gift_cards;
      return {
        id: t?.id ?? null,
        pedidoId: o.id,
        estadoPedido: o.status,
        estadoTarjeta: t?.status ?? null,
        centavos: Number(o.amount_cents),
        saldoCents: t ? Number(t.balance_cents) : null,
        formato: o.format,
        destinatario: o.recipient_name,
        correoDestinatario: o.recipient_email,
        compradorEmail: correos.get(o.purchaser_user_id) ?? null,
        last4: t?.code_last4 ?? null,
        creado: o.created_at,
        pagado: o.paid_at,
        canjeadoAt: t?.redeemed_at ?? null,
      };
    }),
  };
}

/* ── Pedidos — `0021_pedidos.sql` ────────────────────────────────────────── */

export type PedidoEnCola = {
  id: string;
  numero: string;
  estado: "pagado" | "preparando";
  totalCents: number;
  metodoPago: "wallet" | "stripe" | null;
  pagado: string | null;
  persona: string | null;
  email: string | null;
  /** "2× Latte (12 oz) · 1× Matcha Clásico". Ya montado en SQL. */
  lineas: string | null;
};

/** La cola de la barra: pagado y sin entregar, lo más viejo primero. */
export async function listarColaPedidos(): Promise<PedidoEnCola[]> {
  const { data, error } = await servicio().rpc("admin_pedidos_cola");
  if (error) throw new Error(`No se pudo leer la cola: ${error.message}`);

  type Fila = {
    id: string;
    order_number: string;
    status: string;
    total_cents: string;
    metodo_pago: string | null;
    pagado: string | null;
    persona: string | null;
    email: string | null;
    lineas: string | null;
  };

  return ((data ?? []) as Fila[]).map((p) => ({
    id: p.id,
    numero: p.order_number,
    estado: p.status as PedidoEnCola["estado"],
    totalCents: Number(p.total_cents),
    metodoPago: (p.metodo_pago as PedidoEnCola["metodoPago"]) ?? null,
    pagado: p.pagado,
    // El RPC devuelve cadena vacía si el perfil no tiene nombre todavía.
    persona: p.persona && p.persona.length > 0 ? p.persona : null,
    email: p.email,
    lineas: p.lineas,
  }));
}

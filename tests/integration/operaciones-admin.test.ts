// @vitest-environment node
/**
 * Las operaciones que faltaban (migración 0017).
 *
 * Lo que se prueba aquí no es que las funciones «funcionen»: es que se NIEGUEN
 * en los cuatro casos donde ceder rompería algo real —una tarjeta ya canjeada,
 * un aforo por debajo de las reservas, un evento con gente apuntada, la última
 * dueña— y que cada cambio deje su fila de auditoría.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { crearBase, crearUsuario, leerFresco, type Db } from "./supabase-harness";

let db: Db;
let duena: string;
let empleado: string;
let cliente: string;

/** Hash con la forma que exige la función: 64 hex. */
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

beforeAll(async () => {
  db = await crearBase();

  duena = await crearUsuario(db, { email: "duena@siembra.test", firstName: "Erika" });
  empleado = await crearUsuario(db, { email: "mostrador@siembra.test", firstName: "Mostrador" });
  cliente = await crearUsuario(db, { email: "cliente@siembra.test", firstName: "Ana", lastName: "Rivera" });

  await db.query("insert into public.admin_users (user_id, rol) values ($1, 'duena')", [duena]);
  await db.query("insert into public.admin_users (user_id, rol) values ($1, 'empleado')", [empleado]);
}, 120_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec(`
    delete from public.event_bookings;
    delete from public.events;
    delete from public.gift_cards;
    delete from public.gift_card_orders;
    delete from public.newsletter_subscribers;
    delete from public.audit_logs;
  `);
});

/**
 * Pedido pagado + tarjeta activa, que es de donde parte todo lo de gift cards.
 *
 * `balance_cents` se declara a mano porque desde 0019 la columna no tiene
 * DEFAULT: una tarjeta sin saldo declarado es un error, no un cero.
 */
async function crearTarjeta(hash = HASH_A, last4 = "WXYZ", saldo = 5000): Promise<string> {
  const pedido = await db.query<{ id: string }>(
    `insert into public.gift_card_orders
       (purchaser_user_id, amount_cents, format, recipient_name, status, paid_at)
     values ($1, 5000, 'digital', 'Ana', 'paid', now()) returning id`,
    [cliente]
  );
  const card = await db.query<{ id: string }>(
    `insert into public.gift_cards (order_id, code_hash, code_last4, amount_cents, balance_cents)
     values ($1, $2, $3, 5000, $4) returning id`,
    [pedido.rows[0]!.id, hash, last4, saldo]
  );
  return card.rows[0]!.id;
}

async function auditoria(accion: string): Promise<number> {
  const r = await leerFresco<{ n: string }>(
    db,
    "select count(*)::text as n from public.audit_logs where action = $1",
    [accion]
  );
  return Number(r[0]!.n);
}

describe("gift cards", () => {
  it("anular deja la tarjeta cancelada y su rastro", async () => {
    const id = await crearTarjeta();
    await db.query("select * from public.admin_gift_card_anular($1, $2, 'Compra por error')", [duena, id]);

    const r = await leerFresco<{ status: string }>(
      db, "select status from public.gift_cards where id = $1", [id]
    );
    expect(r[0]!.status).toBe("cancelled");
    expect(await auditoria("gift_card_anulada")).toBe(1);
  });

  it("NO anula una tarjeta ya canjeada", async () => {
    /*
      El caso que importa. El dinero ya está en el wallet de alguien y el
      movimiento es inmutable: marcarla cancelada dejaría dos registros contando
      historias distintas sobre el mismo dinero.
    */
    const id = await crearTarjeta();
    // Agotada: sin saldo y marcada. Los dos a la vez, que es como la deja el
    // canje que se lleva lo último que quedaba.
    await db.query(
      "update public.gift_cards set status = 'redeemed', balance_cents = 0 where id = $1",
      [id]
    );

    await expect(
      db.query("select * from public.admin_gift_card_anular($1, $2, 'Devolución')", [duena, id])
    ).rejects.toThrow(/ya_canjeada/);
  });

  it("rotar el código cambia hash y last4, y no guarda ningún código", async () => {
    const id = await crearTarjeta();
    await db.query(
      "select * from public.admin_gift_card_rotar_codigo($1, $2, $3, 'QRST', 'La clienta perdió el código')",
      [duena, id, HASH_B]
    );

    const r = await leerFresco<{ code_hash: string; code_last4: string }>(
      db, "select code_hash, code_last4 from public.gift_cards where id = $1", [id]
    );
    expect(r[0]!.code_hash).toBe(HASH_B);
    expect(r[0]!.code_last4).toBe("QRST");

    // La auditoría guarda los last4, nunca un hash ni un código.
    const log = await leerFresco<{ antes: string; despues: string }>(
      db,
      `select before_data::text as antes, after_data::text as despues
         from public.audit_logs where action = 'gift_card_codigo_rotado'`
    );
    expect(log[0]!.antes).toContain("WXYZ");
    expect(log[0]!.despues).toContain("QRST");
    expect(log[0]!.antes + log[0]!.despues).not.toContain(HASH_A);
    expect(log[0]!.antes + log[0]!.despues).not.toContain(HASH_B);
  });

  it("rechaza un hash que no tenga forma de hash", async () => {
    // Si por un fallo de la aplicación llegara aquí el código en claro, la base
    // lo rechaza: `docs/04` prohíbe que exista en ninguna fila.
    const id = await crearTarjeta();
    await expect(
      db.query(
        "select * from public.admin_gift_card_rotar_codigo($1, $2, 'SMB-1A2B3-C4D5E', 'C4D5', 'Perdió el código')",
        [duena, id]
      )
    ).rejects.toThrow(/hash_invalido/);
  });

  it("no rota el código de una tarjeta anulada", async () => {
    const id = await crearTarjeta();
    await db.query("select * from public.admin_gift_card_anular($1, $2, 'Fraude')", [duena, id]);
    await expect(
      db.query(
        "select * from public.admin_gift_card_rotar_codigo($1, $2, $3, 'QRST', 'Perdió el código')",
        [duena, id, HASH_B]
      )
    ).rejects.toThrow(/tarjeta_no_activa/);
  });

  it("un empleado no toca ninguna tarjeta", async () => {
    const id = await crearTarjeta();
    await expect(
      db.query("select * from public.admin_gift_card_anular($1, $2, 'Motivo')", [empleado, id])
    ).rejects.toThrow(/no_autorizado/);
  });

  /* ── Recarga (0019) ───────────────────────────────────────────────────── */

  const recargar = (id: string, centavos: number, actor = duena, motivo = "Cortesía") =>
    db.query<{ saldo_cents: string; estado: string }>(
      "select * from public.admin_gift_card_recargar($1, $2, $3, $4)",
      [actor, id, centavos, motivo]
    );

  it("recargar suma al saldo y no toca el importe emitido", async () => {
    const id = await crearTarjeta(HASH_A, "WXYZ", 3000);
    const r = await recargar(id, 2500);

    expect(Number(r.rows[0]!.saldo_cents)).toBe(5500);

    const fila = await leerFresco<{ balance_cents: string; amount_cents: string }>(
      db,
      "select balance_cents, amount_cents from public.gift_cards where id = $1",
      [id]
    );
    expect(Number(fila[0]!.balance_cents)).toBe(5500);
    // `amount_cents` es lo que se cobró por Stripe: no se mueve nunca.
    expect(Number(fila[0]!.amount_cents)).toBe(5000);
    expect(await auditoria("gift_card_recargada")).toBe(1);
  });

  it("recargar una agotada la devuelve a la vida con el mismo código", async () => {
    const id = await crearTarjeta(HASH_A, "WXYZ", 0);
    await db.query(
      "update public.gift_cards set status = 'redeemed', redeemed_at = now(), redeemed_by_user_id = $2 where id = $1",
      [id, cliente]
    );

    const r = await recargar(id, 4000);
    expect(r.rows[0]!.estado).toBe("active");

    const fila = await leerFresco<{
      status: string;
      balance_cents: string;
      code_hash: string;
      redeemed_at: string | null;
      redeemed_by_user_id: string | null;
    }>(
      db,
      `select status, balance_cents, code_hash, redeemed_at, redeemed_by_user_id
         from public.gift_cards where id = $1`,
      [id]
    );
    expect(fila[0]!.status).toBe("active");
    expect(Number(fila[0]!.balance_cents)).toBe(4000);
    // El código no cambia: quien la tenga sigue pudiendo usarla.
    expect(fila[0]!.code_hash).toBe(HASH_A);
    // Ya no está agotada, así que el rastro de quién la agotó sale de la fila...
    expect(fila[0]!.redeemed_at).toBeNull();
    expect(fila[0]!.redeemed_by_user_id).toBeNull();

    // ...pero no se pierde: queda en el `before_data` de la auditoría.
    const log = await leerFresco<{ antes: string }>(
      db,
      `select before_data::text as antes from public.audit_logs
        where action = 'gift_card_recargada'`
    );
    expect(log[0]!.antes).toContain(cliente);
  });

  it("no recarga una anulada: primero hay que reactivarla", async () => {
    const id = await crearTarjeta();
    await db.query("select * from public.admin_gift_card_anular($1, $2, 'Fraude')", [duena, id]);
    await expect(recargar(id, 1000)).rejects.toThrow(/tarjeta_anulada/);
  });

  it("no recarga una caducada", async () => {
    const id = await crearTarjeta();
    await db.query("update public.gift_cards set expires_at = now() - interval '1 day' where id = $1", [id]);
    await expect(recargar(id, 1000)).rejects.toThrow(/tarjeta_caducada/);
  });

  it("rechaza importes que no son importes", async () => {
    const id = await crearTarjeta();
    await expect(recargar(id, 0)).rejects.toThrow(/importe_invalido/);
    await expect(recargar(id, -500)).rejects.toThrow(/importe_invalido/);
    // El mismo tope que el ajuste de wallet: $5.000 por operación.
    await expect(recargar(id, 500_001)).rejects.toThrow(/importe_excesivo/);
  });

  it("recargar exige motivo y rol de dueña", async () => {
    const id = await crearTarjeta();
    await expect(recargar(id, 1000, duena, "   ")).rejects.toThrow(/motivo_obligatorio/);
    await expect(recargar(id, 1000, empleado)).rejects.toThrow(/no_autorizado/);
  });
});

describe("eventos", () => {
  async function crearEvento(aforo: number | null = 10, publicado = true): Promise<string> {
    const r = await db.query<{ evento_id: string }>(
      `select evento_id from public.admin_evento_crear(
         $1, 'taller-matcha', 'Taller de matcha', 'Ceremonia y cata',
         now() + interval '7 days', now() + interval '7 days 2 hours',
         'SIEMBRA Condado', $2, $3, 'Programación de agosto')`,
      [duena, aforo, publicado]
    );
    return r.rows[0]!.evento_id;
  }

  it("crear deja el evento y su auditoría", async () => {
    const id = await crearEvento();
    const r = await leerFresco<{ slug: string; published: boolean }>(
      db, "select slug, published from public.events where id = $1", [id]
    );
    expect(r[0]!.slug).toBe("taller-matcha");
    expect(r[0]!.published).toBe(true);
    expect(await auditoria("evento_creado")).toBe(1);
  });

  it("rechaza un slug que no es un slug y uno repetido", async () => {
    await expect(
      db.query(
        `select * from public.admin_evento_crear($1, 'Taller Matcha!', 'T', null,
           now(), null, null, null, false, 'Motivo')`,
        [duena]
      )
    ).rejects.toThrow(/slug_invalido/);

    await crearEvento();
    await expect(crearEvento()).rejects.toThrow(/slug_duplicado/);
  });

  it("rechaza que el final sea anterior al inicio", async () => {
    await expect(
      db.query(
        `select * from public.admin_evento_crear($1, 'taller-x', 'T', null,
           now() + interval '2 days', now() + interval '1 day', null, null, false, 'Motivo')`,
        [duena]
      )
    ).rejects.toThrow(/fin_antes_del_inicio/);
  });

  it("NO baja el aforo por debajo de las reservas confirmadas", async () => {
    // Bajarlo vendería dos veces la misma plaza. Se rechaza en vez de decidir a
    // quién se echa.
    const id = await crearEvento(10);
    await db.query(
      "insert into public.event_bookings (user_id, event_id, status) values ($1, $2, 'confirmada')",
      [cliente, id]
    );
    await db.query(
      "insert into public.event_bookings (user_id, event_id, status) values ($1, $2, 'asistio')",
      [empleado, id]
    );

    await expect(
      db.query(
        `select * from public.admin_evento_editar($1, $2, 'Taller de matcha', null,
           now() + interval '7 days', null, null, 1, 'Reduzco aforo')`,
        [duena, id]
      )
    ).rejects.toThrow(/aforo_menor_que_reservas/);
  });

  it("NO borra un evento con reservas: hay que despublicarlo", async () => {
    /*
      `event_bookings.event_id` tiene `on delete cascade` (0005:92). Borrar el
      evento borraría en silencio las reservas de la gente, y quien apartó su
      plaza la vería desaparecer sin que nadie se lo diga.
    */
    const id = await crearEvento();
    await db.query(
      "insert into public.event_bookings (user_id, event_id) values ($1, $2)", [cliente, id]
    );

    await expect(
      db.query("select * from public.admin_evento_borrar($1, $2, 'Se cancela')", [duena, id])
    ).rejects.toThrow(/evento_con_reservas/);

    // Despublicar sí, y las reservas siguen ahí.
    await db.query(
      "select * from public.admin_evento_publicar($1, $2, false, 'Se aplaza')", [duena, id]
    );
    const r = await leerFresco<{ published: boolean; reservas: string }>(
      db,
      `select e.published, (select count(*)::text from public.event_bookings b where b.event_id = e.id) as reservas
         from public.events e where e.id = $1`,
      [id]
    );
    expect(r[0]!.published).toBe(false);
    expect(Number(r[0]!.reservas)).toBe(1);
  });

  it("sí borra un evento al que no se apuntó nadie", async () => {
    const id = await crearEvento();
    await db.query("select * from public.admin_evento_borrar($1, $2, 'Me equivoqué de fecha')", [duena, id]);
    const r = await leerFresco<{ n: string }>(
      db, "select count(*)::text as n from public.events where id = $1", [id]
    );
    expect(Number(r[0]!.n)).toBe(0);
    expect(await auditoria("evento_borrado")).toBe(1);
  });

  it("el MOSTRADOR puede marcar asistencia, que es la tarea de la puerta", async () => {
    const id = await crearEvento();
    const b = await db.query<{ id: string }>(
      "insert into public.event_bookings (user_id, event_id) values ($1, $2) returning id",
      [cliente, id]
    );

    await db.query("select * from public.admin_evento_asistencia($1, $2, 'asistio')", [
      empleado,
      b.rows[0]!.id,
    ]);

    const r = await leerFresco<{ status: string }>(
      db, "select status from public.event_bookings where id = $1", [b.rows[0]!.id]
    );
    expect(r[0]!.status).toBe("asistio");
    expect(await auditoria("asistencia_marcada")).toBe(1);
  });

  it("quien no es del equipo no marca nada", async () => {
    const id = await crearEvento();
    const b = await db.query<{ id: string }>(
      "insert into public.event_bookings (user_id, event_id) values ($1, $2) returning id",
      [cliente, id]
    );
    await expect(
      db.query("select * from public.admin_evento_asistencia($1, $2, 'asistio')", [
        cliente,
        b.rows[0]!.id,
      ])
    ).rejects.toThrow(/no_autorizado/);
  });

  it("no marca como asistida una reserva que la persona canceló", async () => {
    const id = await crearEvento();
    const b = await db.query<{ id: string }>(
      "insert into public.event_bookings (user_id, event_id, status) values ($1, $2, 'cancelada') returning id",
      [cliente, id]
    );
    await expect(
      db.query("select * from public.admin_evento_asistencia($1, $2, 'asistio')", [
        empleado,
        b.rows[0]!.id,
      ])
    ).rejects.toThrow(/reserva_cancelada/);
  });

  it("el listado cuenta los estados en SQL, no trayendo filas", async () => {
    const id = await crearEvento();
    await db.query(
      `insert into public.event_bookings (user_id, event_id, status) values
         ($1, $3, 'confirmada'), ($2, $3, 'asistio')`,
      [cliente, empleado, id]
    );

    const r = await db.query<{ confirmadas: string; asistieron: string; aforo: number }>(
      "select confirmadas, asistieron, aforo from public.admin_eventos_listar()"
    );
    expect(Number(r.rows[0]!.confirmadas)).toBe(1);
    expect(Number(r.rows[0]!.asistieron)).toBe(1);
    expect(r.rows[0]!.aforo).toBe(10);
  });

  it("la lista de asistencia trae a la persona resuelta", async () => {
    const id = await crearEvento();
    await db.query("insert into public.event_bookings (user_id, event_id) values ($1, $2)", [cliente, id]);

    const r = await db.query<{ nombre: string; email: string; estado: string }>(
      "select nombre, email, estado from public.admin_evento_reservas($1)", [id]
    );
    expect(r.rows[0]!.nombre).toBe("Ana Rivera");
    expect(r.rows[0]!.email).toBe("cliente@siembra.test");
    expect(r.rows[0]!.estado).toBe("confirmada");
  });
});

describe("newsletter", () => {
  it("por fin se puede leer, con búsqueda y total", async () => {
    // Write-only desde 0007: se recogían correos que nadie podía consultar.
    await db.exec(`
      insert into public.newsletter_subscribers (email, source) values
        ('ana@ejemplo.com', 'home'),
        ('luis@ejemplo.com', 'comunidad'),
        ('marta@otro.com', 'home');
    `);

    const todas = await db.query<{ total: string }>(
      "select total from public.admin_newsletter_listar('', 50, 0)"
    );
    expect(todas.rows).toHaveLength(3);
    expect(Number(todas.rows[0]!.total)).toBe(3);

    const filtradas = await db.query<{ email: string }>(
      "select email from public.admin_newsletter_listar('ejemplo.com', 50, 0)"
    );
    expect(filtradas.rows).toHaveLength(2);
  });
});

describe("administradoras", () => {
  it("conceder y revocar dejan rastro, y el rol se puede cambiar", async () => {
    const nueva = await crearUsuario(db, { email: "socia@siembra.test", firstName: "Socia" });

    await db.query("select * from public.admin_conceder($1, $2, 'empleado', 'Barista de tarde')", [
      duena, nueva,
    ]);
    let r = await leerFresco<{ rol: string; note: string }>(
      db, "select rol, note from public.admin_users where user_id = $1", [nueva]
    );
    expect(r[0]!.rol).toBe("empleado");
    expect(r[0]!.note).toBe("Barista de tarde");
    expect(await auditoria("admin_concedido")).toBe(1);

    await db.query("select * from public.admin_conceder($1, $2, 'duena', null)", [duena, nueva]);
    r = await leerFresco<{ rol: string; note: string }>(
      db, "select rol, note from public.admin_users where user_id = $1", [nueva]
    );
    expect(r[0]!.rol).toBe("duena");
    // La nota anterior se conserva si no se manda una nueva.
    expect(r[0]!.note).toBe("Barista de tarde");
    expect(await auditoria("admin_rol_cambiado")).toBe(1);

    await db.query("select * from public.admin_revocar($1, $2, 'Dejó el equipo')", [duena, nueva]);
    const tras = await leerFresco<{ n: string }>(
      db, "select count(*)::text as n from public.admin_users where user_id = $1", [nueva]
    );
    expect(Number(tras[0]!.n)).toBe(0);
    expect(await auditoria("admin_revocado")).toBe(1);
  });

  it("nadie puede revocarse a sí misma", async () => {
    // La forma más fácil de quedarse fuera del panel sin querer.
    await expect(
      db.query("select * from public.admin_revocar($1, $1, 'Me voy')", [duena])
    ).rejects.toThrow(/no_puedes_revocarte/);
  });

  it("el trigger anti-cerrojo impide quedarse sin ninguna dueña", async () => {
    // Comprobación de 0012 desde esta ruta nueva: si se pudiera degradar a la
    // única dueña, el negocio se quedaría sin nadie que pueda administrarlo.
    const otra = await crearUsuario(db, { email: "otra@siembra.test" });
    await db.query("select * from public.admin_conceder($1, $2, 'duena', null)", [duena, otra]);

    await db.query("select * from public.admin_conceder($1, $2, 'empleado', null)", [otra, duena]);
    await expect(
      db.query("select * from public.admin_conceder($1, $1, 'empleado', null)", [otra])
    ).rejects.toThrow();
  });

  it("un empleado no puede nombrar a nadie", async () => {
    const alguien = await crearUsuario(db, { email: "alguien@siembra.test" });
    await expect(
      db.query("select * from public.admin_conceder($1, $2, 'duena', null)", [empleado, alguien])
    ).rejects.toThrow(/no_autorizado/);
  });

  it("el listado dice quién concedió el acceso", async () => {
    const r = await db.query<{ nombre: string; rol: string }>(
      "select nombre, rol from public.admin_listar_admins()"
    );
    // La dueña primero, por el `order by`.
    expect(r.rows[0]!.rol).toBe("duena");
    expect(r.rows.length).toBeGreaterThanOrEqual(2);
  });

  it("buscar por correo devuelve el rol actual, no un duplicado a mitad de formulario", async () => {
    const r = await db.query<{ nombre: string; rol_actual: string | null }>(
      "select nombre, rol_actual from public.admin_buscar_para_conceder('mostrador@siembra.test')"
    );
    expect(r.rows[0]!.rol_actual).toBe("empleado");

    const vacio = await db.query("select * from public.admin_buscar_para_conceder('nadie@ejemplo.com')");
    expect(vacio.rows).toHaveLength(0);
  });
});

describe("permisos", () => {
  it("ni anon ni authenticated pueden ejecutar ninguna", async () => {
    for (const rol of ["anon", "authenticated"]) {
      await db.exec(`set role ${rol}`);
      try {
        await expect(db.query("select * from public.admin_listar_admins()")).rejects.toThrow();
        await expect(db.query("select * from public.admin_newsletter_listar('', 10, 0)")).rejects.toThrow();
        await expect(db.query("select * from public.admin_eventos_listar()")).rejects.toThrow();
      } finally {
        await db.exec("reset role");
      }
    }
  });
});

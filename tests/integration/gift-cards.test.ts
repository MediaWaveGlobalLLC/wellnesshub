// @vitest-environment node
/**
 * Fase 5 — emisión y canje de gift cards (migración 0009).
 *
 * Las dos propiedades que sostienen todo el ciclo:
 *
 *  · el webhook es idempotente — Stripe reintenta, y un reintento no puede
 *    emitir una segunda tarjeta por el mismo pago;
 *  · el canje es atómico y de un solo uso — dos intentos con el mismo código
 *    acreditan una sola vez.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { comoUsuario, crearBase, crearUsuario, type Db } from "./supabase-harness";

let db: Db;
let comprador: string;
let receptor: string;

/** Hash cualquiera: la función SQL no genera el código, lo recibe ya hasheado. */
const HASH = "a".repeat(64);

beforeEach(async () => {
  db = await crearBase();
  comprador = await crearUsuario(db, { email: "compra@siembra.test" });
  receptor = await crearUsuario(db, { email: "recibe@siembra.test" });
});

afterEach(async () => {
  await db?.close();
});

async function crearPedido(sessionId = "cs_test_1", centavos = 5000) {
  const r = await db.query<{ id: string }>(
    `insert into public.gift_card_orders
       (purchaser_user_id, amount_cents, format, recipient_name, recipient_email,
        stripe_checkout_session_id)
     values ($1, $2, 'digital', 'Isa', 'isa@example.com', $3)
     returning id`,
    [comprador, centavos, sessionId]
  );
  return r.rows[0].id;
}

const emitir = (eventId: string, sessionId = "cs_test_1", hash = HASH) =>
  db.query<{ gift_card_id: string; amount_cents: string; ya_procesado: boolean }>(
    "select * from public.emitir_gift_card($1,$2,$3,$4,$5,$6)",
    [eventId, "checkout.session.completed", sessionId, "pi_test_1", hash, "WXYZ"]
  );

describe("emisión desde el webhook", () => {
  it("marca el pedido pagado y emite una tarjeta", async () => {
    await crearPedido();
    const r = await emitir("evt_1");

    expect(r.rows[0].ya_procesado).toBe(false);
    expect(Number(r.rows[0].amount_cents)).toBe(5000);

    const pedido = await db.query<{ status: string; paid_at: string | null }>(
      "select status, paid_at from public.gift_card_orders"
    );
    expect(pedido.rows[0].status).toBe("paid");
    expect(pedido.rows[0].paid_at).not.toBeNull();

    const tarjeta = await db.query<{ code_hash: string; code_last4: string; status: string }>(
      "select code_hash, code_last4, status from public.gift_cards"
    );
    expect(tarjeta.rows).toHaveLength(1);
    expect(tarjeta.rows[0].status).toBe("active");
    expect(tarjeta.rows[0].code_last4).toBe("WXYZ");
  });

  it("un evento repetido NO emite una segunda tarjeta", async () => {
    await crearPedido();

    const primera = await emitir("evt_repetido");
    const segunda = await emitir("evt_repetido");
    const tercera = await emitir("evt_repetido");

    expect(primera.rows[0].ya_procesado).toBe(false);
    expect(segunda.rows[0].ya_procesado).toBe(true);
    expect(tercera.rows[0].ya_procesado).toBe(true);
    // Siempre la misma tarjeta.
    expect(segunda.rows[0].gift_card_id).toBe(primera.rows[0].gift_card_id);

    const tarjetas = await db.query("select id from public.gift_cards");
    expect(tarjetas.rows).toHaveLength(1);
  });

  it("dos eventos distintos sobre el mismo pedido tampoco duplican", async () => {
    await crearPedido();
    await emitir("evt_a");
    const segundo = await emitir("evt_b");

    expect(segundo.rows[0].ya_procesado).toBe(true);
    const tarjetas = await db.query("select id from public.gift_cards");
    expect(tarjetas.rows).toHaveLength(1);
  });

  it("registra el evento como procesado", async () => {
    await crearPedido();
    await emitir("evt_log");
    const ev = await db.query<{ status: string; processed_at: string | null }>(
      "select status, processed_at from public.stripe_webhook_events"
    );
    expect(ev.rows[0].status).toBe("processed");
    expect(ev.rows[0].processed_at).not.toBeNull();
  });

  it("falla si no hay pedido para esa sesión", async () => {
    await expect(emitir("evt_huerfano", "cs_inexistente")).rejects.toThrow(
      /pedido_no_encontrado/
    );
  });

  it("deja rastro de la emisión en el audit log", async () => {
    await crearPedido();
    await emitir("evt_audit");
    const log = await db.query<{ action: string; entity_type: string }>(
      "select action, entity_type from public.audit_logs"
    );
    expect(log.rows[0]).toEqual({ action: "gift_card_issued", entity_type: "gift_card" });
  });
});

describe("canje", () => {
  async function tarjetaActiva(hash = HASH) {
    await crearPedido();
    await emitir("evt_para_canje", "cs_test_1", hash);
  }

  it("acredita el wallet de quien canjea, no del comprador", async () => {
    await tarjetaActiva();

    const r = await db.query<{ credited_cents: string; new_balance_cents: string }>(
      "select * from public.canjear_gift_card($1,$2)",
      [receptor, HASH]
    );
    expect(Number(r.rows[0].credited_cents)).toBe(5000);
    expect(Number(r.rows[0].new_balance_cents)).toBe(5000);

    const saldos = await db.query<{ user_id: string; balance_cents: string }>(
      "select user_id, balance_cents::text as balance_cents from public.wallets order by balance_cents"
    );
    const porUsuario = Object.fromEntries(saldos.rows.map((s) => [s.user_id, s.balance_cents]));
    expect(porUsuario[receptor]).toBe("5000");
    expect(porUsuario[comprador]).toBe("0");
  });

  it("marca la tarjeta como canjeada y por quién", async () => {
    await tarjetaActiva();
    await db.query("select * from public.canjear_gift_card($1,$2)", [receptor, HASH]);

    const c = await db.query<{ status: string; redeemed_by_user_id: string; redeemed_at: string }>(
      "select status, redeemed_by_user_id, redeemed_at from public.gift_cards"
    );
    expect(c.rows[0].status).toBe("redeemed");
    expect(c.rows[0].redeemed_by_user_id).toBe(receptor);
    expect(c.rows[0].redeemed_at).not.toBeNull();
  });

  it("un segundo canje falla y NO acredita de nuevo", async () => {
    await tarjetaActiva();
    await db.query("select * from public.canjear_gift_card($1,$2)", [receptor, HASH]);

    await expect(
      db.query("select * from public.canjear_gift_card($1,$2)", [receptor, HASH])
    ).rejects.toThrow(/ya_canjeada/);

    const saldo = await db.query<{ balance_cents: string }>(
      "select balance_cents::text as balance_cents from public.wallets where user_id = $1",
      [receptor]
    );
    expect(saldo.rows[0].balance_cents).toBe("5000");

    const movs = await db.query("select id from public.wallet_transactions where user_id = $1", [
      receptor,
    ]);
    expect(movs.rows).toHaveLength(1);
  });

  it("otra persona tampoco puede canjearla una segunda vez", async () => {
    await tarjetaActiva();
    await db.query("select * from public.canjear_gift_card($1,$2)", [receptor, HASH]);

    await expect(
      db.query("select * from public.canjear_gift_card($1,$2)", [comprador, HASH])
    ).rejects.toThrow(/ya_canjeada/);
  });

  it("rechaza un código que no existe", async () => {
    await expect(
      db.query("select * from public.canjear_gift_card($1,$2)", [receptor, "f".repeat(64)])
    ).rejects.toThrow(/codigo_invalido/);
  });

  it("rechaza una tarjeta cancelada", async () => {
    await tarjetaActiva();
    await db.query("update public.gift_cards set status = 'cancelled'");
    await expect(
      db.query("select * from public.canjear_gift_card($1,$2)", [receptor, HASH])
    ).rejects.toThrow(/cancelada/);
  });

  it("rechaza una tarjeta expirada sin acreditar nada", async () => {
    await tarjetaActiva();
    await db.query("update public.gift_cards set expires_at = now() - interval '1 day'");

    await expect(
      db.query("select * from public.canjear_gift_card($1,$2)", [receptor, HASH])
    ).rejects.toThrow(/expirada/);

    // La expiración se deriva de expires_at; no se guarda como estado (0009).
    const saldo = await db.query<{ balance_cents: string }>(
      "select balance_cents::text as balance_cents from public.wallets where user_id = $1",
      [receptor]
    );
    expect(saldo.rows[0].balance_cents).toBe("0");
  });

  it("una tarjeta con fecha futura sí se canjea", async () => {
    await tarjetaActiva();
    await db.query("update public.gift_cards set expires_at = now() + interval '30 days'");

    const r = await db.query<{ credited_cents: string }>(
      "select * from public.canjear_gift_card($1,$2)",
      [receptor, HASH]
    );
    expect(Number(r.rows[0].credited_cents)).toBe(5000);
  });

  it("el movimiento del ledger no revela el código, solo los últimos cuatro", async () => {
    await tarjetaActiva();
    await db.query("select * from public.canjear_gift_card($1,$2)", [receptor, HASH]);

    const mov = await db.query<{ description: string }>(
      "select description from public.wallet_transactions where user_id = $1",
      [receptor]
    );
    expect(mov.rows[0].description).toContain("WXYZ");
    expect(mov.rows[0].description).not.toContain(HASH);
  });
});

describe("aislamiento desde el navegador", () => {
  it("gift_cards es inalcanzable para un cliente autenticado", async () => {
    await crearPedido();
    await emitir("evt_rls");

    const visto = await comoUsuario(db, comprador, async () => {
      const r = await db.query("select id from public.gift_cards").catch(() => ({ rows: [] }));
      return r.rows;
    });
    expect(visto).toHaveLength(0);
  });

  it("el comprador ve su pedido pero no el de otro", async () => {
    await crearPedido("cs_mio");
    await db.query(
      `insert into public.gift_card_orders
         (purchaser_user_id, amount_cents, format, recipient_name, stripe_checkout_session_id)
       values ($1, 2500, 'digital', 'Otro', 'cs_ajeno')`,
      [receptor]
    );

    const vistos = await comoUsuario(db, comprador, async () => {
      const r = await db.query<{ stripe_checkout_session_id: string }>(
        "select stripe_checkout_session_id from public.gift_card_orders"
      );
      return r.rows.map((x) => x.stripe_checkout_session_id);
    });
    expect(vistos).toEqual(["cs_mio"]);
  });
});

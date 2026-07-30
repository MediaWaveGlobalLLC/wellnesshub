// @vitest-environment node
/**
 * Gates 2 y 3 de docs/07 contra un Postgres real.
 *
 * Cubre las invariantes de docs/04 (wallet, puntos, ledger) y las políticas RLS
 * de docs/06. Cada prueba arranca con una base limpia: sin estado compartido,
 * el orden no importa.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bonoBienvenida, comoUsuario, crearBase, crearUsuario, type Db } from "./supabase-harness";

let db: Db;

beforeEach(async () => {
  db = await crearBase();
});

// Cerrar la instancia entre pruebas. Sin esto quedan 21 Postgres en WASM vivos
// en el mismo proceso y las lecturas empiezan a devolver datos de otra base.
afterEach(async () => {
  await db?.close();
});

describe("alta de usuario — trigger handle_new_user", () => {
  it("crea perfil, wallet y cuenta de lealtad en una sola inserción", async () => {
    const id = await crearUsuario(db, {
      email: "valeria@example.com",
      firstName: "Valeria",
      lastName: "Ramos",
      phone: "+19398350044",
    });

    const perfil = await db.query<{ first_name: string; last_name: string; phone: string }>(
      "select first_name, last_name, phone from public.profiles where id = $1",
      [id]
    );
    expect(perfil.rows).toHaveLength(1);
    expect(perfil.rows[0].first_name).toBe("Valeria");
    expect(perfil.rows[0].phone).toBe("+19398350044");
  });

  it("el CRÉDITO nace en cero — nunca dinero de regalo implícito", async () => {
    /*
      El crédito y los puntos dejan de comportarse igual a partir de `0018`.

      El crédito es DINERO: sigue naciendo en cero, y no hay ninguna ruta que lo
      regale al registrarse. Los puntos no son dinero (`docs/00`), y el bono de
      bienvenida —una regla del Brand Book que llevaba desde `0005` sembrada sin
      que nadie la aplicara— sí se otorga en el alta.

      El bono se LEE de la tabla en vez de escribirlo aquí: es configurable
      desde el panel, y este test no puede romperse porque el negocio lo suba.
    */
    const id = await crearUsuario(db, { email: "cero@example.com" });

    const wallet = await db.query<{ balance_cents: bigint; currency: string }>(
      "select balance_cents, currency from public.wallets where user_id = $1",
      [id]
    );
    expect(Number(wallet.rows[0].balance_cents)).toBe(0);
    expect(wallet.rows[0].currency).toBe("USD");

    const lealtad = await db.query<{ points_balance: bigint }>(
      "select points_balance from public.loyalty_accounts where user_id = $1",
      [id]
    );
    expect(Number(lealtad.rows[0].points_balance)).toBe(await bonoBienvenida(db));

    // El nivel se deriva, no se guarda (migración 0006).
    const nivel = await db.query<{ tier: string }>(
      "select tier from public.loyalty_accounts_con_nivel where user_id = $1",
      [id]
    );
    expect(nivel.rows[0].tier).toBe("semilla");
  });

  it("asigna un member_id con el prefijo de marca y único por usuario", async () => {
    const a = await crearUsuario(db, { email: "a@example.com" });
    const b = await crearUsuario(db, { email: "b@example.com" });

    const r = await db.query<{ member_id: string }>(
      "select member_id from public.profiles where id in ($1, $2)",
      [a, b]
    );
    const ids = r.rows.map((x) => x.member_id);
    expect(ids).toHaveLength(2);
    // Formato del mockup 02: SMB- + seis dígitos, dictable en caja (migración 0003).
    for (const m of ids) expect(m).toMatch(/^SMB-\d{6}$/);
    expect(new Set(ids).size).toBe(2);
  });

  it("guarda el consentimiento de marketing del formulario (migración 0002)", async () => {
    const si = await crearUsuario(db, { email: "si@example.com", marketingOptIn: true });
    const no = await crearUsuario(db, { email: "no@example.com", marketingOptIn: false });

    const r = await db.query<{ id: string; marketing_email_opt_in: boolean }>(
      "select id, marketing_email_opt_in from public.profiles where id in ($1, $2)",
      [si, no]
    );
    const porId = Object.fromEntries(r.rows.map((x) => [x.id, x.marketing_email_opt_in]));
    expect(porId[si]).toBe(true);
    expect(porId[no]).toBe(false);
  });
});

describe("columnas de identidad protegidas (migraciones 0002 y 0004)", () => {
  it("ignora el intento de un usuario de cambiar su member_id", async () => {
    const id = await crearUsuario(db, { email: "id@example.com" });
    const antes = await db.query<{ member_id: string }>(
      "select member_id from public.profiles where id = $1",
      [id]
    );

    await comoUsuario(db, id, async () => {
      await db
        .query("update public.profiles set member_id = 'SMB-999999' where id = $1", [id])
        .catch(() => undefined);
    });

    const despues = await db.query<{ member_id: string }>(
      "select member_id from public.profiles where id = $1",
      [id]
    );
    expect(despues.rows[0].member_id).toBe(antes.rows[0].member_id);
  });

  /*
   * Regresión: la primera versión del trigger restauraba las columnas en
   * CUALQUIER update, así que revertía también el mantenimiento del servidor.
   * El backfill de member_id de 0003 se ejecutó sin error y sin efecto.
   */
  it("deja que el servidor sí actualice columnas de identidad", async () => {
    const id = await crearUsuario(db, { email: "srv@example.com" });

    await db.query("update public.profiles set member_id = 'SMB-000042' where id = $1", [id]);

    const r = await db.query<{ member_id: string }>(
      "select member_id from public.profiles where id = $1",
      [id]
    );
    expect(r.rows[0].member_id).toBe("SMB-000042");
  });

  it("sigue refrescando updated_at en cada cambio", async () => {
    const id = await crearUsuario(db, { email: "upd@example.com" });
    const antes = await db.query<{ updated_at: string }>(
      "select updated_at from public.profiles where id = $1",
      [id]
    );

    await db.query("update public.profiles set first_name = 'Nuevo' where id = $1", [id]);

    const despues = await db.query<{ updated_at: string }>(
      "select updated_at from public.profiles where id = $1",
      [id]
    );
    expect(new Date(despues.rows[0].updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(antes.rows[0].updated_at).getTime()
    );
  });
});

describe("ledger del wallet — invariantes de docs/04", () => {
  it("acredita y deja rastro con el balance resultante", async () => {
    const id = await crearUsuario(db, { email: "w@example.com" });

    const r = await db.query<{ new_balance_cents: bigint }>(
      "select * from public.apply_wallet_transaction($1, $2, $3, $4)",
      [id, 5000, "gift_card_redemption", "clave-1"]
    );
    expect(Number(r.rows[0].new_balance_cents)).toBe(5000);

    const mov = await db.query<{ amount_cents: bigint; balance_after_cents: bigint }>(
      "select amount_cents, balance_after_cents from public.wallet_transactions where user_id = $1",
      [id]
    );
    expect(mov.rows).toHaveLength(1);
    expect(Number(mov.rows[0].amount_cents)).toBe(5000);
    expect(Number(mov.rows[0].balance_after_cents)).toBe(5000);
  });

  it("es idempotente: repetir la misma clave no duplica el crédito", async () => {
    const id = await crearUsuario(db, { email: "idem@example.com" });

    for (let i = 0; i < 3; i++) {
      await db.query("select * from public.apply_wallet_transaction($1, $2, $3, $4)", [
        id,
        2500,
        "gift_card_redemption",
        "webhook-evt-repetido",
      ]);
    }

    const saldo = await db.query<{ balance_cents: bigint }>(
      "select balance_cents from public.wallets where user_id = $1",
      [id]
    );
    expect(Number(saldo.rows[0].balance_cents)).toBe(2500);

    const movs = await db.query("select 1 from public.wallet_transactions where user_id = $1", [id]);
    expect(movs.rows).toHaveLength(1);
  });

  it("rechaza dejar el saldo en negativo", async () => {
    const id = await crearUsuario(db, { email: "neg@example.com" });
    await db.query("select * from public.apply_wallet_transaction($1, $2, $3, $4)", [
      id,
      1000,
      "gift_card_redemption",
      "carga",
    ]);

    await expect(
      db.query("select * from public.apply_wallet_transaction($1, $2, $3, $4)", [
        id,
        -1500,
        "purchase",
        "gasto-excesivo",
      ])
    ).rejects.toThrow(/insufficient_wallet_balance/);

    const saldo = await db.query<{ balance_cents: bigint }>(
      "select balance_cents from public.wallets where user_id = $1",
      [id]
    );
    expect(Number(saldo.rows[0].balance_cents)).toBe(1000);
  });

  it("rechaza movimientos de importe cero", async () => {
    const id = await crearUsuario(db, { email: "zero@example.com" });
    await expect(
      db.query("select * from public.apply_wallet_transaction($1, $2, $3, $4)", [
        id,
        0,
        "correction",
        "nada",
      ])
    ).rejects.toThrow(/amount_must_be_nonzero/);
  });
});

describe("ledger de puntos", () => {
  it("suma puntos sin tocar el saldo monetario — son sistemas separados", async () => {
    const id = await crearUsuario(db, { email: "pts@example.com" });
    const bono = await bonoBienvenida(db);

    await db.query("select * from public.apply_loyalty_transaction($1, $2, $3, $4)", [
      id,
      750,
      "earn",
      "compra-1",
    ]);

    const pts = await db.query<{ points_balance: bigint }>(
      "select points_balance from public.loyalty_accounts where user_id = $1",
      [id]
    );
    // Lo que importa es que sumó 750 sobre lo que había, no la cifra final.
    expect(Number(pts.rows[0].points_balance)).toBe(bono + 750);

    const wallet = await db.query<{ balance_cents: bigint }>(
      "select balance_cents from public.wallets where user_id = $1",
      [id]
    );
    expect(Number(wallet.rows[0].balance_cents)).toBe(0);
  });

  it("rechaza dejar los puntos en negativo", async () => {
    const id = await crearUsuario(db, { email: "ptsneg@example.com" });
    // Un punto más de lo que tiene: con el bono de bienvenida, restar cien ya
    // no bastaba para llegar a negativo y el test pasaba sin probar nada.
    const bono = await bonoBienvenida(db);

    await expect(
      db.query("select * from public.apply_loyalty_transaction($1, $2, $3, $4)", [
        id,
        -(bono + 1),
        "redeem",
        "canje-sin-saldo",
      ])
    ).rejects.toThrow(/insufficient_points/);
  });
});

describe("RLS — aislamiento entre usuarios (Gate 3)", () => {
  it("un usuario solo ve su propio perfil", async () => {
    const a = await crearUsuario(db, { email: "a@example.com", firstName: "Ana" });
    await crearUsuario(db, { email: "b@example.com", firstName: "Bruno" });

    const visibles = await comoUsuario(db, a, async () => {
      const r = await db.query<{ first_name: string }>("select first_name from public.profiles");
      return r.rows;
    });

    expect(visibles).toHaveLength(1);
    expect(visibles[0].first_name).toBe("Ana");
  });

  it("un usuario no puede leer el wallet ajeno", async () => {
    const a = await crearUsuario(db, { email: "a@example.com" });
    const b = await crearUsuario(db, { email: "b@example.com" });
    await db.query("select * from public.apply_wallet_transaction($1, $2, $3, $4)", [
      b,
      9999,
      "promotion",
      "saldo-de-b",
    ]);

    const filas = await comoUsuario(db, a, async () => {
      const r = await db.query("select user_id from public.wallets where user_id = $1", [b]);
      return r.rows;
    });

    expect(filas).toHaveLength(0);
  });

  it("un usuario no puede leer los movimientos ajenos", async () => {
    const a = await crearUsuario(db, { email: "a@example.com" });
    const b = await crearUsuario(db, { email: "b@example.com" });
    await db.query("select * from public.apply_wallet_transaction($1, $2, $3, $4)", [
      b,
      4000,
      "promotion",
      "mov-de-b",
    ]);

    const filas = await comoUsuario(db, a, async () => {
      const r = await db.query("select id from public.wallet_transactions");
      return r.rows;
    });

    expect(filas).toHaveLength(0);
  });

  it("nadie autenticado puede leer gift_cards ni audit_logs", async () => {
    const a = await crearUsuario(db, { email: "a@example.com" });

    await comoUsuario(db, a, async () => {
      // Sin política de SELECT, RLS deniega por defecto.
      for (const tabla of ["public.gift_cards", "public.audit_logs", "public.stripe_webhook_events"]) {
        const r = await db.query(`select 1 from ${tabla}`).catch(() => ({ rows: [] }));
        expect(r.rows).toHaveLength(0);
      }
    });
  });

  it("un usuario no puede escribir su propio saldo a mano", async () => {
    const a = await crearUsuario(db, { email: "a@example.com" });

    await comoUsuario(db, a, async () => {
      await db
        .query("update public.wallets set balance_cents = 999999 where user_id = $1", [a])
        .catch(() => undefined);
    });

    const saldo = await db.query<{ balance_cents: bigint }>(
      "select balance_cents from public.wallets where user_id = $1",
      [a]
    );
    expect(Number(saldo.rows[0].balance_cents)).toBe(0);
  });

  it("todas las tablas expuestas tienen RLS activado", async () => {
    const r = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'`
    );
    expect(r.rows.length).toBeGreaterThan(0);
    const sinRls = r.rows.filter((t) => !t.relrowsecurity).map((t) => t.relname);
    expect(sinRls).toEqual([]);
  });
});

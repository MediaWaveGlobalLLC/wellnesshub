// @vitest-environment node
/**
 * Fase 4 — ajustes administrativos (migración 0008).
 *
 * Lo que se verifica: que solo un administrador pueda ajustar, que el motivo
 * sea obligatorio, que cada ajuste deje rastro auditable con el antes y el
 * después, y que repetir la misma referencia no duplique el movimiento.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  bonoBienvenida,
  comoUsuario,
  crearBase,
  crearUsuario,
  type Db,
} from "./supabase-harness";

let db: Db;
let admin: string;
let cliente: string;

beforeEach(async () => {
  db = await crearBase();
  admin = await crearUsuario(db, { email: "admin@siembra.test", firstName: "Isa" });
  cliente = await crearUsuario(db, { email: "cliente@siembra.test", firstName: "Valeria" });
  await db.query("insert into public.admin_users (user_id) values ($1)", [admin]);
});

afterEach(async () => {
  await db?.close();
});

const ajustarWallet = (actor: string, target: string, centavos: number, motivo: string, ref?: string) =>
  db.query<{ transaction_id: string; new_balance_cents: string }>(
    "select * from public.admin_ajustar_wallet($1,$2,$3,$4,$5,$6)",
    [actor, target, centavos, motivo, ref ?? null, "req-test"]
  );

describe("autorización", () => {
  it("rechaza a quien no está en admin_users", async () => {
    await expect(
      ajustarWallet(cliente, cliente, 1000, "Intento de auto-regalo")
    ).rejects.toThrow(/no_autorizado/);
  });

  it("un cliente no puede leer quién es administrador", async () => {
    const visto = await comoUsuario(db, cliente, async () => {
      const r = await db.query("select user_id from public.admin_users").catch(() => ({ rows: [] }));
      return r.rows;
    });
    expect(visto).toHaveLength(0);
  });

  it("un cliente no puede darse permisos a sí mismo", async () => {
    await comoUsuario(db, cliente, async () => {
      await expect(
        db.query("insert into public.admin_users (user_id) values ($1)", [cliente])
      ).rejects.toThrow();
    });
  });
});

describe("motivo obligatorio", () => {
  it.each([["vacío", ""], ["solo espacios", "   "]])(
    "rechaza un motivo %s",
    async (_caso, motivo) => {
      await expect(ajustarWallet(admin, cliente, 1000, motivo)).rejects.toThrow(
        /motivo_obligatorio/
      );
    }
  );

  it("no deja rastro ni movimiento cuando el motivo falta", async () => {
    await ajustarWallet(admin, cliente, 1000, "").catch(() => undefined);

    const movs = await db.query("select id from public.wallet_transactions");
    const logs = await db.query("select id from public.audit_logs");
    expect(movs.rows).toHaveLength(0);
    expect(logs.rows).toHaveLength(0);
  });
});

describe("ajuste de saldo", () => {
  it("acredita y deja el audit log con el antes y el después", async () => {
    const r = await ajustarWallet(admin, cliente, 2500, "Crédito de servicio al cliente", "TICKET-1");
    expect(Number(r.rows[0].new_balance_cents)).toBe(2500);

    const log = await db.query<{
      action: string;
      reason: string;
      before_data: Record<string, number>;
      after_data: Record<string, number>;
      actor_user_id: string;
      target_user_id: string;
      request_id: string;
    }>("select * from public.audit_logs");

    expect(log.rows).toHaveLength(1);
    const l = log.rows[0];
    expect(l.action).toBe("wallet_adjustment");
    expect(l.reason).toBe("Crédito de servicio al cliente");
    expect(l.actor_user_id).toBe(admin);
    expect(l.target_user_id).toBe(cliente);
    expect(l.request_id).toBe("req-test");
    expect(Number(l.before_data.balance_cents)).toBe(0);
    expect(Number(l.after_data.balance_cents)).toBe(2500);
    expect(Number(l.after_data.amount_cents)).toBe(2500);
  });

  it("repetir la misma referencia no duplica el ajuste", async () => {
    for (let i = 0; i < 3; i++) {
      await ajustarWallet(admin, cliente, 2500, "Reintento del mismo ticket", "TICKET-REPE");
    }

    const saldo = await db.query<{ balance_cents: bigint }>(
      "select balance_cents from public.wallets where user_id = $1",
      [cliente]
    );
    expect(Number(saldo.rows[0].balance_cents)).toBe(2500);

    const movs = await db.query("select id from public.wallet_transactions");
    expect(movs.rows).toHaveLength(1);
  });

  it("rechaza dejar el saldo en negativo y no escribe nada", async () => {
    await ajustarWallet(admin, cliente, 1000, "Carga inicial", "T1");

    await expect(
      ajustarWallet(admin, cliente, -5000, "Retirada excesiva", "T2")
    ).rejects.toThrow(/insufficient_wallet_balance/);

    const saldo = await db.query<{ balance_cents: bigint }>(
      "select balance_cents from public.wallets where user_id = $1",
      [cliente]
    );
    expect(Number(saldo.rows[0].balance_cents)).toBe(1000);

    // El ajuste fallido no deja audit log: la transacción entera se deshace.
    const logs = await db.query("select id from public.audit_logs");
    expect(logs.rows).toHaveLength(1);
  });

  it("el motivo se guarda también en el propio movimiento del ledger", async () => {
    await ajustarWallet(admin, cliente, 700, "Compensación por pedido demorado", "T9");
    const mov = await db.query<{ description: string; transaction_type: string }>(
      "select description, transaction_type from public.wallet_transactions"
    );
    expect(mov.rows[0].description).toBe("Compensación por pedido demorado");
    expect(mov.rows[0].transaction_type).toBe("admin_adjustment");
  });
});

describe("ajuste de puntos", () => {
  it("suma puntos sin tocar el saldo monetario", async () => {
    await db.query("select * from public.admin_ajustar_puntos($1,$2,$3,$4,$5,$6)", [
      admin,
      cliente,
      500,
      "Bono de disculpa",
      "T-PTS",
      "req-test",
    ]);

    const r = await db.query<{ puntos: string; centavos: string }>(
      `select l.points_balance::text as puntos, w.balance_cents::text as centavos
         from public.loyalty_accounts l
         join public.wallets w on w.user_id = l.user_id
        where l.user_id = $1`,
      [cliente]
    );
    // Los 500 se suman SOBRE el bono de bienvenida (`0018`), y el crédito no se
    // mueve: es la separación entre puntos y dinero lo que se está probando.
    expect(r.rows[0]).toEqual({
      puntos: String((await bonoBienvenida(db)) + 500),
      centavos: "0",
    });
  });

  it("registra la acción como points_adjustment", async () => {
    await db.query("select * from public.admin_ajustar_puntos($1,$2,$3,$4,$5,$6)", [
      admin,
      cliente,
      100,
      "Corrección de conteo",
      "T-PTS-2",
      "req-test",
    ]);
    const log = await db.query<{ action: string; entity_type: string }>(
      "select action, entity_type from public.audit_logs"
    );
    expect(log.rows[0]).toEqual({ action: "points_adjustment", entity_type: "loyalty_account" });
  });

  it("rechaza dejar los puntos en negativo", async () => {
    // Un punto más de lo que tiene. Con el bono de bienvenida, restar cien ya
    // no llegaba a negativo y este test pasaba sin probar nada.
    const excesivo = -((await bonoBienvenida(db)) + 1);

    await expect(
      db.query("select * from public.admin_ajustar_puntos($1,$2,$3,$4,$5,$6)", [
        admin,
        cliente,
        excesivo,
        "Resta sin saldo",
        "T-NEG",
        "req-test",
      ])
    ).rejects.toThrow(/insufficient_points/);
  });
});

describe("audit_logs", () => {
  it("es inalcanzable desde el navegador", async () => {
    await ajustarWallet(admin, cliente, 500, "Movimiento de prueba", "T-AUDIT");

    for (const usuario of [cliente, admin]) {
      const visto = await comoUsuario(db, usuario, async () => {
        const r = await db.query("select id from public.audit_logs").catch(() => ({ rows: [] }));
        return r.rows;
      });
      expect(visto).toHaveLength(0);
    }
  });
});

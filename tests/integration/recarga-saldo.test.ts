// @vitest-environment node
/**
 * Recarga de saldo y café de bienvenida (migración 0024).
 *
 * Esto mueve DINERO, así que lo que se prueba no es que funcione una vez: es
 * que no acredite dos veces cuando Stripe reintenta el webhook —lo hace—, que
 * el café se dé una sola vez y solo a partir de $20, y que un regalo que falla
 * no se lleve por delante la recarga que la persona sí pagó.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { crearBase, crearUsuario, leerFresco, type Db } from "./supabase-harness";

let db: Db;
let cliente: string;

beforeAll(async () => {
  db = await crearBase();
  cliente = await crearUsuario(db, { email: "recarga@siembra.test", firstName: "Ana" });
}, 120_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec(`
    delete from public.loyalty_redemptions;
    delete from public.wallet_topups;
    delete from public.wallet_transactions;
    delete from public.stripe_webhook_events;
    delete from public.audit_logs;
    update public.wallets set balance_cents = 0;
  `);
  /*
    La recompensa del café, repuesta tal como la deja la migración.

    Un `update` no bastaba: el test que comprueba qué pasa cuando falta la
    recompensa la BORRA, y a partir de ahí el update no encontraba fila que
    tocar. El siguiente test fallaba por el estado que dejó el anterior, no por
    el código.
  */
  await db.exec(`
    delete from public.loyalty_rewards where clave = 'cafe_bienvenida';
    insert into public.loyalty_rewards (clave, nombre, descripcion, costo_puntos, activa, orden)
    values ('cafe_bienvenida', 'Café de bienvenida',
            'Un café de la casa, por tu primera recarga de $20 o más.', 1, false, 999);
  `);
});

/** Crea la recarga y le ata una sesión de Stripe, como hace el servicio. */
async function prepararRecarga(centavos: number, sesion: string): Promise<string> {
  const r = await db.query<{ recarga_id: string }>(
    "select recarga_id from public.crear_recarga($1, $2)",
    [cliente, centavos]
  );
  const id = r.rows[0]!.recarga_id;
  await db.query("select * from public.atar_sesion_recarga($1, $2, $3)", [cliente, id, sesion]);
  return id;
}

const confirmar = (evento: string, sesion: string) =>
  db.query<{ saldo_cents: string; ya_procesado: boolean; cafe_otorgado: boolean }>(
    "select saldo_cents, ya_procesado, cafe_otorgado from public.confirmar_recarga($1, 'checkout.session.completed', $2, 'pi_x')",
    [evento, sesion]
  );

async function saldo(): Promise<number> {
  const r = await leerFresco<{ balance_cents: string }>(
    db, "select balance_cents from public.wallets where user_id = $1", [cliente]
  );
  return Number(r[0]!.balance_cents);
}

describe("crear la recarga", () => {
  it("no toca el saldo: solo prepara la fila", async () => {
    await prepararRecarga(2000, "cs_1");
    expect(await saldo()).toBe(0);

    const r = await leerFresco<{ status: string }>(
      db, "select status from public.wallet_topups where user_id = $1", [cliente]
    );
    expect(r[0]!.status).toBe("pendiente");
  });

  it("rechaza importes fuera de rango", async () => {
    // Por debajo de $5 la comisión se come la recarga; por encima de $500 deja
    // de parecer un saldo de cafetería y empieza a parecer un dedo torpe.
    for (const centavos of [100, 60000, 0]) {
      await expect(
        db.query("select * from public.crear_recarga($1, $2)", [cliente, centavos])
      ).rejects.toThrow(/importe_invalido/);
    }
  });

  it("la persona NO puede crear ni modificar su recarga desde el navegador", async () => {
    /*
      Si pudiera insertarla, elegiría el importe; si pudiera actualizarla, se
      pondría 'pagada' sola. Solo hay política de SELECT.
    */
    await prepararRecarga(2000, "cs_rls");

    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claims', $1, false)", [
      JSON.stringify({ sub: cliente, role: "authenticated" }),
    ]);
    try {
      await expect(
        db.query("insert into public.wallet_topups (user_id, amount_cents) values ($1, 50000)", [cliente])
      ).rejects.toThrow();

      const tras = await db.query(
        "update public.wallet_topups set status = 'pagada' where user_id = $1 returning id",
        [cliente]
      );
      expect(tras.rows).toHaveLength(0);

      // Ver la suya sí.
      const vistas = await db.query("select id from public.wallet_topups");
      expect(vistas.rows).toHaveLength(1);
    } finally {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claims', '', false)");
    }
  });
});

describe("confirmar el pago", () => {
  it("acredita el saldo una sola vez aunque Stripe reintente", async () => {
    /*
      El caso que justifica toda la idempotencia. Stripe reintenta los webhooks
      ante cualquier respuesta que no sea 2xx, y también por su cuenta. Sin
      esto, un reintento duplica dinero.
    */
    await prepararRecarga(2000, "cs_2");

    const primera = await confirmar("evt_1", "cs_2");
    expect(Number(primera.rows[0]!.saldo_cents)).toBe(2000);
    expect(primera.rows[0]!.ya_procesado).toBe(false);

    const reintento = await confirmar("evt_1", "cs_2");
    expect(reintento.rows[0]!.ya_procesado).toBe(true);
    expect(await saldo()).toBe(2000);

    // Y un evento DISTINTO sobre la misma sesión tampoco: la recarga ya está
    // pagada. Pasa de verdad cuando llegan `completed` y `async_payment_succeeded`.
    const otroEvento = await confirmar("evt_2", "cs_2");
    expect(otroEvento.rows[0]!.ya_procesado).toBe(true);
    expect(await saldo()).toBe(2000);

    const movimientos = await leerFresco<{ n: string }>(
      db, "select count(*)::text as n from public.wallet_transactions where user_id = $1", [cliente]
    );
    expect(Number(movimientos[0]!.n)).toBe(1);
  });

  it("una sesión que no existe no acredita nada", async () => {
    await expect(confirmar("evt_x", "cs_inventada")).rejects.toThrow(/recarga_no_encontrada/);
    expect(await saldo()).toBe(0);
  });

  it("dos recargas suman", async () => {
    await prepararRecarga(2000, "cs_a");
    await confirmar("evt_a", "cs_a");
    await prepararRecarga(5000, "cs_b");
    await confirmar("evt_b", "cs_b");
    expect(await saldo()).toBe(7000);
  });
});

describe("café de bienvenida — promoción RETIRADA", () => {
  /*
    Hasta `0025_sin_cafe_bienvenida.sql` la primera recarga de $20 o más
    regalaba un café. La dueña la retiró el 1 de agosto de 2026.

    Estas pruebas eran las que garantizaban que el café se daba; ahora
    garantizan lo contrario, y sobre todo la parte delicada: que retirar la
    promoción no le quita nada a quien YA la tenía.
  */
  async function cafes(): Promise<number> {
    const r = await leerFresco<{ n: string }>(
      db,
      "select count(*)::text as n from public.loyalty_redemptions where user_id = $1 and origen = 'promocion'",
      [cliente]
    );
    return Number(r[0]!.n);
  }

  it("la primera recarga de $20 ya NO da café", async () => {
    await prepararRecarga(2000, "cs_c1");
    const r = await confirmar("evt_c1", "cs_c1");

    expect(r.rows[0]!.cafe_otorgado).toBe(false);
    // Ni café, ni fila de canje: la promoción no deja rastro nuevo.
    expect(await cafes()).toBe(0);
  });

  it("el saldo entra igual, que es lo único que la persona pagó", async () => {
    await prepararRecarga(2000, "cs_c2");
    const r = await confirmar("evt_c2", "cs_c2");

    expect(Number(r.rows[0]!.saldo_cents)).toBe(2000);
    expect(await saldo()).toBe(2000);
  });

  it("ninguna recarga da café, sea del importe que sea", async () => {
    for (const [i, importe] of [1500, 2000, 10000, 5000].entries()) {
      await prepararRecarga(importe, `cs_d${i}`);
      expect(
        (await confirmar(`evt_d${i}`, `cs_d${i}`)).rows[0]!.cafe_otorgado,
        `recarga de ${importe}`
      ).toBe(false);
    }
    expect(await cafes()).toBe(0);
  });

  it("NO toca los cafés que ya se habían entregado", async () => {
    /*
      La parte que importa de verdad.

      Cada código emitido es un café que alguien ya se ganó con una recarga ya
      pagada. Retirar una promoción es dejar de darla, no quitársela a quien la
      tiene: si esta prueba se pone en rojo, alguien está a punto de invalidar
      cafés de gente real que se enteraría en el mostrador.
    */
    const recompensa = await leerFresco<{ id: string }>(
      db, "select id from public.loyalty_rewards where clave = 'cafe_bienvenida'"
    );
    await db.query(
      `insert into public.loyalty_redemptions
         (user_id, reward_id, nombre, costo_puntos, codigo, estado, origen)
       values ($1, $2, 'Café de bienvenida', 0, 'RC-VIEJO', 'pendiente', 'promocion')`,
      [cliente, recompensa[0]!.id]
    );

    await prepararRecarga(2000, "cs_e1");
    await confirmar("evt_e1", "cs_e1");

    const vivo = await leerFresco<{ estado: string }>(
      db, "select estado from public.loyalty_redemptions where codigo = 'RC-VIEJO'"
    );
    expect(vivo).toHaveLength(1);
    expect(vivo[0]!.estado).toBe("pendiente");
    // Y sigue siendo el único: la recarga nueva no añadió otro.
    expect(await cafes()).toBe(1);
  });

  it("la recompensa sigue existiendo, y sigue fuera del catálogo", async () => {
    /*
      No se borra la fila aunque ya no se otorgue. Los canjes emitidos la
      apuntan por clave foránea y borrarla los rompería; y `activa = false`
      es lo que la mantiene fuera de «canjea tus puntos», donde nunca estuvo.
    */
    const r = await leerFresco<{ activa: boolean }>(
      db, "select activa from public.loyalty_rewards where clave = 'cafe_bienvenida'"
    );
    expect(r).toHaveLength(1);
    expect(r[0]!.activa).toBe(false);
  });
});

describe("permisos", () => {
  it("ni anon ni authenticated confirman una recarga", async () => {
    for (const rol of ["anon", "authenticated"]) {
      await db.exec(`set role ${rol}`);
      try {
        await expect(
          db.query("select * from public.confirmar_recarga('e','t','s','p')")
        ).rejects.toThrow();
        await expect(
          db.query("select * from public.crear_recarga($1, 2000)", [cliente])
        ).rejects.toThrow();
      } finally {
        await db.exec("reset role");
      }
    }
  });
});

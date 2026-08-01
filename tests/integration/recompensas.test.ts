// @vitest-environment node
/**
 * Canje de recompensas (migración 0020).
 *
 * Los puntos se podían ganar desde la Fase 3 y no se podían gastar en nada. Lo
 * que se prueba aquí no es que el canje «funcione», sino las cuatro formas de
 * que descuadre:
 *
 *  · que descuente puntos sin entregar canje, o al revés;
 *  · que un reintento cobre dos veces;
 *  · que dos personas se lleven la última unidad;
 *  · que editar el catálogo reescriba el pasado de alguien.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { crearBase, crearUsuario, leerFresco, type Db } from "./supabase-harness";

let db: Db;
let duena: string;
let empleado: string;
let ana: string;
let beto: string;

beforeAll(async () => {
  db = await crearBase();

  duena = await crearUsuario(db, { email: "duena@siembra.test", firstName: "Erika" });
  empleado = await crearUsuario(db, { email: "barra@siembra.test", firstName: "Barra" });
  ana = await crearUsuario(db, { email: "ana@siembra.test", firstName: "Ana" });
  beto = await crearUsuario(db, { email: "beto@siembra.test", firstName: "Beto" });

  await db.query("insert into public.admin_users (user_id, rol) values ($1, 'duena')", [duena]);
  await db.query("insert into public.admin_users (user_id, rol) values ($1, 'empleado')", [empleado]);
}, 120_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec(`
    delete from public.loyalty_redemptions;
    delete from public.loyalty_rewards;
    delete from public.loyalty_transactions;
    delete from public.loyalty_accounts;
    delete from public.audit_logs;
  `);
});

/** Una recompensa con lo mínimo. `existencias` null = sin límite. */
async function crearRecompensa(
  costo = 500,
  opciones: { existencias?: number | null; activa?: boolean; nombre?: string } = {}
): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into public.loyalty_rewards (nombre, costo_puntos, existencias, activa)
     values ($1, $2, $3, $4) returning id`,
    [opciones.nombre ?? "Bebida gratis", costo, opciones.existencias ?? null, opciones.activa ?? true]
  );
  return r.rows[0]!.id;
}

/** Puntos por la puerta normal: el ledger, no un update a mano. */
async function darPuntos(userId: string, puntos: number, clave = `semilla-${userId}-${puntos}`) {
  await db.query("select * from public.apply_loyalty_transaction($1,$2,'promotion',$3)", [
    userId,
    puntos,
    clave,
  ]);
}

const canjear = (userId: string, rewardId: string, intento: string | null = null) =>
  db.query<{
    redemption_id: string;
    codigo: string;
    nombre: string;
    costo_puntos: string;
    puntos_restantes: string;
  }>("select * from public.canjear_recompensa($1,$2,$3)", [userId, rewardId, intento]);

const saldoPuntos = async (userId: string): Promise<number> => {
  const r = await leerFresco<{ points_balance: string }>(
    db,
    "select points_balance from public.loyalty_accounts where user_id = $1",
    [userId]
  );
  return Number(r[0]?.points_balance ?? 0);
};

describe("canje", () => {
  it("descuenta los puntos y entrega un código", async () => {
    const id = await crearRecompensa(500);
    await darPuntos(ana, 800);

    const r = await canjear(ana, id);
    const fila = r.rows[0]!;

    expect(Number(fila.costo_puntos)).toBe(500);
    expect(Number(fila.puntos_restantes)).toBe(300);
    // Alfabeto sin I, O, 1 ni 0: se dicta en voz alta en una barra con ruido.
    expect(fila.codigo).toMatch(/^RC-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);

    expect(await saldoPuntos(ana)).toBe(300);

    const canje = await leerFresco<{ estado: string; nombre: string; costo_puntos: string }>(
      db,
      "select estado, nombre, costo_puntos from public.loyalty_redemptions"
    );
    expect(canje[0]!.estado).toBe("pendiente");
    expect(canje[0]!.nombre).toBe("Bebida gratis");
  });

  it("el movimiento del ledger cuadra con lo que se canjeó", async () => {
    const id = await crearRecompensa(500);
    await darPuntos(ana, 500);
    await canjear(ana, id);

    const mov = await leerFresco<{ points: string; transaction_type: string }>(
      db,
      "select points, transaction_type from public.loyalty_transactions where transaction_type = 'redeem'"
    );
    expect(mov).toHaveLength(1);
    expect(Number(mov[0]!.points)).toBe(-500);
  });

  it("sin puntos suficientes no pasa nada de nada", async () => {
    const id = await crearRecompensa(500);
    await darPuntos(ana, 499);

    await expect(canjear(ana, id)).rejects.toThrow(/puntos_insuficientes/);

    expect(await saldoPuntos(ana)).toBe(499);
    const canjes = await leerFresco(db, "select id from public.loyalty_redemptions");
    expect(canjes).toHaveLength(0);
  });

  it("rechaza una recompensa retirada", async () => {
    const id = await crearRecompensa(100, { activa: false });
    await darPuntos(ana, 1000);
    await expect(canjear(ana, id)).rejects.toThrow(/recompensa_inactiva/);
  });

  it("las existencias bajan y a cero se agota", async () => {
    const id = await crearRecompensa(100, { existencias: 1 });
    await darPuntos(ana, 1000);
    await darPuntos(beto, 1000);

    await canjear(ana, id);

    const quedan = await leerFresco<{ existencias: number }>(
      db,
      "select existencias from public.loyalty_rewards where id = $1",
      [id]
    );
    expect(quedan[0]!.existencias).toBe(0);

    // La última unidad ya se fue: el segundo no se queda con un canje fantasma.
    await expect(canjear(beto, id)).rejects.toThrow(/recompensa_agotada/);
    expect(await saldoPuntos(beto)).toBe(1000);
  });

  it("sin límite de existencias no se agota nunca", async () => {
    const id = await crearRecompensa(100, { existencias: null });
    await darPuntos(ana, 1000);

    await canjear(ana, id, "uno");
    await canjear(ana, id, "dos");
    await canjear(ana, id, "tres");

    expect(await saldoPuntos(ana)).toBe(700);
  });
});

describe("idempotencia", () => {
  it("repetir la misma petición no cobra dos veces", async () => {
    const id = await crearRecompensa(500);
    await darPuntos(ana, 1000);

    const primera = await canjear(ana, id, "intento-1");
    const repetida = await canjear(ana, id, "intento-1");

    // Devuelve el canje original, no un error y no uno nuevo.
    expect(repetida.rows[0]!.codigo).toBe(primera.rows[0]!.codigo);
    expect(repetida.rows[0]!.redemption_id).toBe(primera.rows[0]!.redemption_id);

    expect(await saldoPuntos(ana)).toBe(500);
    const canjes = await leerFresco(db, "select id from public.loyalty_redemptions");
    expect(canjes).toHaveLength(1);
  });

  it("un canje nuevo y deliberado sí cobra otra vez", async () => {
    const id = await crearRecompensa(500);
    await darPuntos(ana, 1000);

    await canjear(ana, id, "intento-1");
    await canjear(ana, id, "intento-2");

    expect(await saldoPuntos(ana)).toBe(0);
    const canjes = await leerFresco(db, "select id from public.loyalty_redemptions");
    expect(canjes).toHaveLength(2);
  });

  it("dos personas con el mismo identificador no se pisan", async () => {
    /*
      El caso que obliga a meter el usuario en la clave. Sin él, la segunda
      recibiría el canje de la primera —con su código— y se quedaría sin el suyo
      y con los puntos intactos.
    */
    const id = await crearRecompensa(300);
    await darPuntos(ana, 1000);
    await darPuntos(beto, 1000);

    const deAna = await canjear(ana, id, "mismo");
    const deBeto = await canjear(beto, id, "mismo");

    expect(deBeto.rows[0]!.codigo).not.toBe(deAna.rows[0]!.codigo);
    expect(await saldoPuntos(ana)).toBe(700);
    expect(await saldoPuntos(beto)).toBe(700);
  });
});

describe("el catálogo no reescribe el pasado", () => {
  it("subir el precio no cambia lo que costó un canje de ayer", async () => {
    const id = await crearRecompensa(500, { nombre: "Bebida gratis" });
    await darPuntos(ana, 1000);
    await canjear(ana, id);

    await db.query(
      `select * from public.admin_recompensa_guardar(
         $1, $2, 'Bebida grande', null, 900, null, null, 1, true, 'Sube el coste')`,
      [duena, id]
    );

    const canje = await leerFresco<{ nombre: string; costo_puntos: string }>(
      db,
      "select nombre, costo_puntos from public.loyalty_redemptions"
    );
    expect(canje[0]!.nombre).toBe("Bebida gratis");
    expect(Number(canje[0]!.costo_puntos)).toBe(500);
  });

  it("una recompensa con canjes detrás no se puede borrar", async () => {
    const id = await crearRecompensa(100);
    await darPuntos(ana, 500);
    await canjear(ana, id);

    await expect(
      db.query("delete from public.loyalty_rewards where id = $1", [id])
    ).rejects.toThrow();
  });
});

describe("entrega en mostrador", () => {
  async function unCanje(): Promise<string> {
    const id = await crearRecompensa(100);
    await darPuntos(ana, 500);
    const r = await canjear(ana, id);
    return r.rows[0]!.redemption_id;
  }

  it("el mostrador puede entregar, y no devuelve puntos", async () => {
    const canjeId = await unCanje();
    const antes = await saldoPuntos(ana);

    await db.query("select * from public.admin_recompensa_entregar($1,$2)", [empleado, canjeId]);

    const r = await leerFresco<{ estado: string; entregada_por: string }>(
      db,
      "select estado, entregada_por from public.loyalty_redemptions where id = $1",
      [canjeId]
    );
    expect(r[0]!.estado).toBe("entregada");
    expect(r[0]!.entregada_por).toBe(empleado);

    // Entregar cierra el canje; no mueve el ledger.
    expect(await saldoPuntos(ana)).toBe(antes);
  });

  it("no se entrega dos veces", async () => {
    const canjeId = await unCanje();
    await db.query("select * from public.admin_recompensa_entregar($1,$2)", [empleado, canjeId]);
    await expect(
      db.query("select * from public.admin_recompensa_entregar($1,$2)", [empleado, canjeId])
    ).rejects.toThrow(/ya_entregada/);
  });

  it("alguien de fuera del equipo no entrega nada", async () => {
    const canjeId = await unCanje();
    await expect(
      db.query("select * from public.admin_recompensa_entregar($1,$2)", [beto, canjeId])
    ).rejects.toThrow(/no_autorizado/);
  });
});

describe("gestión del catálogo", () => {
  it("solo la dueña crea recompensas", async () => {
    await expect(
      db.query(
        `select * from public.admin_recompensa_guardar(
           $1, null, 'Café', null, 200, null, null, 1, true, 'Motivo suficiente')`,
        [empleado]
      )
    ).rejects.toThrow(/no_autorizado/);
  });

  it("exige motivo, nombre y un coste con sentido", async () => {
    const alta = (nombre: string, costo: number, motivo: string) =>
      db.query(
        `select * from public.admin_recompensa_guardar(
           $1, null, $2, null, $3, null, null, 1, true, $4)`,
        [duena, nombre, costo, motivo]
      );

    await expect(alta("Café", 200, "   ")).rejects.toThrow(/motivo_obligatorio/);
    await expect(alta("  ", 200, "Motivo válido")).rejects.toThrow(/nombre_obligatorio/);
    await expect(alta("Café", 0, "Motivo válido")).rejects.toThrow(/costo_invalido/);
    await expect(alta("Café", 100_001, "Motivo válido")).rejects.toThrow(/costo_excesivo/);
  });

  it("crear y editar dejan su rastro en la auditoría", async () => {
    const r = await db.query<{ reward_id: string }>(
      `select * from public.admin_recompensa_guardar(
         $1, null, 'Tote bag', 'La bolsa de la casa', 800, null, 10, 1, true, 'Alta de catálogo')`,
      [duena]
    );
    const id = r.rows[0]!.reward_id;

    await db.query(
      `select * from public.admin_recompensa_guardar(
         $1, $2, 'Tote bag', null, 700, null, 10, 1, true, 'Baja el coste en promoción')`,
      [duena, id]
    );

    const logs = await leerFresco<{ action: string }>(
      db,
      "select action from public.audit_logs where entity_type = 'loyalty_reward' order by created_at"
    );
    expect(logs.map((l) => l.action)).toEqual(["recompensa_creada", "recompensa_editada"]);
  });
});

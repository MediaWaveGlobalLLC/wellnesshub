// @vitest-environment node
/**
 * Roles de administración (migración 0012).
 *
 * La pregunta que responde este archivo es una sola: ¿el rol se aplica en la
 * base de datos, o solo en la interfaz?
 *
 * Importa porque el panel esconderá el formulario de ajuste a los empleados, y
 * esconder un botón no impide nada: quien sepa la URL del endpoint lo llama
 * igual. Si la barrera no está en SQL, no está.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { crearBase, crearUsuario, type Db } from "./supabase-harness";

let db: Db;
let duena: string;
let empleado: string;
let cliente: string;

beforeEach(async () => {
  db = await crearBase();
  duena = await crearUsuario(db, { email: "duena@siembra.test", firstName: "Erika" });
  empleado = await crearUsuario(db, { email: "empleado@siembra.test", firstName: "Isa" });
  cliente = await crearUsuario(db, { email: "cliente@siembra.test", firstName: "Valeria" });

  await db.query("insert into public.admin_users (user_id, rol) values ($1, 'duena')", [duena]);
  await db.query("insert into public.admin_users (user_id, rol) values ($1, 'empleado')", [
    empleado,
  ]);
});

afterEach(async () => {
  await db?.close();
});

const ajustarWallet = (actor: string, motivo = "Ajuste de prueba") =>
  db.query("select * from public.admin_ajustar_wallet($1,$2,$3,$4,$5,$6)", [
    actor,
    cliente,
    1000,
    motivo,
    null,
    "req-test",
  ]);

const ajustarPuntos = (actor: string) =>
  db.query("select * from public.admin_ajustar_puntos($1,$2,$3,$4,$5,$6)", [
    actor,
    cliente,
    50,
    "Ajuste de prueba",
    null,
    "req-test",
  ]);

describe("quién puede mover dinero", () => {
  it("la dueña puede ajustar saldo", async () => {
    const r = await ajustarWallet(duena);
    expect(r.rows).toHaveLength(1);
  });

  it("el empleado NO puede ajustar saldo", async () => {
    await expect(ajustarWallet(empleado)).rejects.toThrow(/no_autorizado/);
  });

  it("el empleado NO puede ajustar puntos", async () => {
    await expect(ajustarPuntos(empleado)).rejects.toThrow(/no_autorizado/);
  });

  it("un empleado rechazado no deja ni movimiento ni rastro de auditoría", async () => {
    // Que falle no basta: tiene que fallar SIN efectos. Una excepción después
    // de haber escrito media operación es peor que no tener rol ninguno.
    await expect(ajustarWallet(empleado)).rejects.toThrow();

    const mov = await db.query<{ n: number }>(
      "select count(*)::int as n from public.wallet_transactions where user_id = $1",
      [cliente]
    );
    const log = await db.query<{ n: number }>(
      "select count(*)::int as n from public.audit_logs where actor_user_id = $1",
      [empleado]
    );
    expect(mov.rows[0]!.n).toBe(0);
    expect(log.rows[0]!.n).toBe(0);
  });

  it("quien no es administrador sigue sin poder, con el mismo error", async () => {
    // Mismo mensaje que para el empleado: el error no revela si existes en
    // `admin_users` ni con qué rol.
    await expect(ajustarWallet(cliente)).rejects.toThrow(/no_autorizado/);
  });
});

describe("el default no deja fuera a nadie", () => {
  it("un administrador dado de alta sin especificar rol es dueña", async () => {
    /*
      Esto es lo que protege a los administradores que existían ANTES de esta
      migración. Si el default fuera 'empleado', aplicarla habría dejado a la
      dueña sin poder tocar su propio negocio hasta que alguien corriese un
      UPDATE a mano.
    */
    const nuevo = await crearUsuario(db, { email: "heredado@siembra.test" });
    await db.query("insert into public.admin_users (user_id) values ($1)", [nuevo]);

    const r = await db.query<{ rol: string }>(
      "select rol from public.admin_users where user_id = $1",
      [nuevo]
    );
    expect(r.rows[0]!.rol).toBe("duena");

    const ajuste = await ajustarWallet(nuevo);
    expect(ajuste.rows).toHaveLength(1);
  });

  it("la clave va sin eñe, como el resto de claves del proyecto", async () => {
    // `loyalty_tiers.key = 'raiz'` con `label = 'Raíz'`; aquí igual. La clave
    // viaja por comparaciones y tipos; el acento se pinta en la interfaz.
    const r = await db.query<{ rol: string }>("select distinct rol from public.admin_users");
    for (const fila of r.rows) {
      expect(fila.rol).toMatch(/^[a-z]+$/);
    }
  });

  it("solo admite los dos roles previstos", async () => {
    const otro = await crearUsuario(db, { email: "raro@siembra.test" });
    await expect(
      db.query("insert into public.admin_users (user_id, rol) values ($1, 'superadmin')", [otro])
    ).rejects.toThrow();
  });
});

describe("el negocio no puede quedarse sin dueña", () => {
  it("degradar a la última dueña falla", async () => {
    await expect(
      db.query("update public.admin_users set rol = 'empleado' where user_id = $1", [duena])
    ).rejects.toThrow(/ultima_duena/);
  });

  it("borrar a la última dueña falla", async () => {
    await expect(
      db.query("delete from public.admin_users where user_id = $1", [duena])
    ).rejects.toThrow(/ultima_duena/);
  });

  it("pero traspasar la propiedad en una transacción SÍ funciona", async () => {
    /*
      Esta es la razón de que el trigger sea `deferrable initially deferred`.
      Con una comprobación fila a fila, degradar a la actual antes de promocionar
      a la siguiente reventaría a mitad de camino y el traspaso sería imposible
      sin desactivar el cerrojo.
    */
    await db.exec("begin");
    await db.query("update public.admin_users set rol = 'duena' where user_id = $1", [empleado]);
    await db.query("update public.admin_users set rol = 'empleado' where user_id = $1", [duena]);
    await db.exec("commit");

    const r = await db.query<{ user_id: string }>(
      "select user_id from public.admin_users where rol = 'duena'"
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.user_id).toBe(empleado);
  });

  it("y quien deja de ser dueña deja de poder mover dinero", async () => {
    await db.exec("begin");
    await db.query("update public.admin_users set rol = 'duena' where user_id = $1", [empleado]);
    await db.query("update public.admin_users set rol = 'empleado' where user_id = $1", [duena]);
    await db.exec("commit");

    await expect(ajustarWallet(duena)).rejects.toThrow(/no_autorizado/);
    const r = await ajustarWallet(empleado);
    expect(r.rows).toHaveLength(1);
  });
});

describe("es_duena", () => {
  it("distingue los tres casos", async () => {
    const r = await db.query<{ d: boolean; e: boolean; c: boolean }>(
      "select public.es_duena($1) as d, public.es_duena($2) as e, public.es_duena($3) as c",
      [duena, empleado, cliente]
    );
    expect(r.rows[0]).toEqual({ d: true, e: false, c: false });
  });
});

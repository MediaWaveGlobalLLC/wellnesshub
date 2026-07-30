import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { crearBase, type Db } from "./supabase-harness";

/**
 * Invariantes del límite de intentos (`0010_rate_limits.sql`).
 *
 * Se prueba contra Postgres real en PGlite, no contra un doble: lo que importa
 * aquí es justamente el comportamiento del `on conflict` y de los permisos, que
 * un mock daría siempre por bueno.
 */
describe("consumir_rate_limit", () => {
  let db: Db;

  type Salida = { permitido: boolean; restantes: number; reintentar_en: number };

  /** Hash hex válido y distinto por prueba, para no compartir contador. */
  const clave = (semilla: string) =>
    Array.from(semilla.padEnd(32, "x"))
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 64);

  const consumir = async (accion: string, hash: string) => {
    const r = await db.query<Salida>("select * from public.consumir_rate_limit($1, $2)", [
      accion,
      hash,
    ]);
    return r.rows[0]!;
  };

  /** Ejecuta como rol `anon`, que es el que usa la web sin sesión. */
  const comoAnon = async <T>(sql: string): Promise<T[]> => {
    await db.exec("set role anon");
    try {
      return (await db.query<T>(sql)).rows;
    } finally {
      await db.exec("reset role");
    }
  };

  beforeAll(async () => {
    db = await crearBase();
  });

  afterAll(async () => {
    await db.close();
  });

  it("permite hasta el máximo configurado y bloquea el siguiente", async () => {
    const hash = clave("login-basico");
    const max = (
      await db.query<{ max_intentos: number }>(
        "select max_intentos from public.rate_limit_reglas where accion = 'login'"
      )
    ).rows[0]!.max_intentos;

    for (let i = 1; i <= max; i++) {
      const r = await consumir("login", hash);
      expect(r.permitido, `el intento ${i} de ${max} debería permitirse`).toBe(true);
    }

    const bloqueado = await consumir("login", hash);
    expect(bloqueado.permitido).toBe(false);
    expect(bloqueado.restantes).toBe(0);
    // Dice cuánto falta para la próxima ventana, nunca un valor negativo.
    expect(bloqueado.reintentar_en).toBeGreaterThan(0);
  });

  it("cuenta por separado cada clave", async () => {
    const a = clave("aislada-a");
    const b = clave("aislada-b");

    for (let i = 0; i < 8; i++) await consumir("login", a);
    expect((await consumir("login", a)).permitido).toBe(false);

    // Que una IP agote su cupo no puede afectar a otra.
    expect((await consumir("login", b)).permitido).toBe(true);
  });

  it("cuenta por separado cada acción", async () => {
    const hash = clave("misma-clave-dos-acciones");
    for (let i = 0; i < 8; i++) await consumir("login", hash);
    expect((await consumir("login", hash)).permitido).toBe(false);

    // 'registro' tiene su propio umbral y su propio contador.
    expect((await consumir("registro", hash)).permitido).toBe(true);
  });

  it("rechaza una acción que no existe en vez de dejar pasar", async () => {
    await expect(consumir("accion-inventada", clave("x"))).rejects.toThrow(/desconocida/);
  });

  it("rechaza una clave que no sea SHA-256 hex", async () => {
    // Sin esto, la tabla admitiría texto arbitrario desde fuera.
    await expect(consumir("login", "'; drop table public.wallets; --")).rejects.toThrow(
      /invalida/
    );
    await expect(consumir("login", "ABC123")).rejects.toThrow(/invalida/);
  });

  it("no expone las tablas al rol anónimo", async () => {
    const hash = clave("visible-solo-para-service-role");
    await consumir("login", hash);

    // Las filas existen…
    const reales = await db.query("select * from public.rate_limit_hits where clave_hash = $1", [
      hash,
    ]);
    expect(reales.rows.length).toBe(1);

    // …y aun así anon no ve ninguna. Con RLS activo y cero políticas, Postgres
    // no lanza error: devuelve el conjunto vacío. Por eso se comprueba el número
    // de filas y no que la consulta falle.
    expect((await comoAnon("select * from public.rate_limit_hits")).length).toBe(0);
    expect((await comoAnon("select * from public.rate_limit_reglas")).length).toBe(0);
  });

  it("el rol anónimo no puede manipular el contador", async () => {
    const hash = clave("intento-de-manipulacion");
    for (let i = 0; i < 3; i++) await consumir("login", hash);

    // Insertar da error: no hay política que lo permita.
    await expect(
      comoAnon(
        "insert into public.rate_limit_hits (accion, clave_hash, ventana_inicio, conteo)" +
          ` values ('login', '${clave("inyectada")}', now(), 0)`
      )
    ).rejects.toThrow();

    // Un update NO da error, porque RLS filtra las filas antes y no encuentra
    // ninguna que tocar. Lo que hay que comprobar es que no cambió nada: si
    // solo se afirmara que lanza excepción, el día que se añada una política de
    // lectura este test seguiría en verde mientras el contador ya sería
    // borrable.
    await comoAnon("update public.rate_limit_hits set conteo = 0");
    await comoAnon("delete from public.rate_limit_hits");
    await comoAnon("update public.rate_limit_reglas set max_intentos = 999999");

    const contador = await db.query<{ conteo: number }>(
      "select conteo from public.rate_limit_hits where clave_hash = $1",
      [hash]
    );
    expect(contador.rows[0]?.conteo).toBe(3);

    const regla = await db.query<{ max_intentos: number }>(
      "select max_intentos from public.rate_limit_reglas where accion = 'login'"
    );
    expect(regla.rows[0]!.max_intentos).toBe(8);
  });

  it("el rol anónimo sí puede consumir el límite", async () => {
    // Si esto fallara, la web caería siempre en 'fallo abierto' y el límite no
    // existiría en producción.
    const hash = clave("desde-anon");
    const filas = await comoAnon<Salida>(
      `select * from public.consumir_rate_limit('login', '${hash}')`
    );
    expect(filas[0]!.permitido).toBe(true);
  });
});

// @vitest-environment node
/**
 * Regresión de la migración 0006 — el nivel se deriva de los puntos.
 *
 * `loyalty_accounts.tier` era una copia desnormalizada que nadie mantenía: tras
 * sembrar 750 puntos en el proyecto real seguía diciendo 'semilla'. Se intentó
 * sostenerla con un trigger y resultó poco fiable, así que 0006 elimina la
 * columna: los puntos son el dato y el nivel se calcula.
 *
 * NOTA SOBRE EL AISLAMIENTO
 * Estas pruebas viven en su propio fichero a propósito. Dentro de
 * `esquema-y-rls.test.ts` —21 casos, cada uno levantando su propio Postgres en
 * WASM— las lecturas posteriores a una escritura devolvían el valor anterior de
 * forma reproducible, aun cambiando el texto de la consulta, quitando los
 * parámetros y cerrando las instancias entre casos. Un volcado del estado en
 * ese mismo punto confirmó que la base era correcta (saldo 750, vista 'brote'),
 * así que el problema está en cómo PGlite se comporta con muchas instancias en
 * un mismo proceso, no en el esquema. Aislarlo aquí lo hace determinista.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { crearBase, crearUsuario, type Db } from "./supabase-harness";

let db: Db;

beforeEach(async () => {
  db = await crearBase();
});

afterEach(async () => {
  await db?.close();
});

describe("nivel derivado de los puntos", () => {
  it("no queda ninguna copia del nivel que pueda quedarse atrás", async () => {
    const r = await db.query(
      `select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'loyalty_accounts'
          and column_name = 'tier'`
    );
    expect(r.rows).toHaveLength(0);
  });

  it("nivel_para_puntos sitúa cada saldo en su escalón", async () => {
    const r = await db.query<{ p0: string; p499: string; p500: string; p2000: string; p9999: string }>(
      `select public.nivel_para_puntos(0)    as p0,
              public.nivel_para_puntos(499)  as p499,
              public.nivel_para_puntos(500)  as p500,
              public.nivel_para_puntos(2000) as p2000,
              public.nivel_para_puntos(9999) as p9999`
    );
    expect(r.rows[0]).toEqual({
      p0: "semilla",
      p499: "semilla",
      p500: "brote",
      p2000: "raiz",
      p9999: "florecer",
    });
  });

  it("la vista refleja el saldo real de la cuenta", async () => {
    const id = await crearUsuario(db, { email: "nivel@example.com" });

    await db.query("select * from public.apply_loyalty_transaction($1,$2,$3,$4)", [
      id,
      750,
      "earn",
      "sube-a-brote",
    ]);

    // Saldo y nivel en la MISMA consulta: se comprueban de forma consistente,
    // sin depender de dos lecturas separadas.
    const r = await db.query<{ saldo: string; nivel: string }>(
      `select points_balance::text as saldo, tier as nivel
         from public.loyalty_accounts_con_nivel where user_id = $1`,
      [id]
    );
    expect(r.rows[0]).toEqual({ saldo: "750", nivel: "brote" });
  });

  it("baja de nivel al canjear puntos", async () => {
    const id = await crearUsuario(db, { email: "baja@example.com" });

    await db.query("select * from public.apply_loyalty_transaction($1,$2,$3,$4)", [
      id,
      2000,
      "earn",
      "sube",
    ]);
    await db.query("select * from public.apply_loyalty_transaction($1,$2,$3,$4)", [
      id,
      -1600,
      "redeem",
      "canjea",
    ]);

    const r = await db.query<{ saldo: string; nivel: string }>(
      `select points_balance::text as saldo, tier as nivel
         from public.loyalty_accounts_con_nivel where user_id = $1`,
      [id]
    );
    expect(r.rows[0]).toEqual({ saldo: "400", nivel: "semilla" });
  });

  it("la vista hereda RLS: nadie ve el nivel ajeno", async () => {
    const ana = await crearUsuario(db, { email: "ana@example.com" });
    await crearUsuario(db, { email: "bruno@example.com" });

    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claims', $1, false)", [
      JSON.stringify({ sub: ana, role: "authenticated" }),
    ]);
    const r = await db.query("select user_id from public.loyalty_accounts_con_nivel");
    await db.exec("reset role");

    expect(r.rows).toHaveLength(1);
  });
});

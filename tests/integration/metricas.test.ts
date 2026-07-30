// @vitest-environment node
/**
 * Métricas agregadas (migración 0013).
 *
 * El primer bloque es el motivo de existir de esta migración.
 *
 * `obtenerResumen()` traía TODAS las filas de `wallets` para sumarlas en
 * JavaScript. El cliente de Supabase devuelve como mucho 1.000 filas, así que
 * al llegar al miembro 1.001 el «crédito en circulación» del panel empezaba a
 * enseñar una cifra más baja que la real. Sin error, sin aviso: solo un número
 * equivocado sobre cuánto dinero debe el negocio.
 *
 * Por eso el test siembra 1.100 wallets. Con menos, pasaría igual con el código
 * viejo y no probaría nada.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearBase, type Db } from "./supabase-harness";

let db: Db;

/** Suma esperada: 1 + 2 + … + 1100 centavos, en una sola fórmula. */
const CUENTAS = 1100;
const SUMA_ESPERADA = (CUENTAS * (CUENTAS + 1)) / 2;

beforeAll(async () => {
  db = await crearBase();

  // En bloque, no de uno en uno: el trigger `handle_new_user` ya crea perfil,
  // wallet y cuenta de puntos por cada usuario.
  await db.exec(`
    insert into auth.users (id, email, raw_user_meta_data)
    select gen_random_uuid(),
           'socio' || n || '@siembra.test',
           jsonb_build_object('first_name', 'Socio', 'last_name', n::text)
      from generate_series(1, ${CUENTAS}) n;
  `);

  // Saldos 1..1100 centavos. Distintos a propósito: si el código sumara solo
  // las primeras 1.000 filas, el total se quedaría corto de forma detectable.
  await db.exec(`
    with numerada as (
      select user_id, row_number() over (order by user_id) as n from public.wallets
    )
    update public.wallets w set balance_cents = numerada.n
      from numerada where numerada.user_id = w.user_id;
  `);
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe("el crédito en circulación deja de mentir", () => {
  it("suma las 1.100 wallets, no las primeras 1.000", async () => {
    const r = await db.query<{ saldo_total_cents: string; miembros: string }>(
      "select saldo_total_cents, miembros from public.metricas_resumen()"
    );

    expect(Number(r.rows[0]!.miembros)).toBe(CUENTAS);
    expect(Number(r.rows[0]!.saldo_total_cents)).toBe(SUMA_ESPERADA);
  });

  it("y el corte de 1.000 filas habría dado un número menor", async () => {
    // Reproduce lo que hacía el código viejo, para dejar constancia de cuánto
    // se perdía: no es un redondeo, son 105.050 centavos de diferencia.
    const truncado = await db.query<{ suma: string }>(
      "select coalesce(sum(balance_cents), 0) as suma from (select balance_cents from public.wallets order by user_id limit 1000) t"
    );
    expect(Number(truncado.rows[0]!.suma)).toBeLessThan(SUMA_ESPERADA);
  });

  it("cuenta solo las wallets con saldo, no todas", async () => {
    const r = await db.query<{ wallets_con_saldo: string }>(
      "select wallets_con_saldo from public.metricas_resumen()"
    );
    // Las 1.100 tienen saldo >= 1, así que coinciden; el valor importa cuando
    // haya cuentas a cero, que es lo normal.
    expect(Number(r.rows[0]!.wallets_con_saldo)).toBe(CUENTAS);
  });
});

describe("series temporales", () => {
  it("devuelve todos los periodos del rango, incluidos los vacíos", async () => {
    // Una gráfica que se salta los días sin datos miente por omisión: una
    // semana sin altas desaparece en vez de verse como un valle.
    const r = await db.query<{ periodo: string; valor: string }>(
      "select * from public.metricas_serie('altas', current_date - 6, current_date, 'dia')"
    );
    expect(r.rows).toHaveLength(7);
  });

  it("las altas de hoy aparecen en el último periodo", async () => {
    const r = await db.query<{ periodo: string; valor: string }>(
      "select * from public.metricas_serie('altas', current_date - 6, current_date, 'dia')"
    );
    const total = r.rows.reduce((s, f) => s + Number(f.valor), 0);
    expect(total).toBe(CUENTAS);
  });

  it("rechaza un grano que no existe en vez de devolver algo raro", async () => {
    await expect(
      db.query("select * from public.metricas_serie('altas', current_date - 6, current_date, 'quincena')")
    ).rejects.toThrow(/grano invalido/);
  });

  it("rechaza un rango al revés", async () => {
    await expect(
      db.query("select * from public.metricas_serie('altas', current_date, current_date - 6, 'dia')")
    ).rejects.toThrow(/rango invalido/);
  });

  it("una métrica desconocida devuelve ceros, no filas de otra métrica", async () => {
    // Todas las ramas del union filtran por `p_metrica`, así que un nombre que
    // no existe no puede colar datos de la rama de al lado.
    const r = await db.query<{ valor: string }>(
      "select valor from public.metricas_serie('inventada', current_date - 2, current_date, 'dia')"
    );
    expect(r.rows.every((f) => Number(f.valor) === 0)).toBe(true);
  });
});

describe("permisos", () => {
  it("ni anon ni authenticated pueden llamar a las métricas", async () => {
    for (const rol of ["anon", "authenticated"]) {
      await db.exec(`set role ${rol}`);
      try {
        await expect(db.query("select * from public.metricas_resumen()")).rejects.toThrow();
      } finally {
        await db.exec("reset role");
      }
    }
  });
});

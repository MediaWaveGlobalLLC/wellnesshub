// @vitest-environment node
/**
 * Analítica de visitas (migración 0016).
 *
 * Dos cosas se comprueban aquí, y la primera importa más que la segunda:
 *
 *  1. Que la tabla NO PUEDA guardar datos personales. No que la aplicación no
 *     se los mande —eso se prueba en `tests/unit/analitica-clasificar.test.ts`—
 *     sino que la base los rechace aunque se los manden. Una promesa de
 *     privacidad que dependa de que el código de arriba se porte bien no es una
 *     garantía, es una intención.
 *
 *  2. Que los números salgan bien: agregación al escribir, series con ceros,
 *     ventana anterior y hora punta.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { crearBase, leerFresco, type Db } from "./supabase-harness";

let db: Db;

beforeAll(async () => {
  db = await crearBase();
}, 120_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec("delete from public.visitas_agregado");
});

/** Inserta directamente, saltándose `now()`, para poder fechar el pasado. */
async function sembrar(
  filas: { ruta: string; horasAtras: number; origen?: string; conteo?: number }[]
) {
  for (const f of filas) {
    await db.query(
      `insert into public.visitas_agregado (ruta, hora, origen, conteo)
       values ($1, date_trunc('hour', now() at time zone 'UTC') at time zone 'UTC'
                    - make_interval(hours => $2::int), $3, $4)
       on conflict (ruta, hora, origen) do update set conteo = visitas_agregado.conteo + excluded.conteo`,
      [f.ruta, f.horasAtras, f.origen ?? "directo", f.conteo ?? 1]
    );
  }
}

describe("la tabla no puede guardar datos personales", () => {
  it("rechaza una ruta con caracteres que no son de una ruta", () => {
    // Un correo, un token o una cadena de consulta no encajan en el CHECK. La
    // columna no admite texto libre: no es cuestión de que nadie lo intente.
    const basura = [
      "/perfil?email=alguien@ejemplo.com",
      "/buscar?q=nombre apellido",
      "correo@ejemplo.com",
      "/ruta con espacios",
    ];

    return Promise.all(
      basura.map((r) =>
        expect(
          db.query(
            "insert into public.visitas_agregado (ruta, hora, origen, conteo) values ($1, now(), 'directo', 1)",
            [r]
          )
        ).rejects.toThrow()
      )
    );
  });

  it("rechaza un origen inventado", async () => {
    // Si el CHECK aceptara texto libre, `origen` sería el sitio perfecto donde
    // acabaría colándose la URL completa del referente.
    await expect(
      db.query(
        "insert into public.visitas_agregado (ruta, hora, origen, conteo) values ('/menu', now(), $1, 1)",
        ["https://www.instagram.com/p/Cxyz/?igshid=abc"]
      )
    ).rejects.toThrow();
  });

  it("no existe ninguna columna donde guardar IP, user-agent o usuario", async () => {
    const cols = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'visitas_agregado'`
    );
    const nombres = cols.rows.map((c) => c.column_name).sort();

    // Igualdad exacta, no «no contiene»: si mañana alguien añade una columna
    // para «enriquecer» la analítica, este test lo para en seco.
    expect(nombres).toEqual(["conteo", "hora", "origen", "ruta"]);
  });

  it("la hora se guarda truncada: nunca hay minutos ni segundos", async () => {
    // Con marca de tiempo fina, dos visitas seguidas a la misma página serían
    // distinguibles de dos visitas sueltas, y eso es información de sesión.
    await db.query("select public.registrar_visita('/menu', 'directo')");

    const r = await leerFresco<{ resto: string }>(
      db,
      "select (extract(minute from hora) + extract(second from hora))::text as resto from public.visitas_agregado"
    );
    // `Number` y no comparación de cadena: `extract` devuelve numeric y Postgres
    // lo formatea como «0.000000».
    expect(Number(r[0]!.resto)).toBe(0);
  });

  it("ni anon ni authenticated pueden escribir ni leer", async () => {
    for (const rol of ["anon", "authenticated"]) {
      await db.exec(`set role ${rol}`);
      try {
        await expect(
          db.query("select public.registrar_visita('/menu', 'directo')")
        ).rejects.toThrow();

        // RLS sin políticas: la lectura no falla, devuelve cero filas.
        const r = await db.query("select * from public.visitas_agregado");
        expect(r.rows).toHaveLength(0);

        await expect(
          db.query("select * from public.metricas_visitas_resumen(current_date, current_date)")
        ).rejects.toThrow();
      } finally {
        await db.exec("reset role");
      }
    }
  });
});

describe("registrar_visita", () => {
  it("agrega en la misma fila en vez de crear una por visita", async () => {
    for (let i = 0; i < 5; i++) {
      await db.query("select public.registrar_visita('/menu', 'instagram')");
    }

    const r = await leerFresco<{ filas: string; total: string }>(
      db,
      "select count(*)::text as filas, sum(conteo)::text as total from public.visitas_agregado"
    );
    expect(r[0]!.filas).toBe("1");
    expect(r[0]!.total).toBe("5");
  });

  it("separa por ruta y por origen", async () => {
    await db.query("select public.registrar_visita('/menu', 'instagram')");
    await db.query("select public.registrar_visita('/menu', 'google')");
    await db.query("select public.registrar_visita('/', 'instagram')");

    const r = await leerFresco<{ filas: string }>(
      db,
      "select count(*)::text as filas from public.visitas_agregado"
    );
    expect(r[0]!.filas).toBe("3");
  });

  it("devuelve false y no escribe nada ante una entrada inválida", async () => {
    // No levanta excepción a propósito: esto corre en el proxy, en cada
    // petición. Un dato mal formado no puede llenar los logs de errores ni
    // tumbar la respuesta. Pero tampoco puede pasar desapercibido, y por eso
    // devuelve un booleano en vez de nada.
    for (const [ruta, origen] of [
      ["/ruta con espacios", "directo"],
      ["/menu", "instagram.com/p/Cxyz"],
      ["sin-barra", "directo"],
      ["/" + "a".repeat(200), "directo"],
    ]) {
      const r = await db.query<{ registrar_visita: boolean }>(
        "select public.registrar_visita($1, $2)",
        [ruta, origen]
      );
      expect(r.rows[0]!.registrar_visita).toBe(false);
    }

    const filas = await leerFresco<{ n: string }>(
      db,
      "select count(*)::text as n from public.visitas_agregado"
    );
    expect(filas[0]!.n).toBe("0");
  });
});

describe("lectura", () => {
  it("la serie devuelve todos los periodos, incluidos los vacíos", async () => {
    await sembrar([{ ruta: "/menu", horasAtras: 1, conteo: 3 }]);

    const r = await db.query<{ periodo: string; visitas: string }>(
      "select * from public.metricas_visitas_serie(current_date - 6, current_date, 'dia')"
    );

    expect(r.rows).toHaveLength(7);
    // Un día sin visitas es un cero que se dibuja como valle, no una fila que
    // desaparece y hace que la curva parezca continua.
    expect(r.rows.filter((f) => Number(f.visitas) === 0).length).toBeGreaterThan(0);
    expect(r.rows.reduce((s, f) => s + Number(f.visitas), 0)).toBe(3);
  });

  it("rechaza un grano inventado y un rango al revés", async () => {
    await expect(
      db.query("select * from public.metricas_visitas_serie(current_date - 1, current_date, 'quincena')")
    ).rejects.toThrow(/grano invalido/);

    await expect(
      db.query("select * from public.metricas_visitas_serie(current_date, current_date - 1, 'dia')")
    ).rejects.toThrow(/rango invalido/);
  });

  it("el ranking de páginas suma todos los orígenes de cada ruta", async () => {
    await sembrar([
      { ruta: "/menu", horasAtras: 1, origen: "instagram", conteo: 4 },
      { ruta: "/menu", horasAtras: 1, origen: "google", conteo: 3 },
      { ruta: "/", horasAtras: 1, origen: "directo", conteo: 5 },
    ]);

    const r = await db.query<{ ruta: string; visitas: string }>(
      "select * from public.metricas_visitas_rutas(current_date - 1, current_date, 10)"
    );

    expect(r.rows[0]!.ruta).toBe("/menu");
    expect(Number(r.rows[0]!.visitas)).toBe(7);
    expect(r.rows[1]!.ruta).toBe("/");
    expect(Number(r.rows[1]!.visitas)).toBe(5);
  });

  it("el ranking desempata por ruta, para que no baile entre cargas", async () => {
    // Sin el segundo criterio, dos páginas con el mismo número cambian de sitio
    // de una carga a la siguiente sin que haya pasado nada, y eso hace dudar
    // del dato entero.
    await sembrar([
      { ruta: "/comunidad", horasAtras: 1, conteo: 2 },
      { ruta: "/", horasAtras: 1, conteo: 2 },
      { ruta: "/menu", horasAtras: 1, conteo: 2 },
    ]);

    const r = await db.query<{ ruta: string }>(
      "select ruta from public.metricas_visitas_rutas(current_date - 1, current_date, 10)"
    );
    expect(r.rows.map((f) => f.ruta)).toEqual(["/", "/comunidad", "/menu"]);
  });

  it("el origen devuelve las ocho categorías aunque casi todas valgan cero", async () => {
    await sembrar([{ ruta: "/menu", horasAtras: 1, origen: "instagram", conteo: 9 }]);

    const r = await db.query<{ origen: string; visitas: string }>(
      "select * from public.metricas_visitas_origen(current_date - 1, current_date)"
    );

    expect(r.rows).toHaveLength(8);
    expect(r.rows[0]!.origen).toBe("instagram");
    expect(Number(r.rows[0]!.visitas)).toBe(9);
    // Que Instagram trajera CERO esta semana es justo el dato accionable, y una
    // lista que solo enseña lo que tuvo tráfico lo esconde.
    expect(r.rows.filter((f) => Number(f.visitas) === 0)).toHaveLength(7);
  });

  it("la suma del desglose por origen cuadra con el total del resumen", async () => {
    // Dos números de la misma pantalla no pueden contradecirse.
    await sembrar([
      { ruta: "/menu", horasAtras: 2, origen: "instagram", conteo: 4 },
      { ruta: "/", horasAtras: 3, origen: "interno", conteo: 6 },
      { ruta: "/", horasAtras: 4, origen: "directo", conteo: 1 },
    ]);

    const origen = await db.query<{ visitas: string }>(
      "select visitas from public.metricas_visitas_origen(current_date - 1, current_date)"
    );
    const resumen = await db.query<{ total: string }>(
      "select total from public.metricas_visitas_resumen(current_date - 1, current_date)"
    );

    const suma = origen.rows.reduce((s, f) => s + Number(f.visitas), 0);
    expect(suma).toBe(Number(resumen.rows[0]!.total));
    expect(suma).toBe(11);
  });

  it("compara contra la ventana anterior del mismo tamaño", async () => {
    // Rango de 2 días (ayer y hoy) → la ventana previa son los 2 días de antes.
    await sembrar([
      { ruta: "/menu", horasAtras: 2, conteo: 10 },
      { ruta: "/menu", horasAtras: 24 * 3, conteo: 4 },
      // Fuera de las dos ventanas: no debe contarse en ninguna.
      { ruta: "/menu", horasAtras: 24 * 20, conteo: 99 },
    ]);

    const r = await db.query<{ total: string; total_anterior: string; rutas: string }>(
      "select * from public.metricas_visitas_resumen(current_date - 1, current_date)"
    );

    expect(Number(r.rows[0]!.total)).toBe(10);
    expect(Number(r.rows[0]!.total_anterior)).toBe(4);
    expect(Number(r.rows[0]!.rutas)).toBe(1);
  });

  it("sin ninguna visita devuelve ceros y hora punta nula, no un cero engañoso", async () => {
    // «Hora punta: 12 a. m.» cuando no hay datos se lee como un hecho.
    const r = await db.query<{ total: string; hora_punta: number | null }>(
      "select total, hora_punta from public.metricas_visitas_resumen(current_date - 6, current_date)"
    );

    expect(Number(r.rows[0]!.total)).toBe(0);
    expect(r.rows[0]!.hora_punta).toBeNull();
  });

  it("la hora punta se calcula en hora de Puerto Rico, no en UTC", async () => {
    /*
      Puerto Rico es UTC-4 todo el año. Una visita guardada a las 02:00 UTC
      ocurrió a las 22:00 del día anterior en Condado. Si la hora punta se
      calculara en UTC diría «2 de la madrugada» —una hora en la que la
      cafetería está cerrada— en vez de «10 de la noche».
    */
    await db.exec(`
      insert into public.visitas_agregado (ruta, hora, origen, conteo)
      values ('/menu', timestamptz '2026-07-15 02:00:00+00', 'directo', 50)
    `);

    const r = await db.query<{ hora_punta: number }>(
      "select hora_punta from public.metricas_visitas_resumen(date '2026-07-14', date '2026-07-16')"
    );
    expect(r.rows[0]!.hora_punta).toBe(22);
  });
});

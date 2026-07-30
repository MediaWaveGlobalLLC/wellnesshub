// @vitest-environment node
/**
 * Búsqueda de administración (migración 0014).
 *
 * El bug que mata este archivo: `buscarUsuarios` sacaba los correos de
 * `listUsers({ page: 1, perPage: 200 })` y filtraba en JavaScript. Con 250
 * socios, buscar el correo del primero devolvía «Sin resultados» sobre una
 * cuenta que existe y está activa. No fallaba: mentía.
 *
 * Por eso se siembran 250. Con 25 pasaría con el código viejo y no probaría
 * nada.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearBase, type Db } from "./supabase-harness";

let db: Db;

const CUENTAS = 250;

type Fila = {
  id: string;
  member_id: string;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  puntos: string;
  nivel: string;
  saldo_cents: string;
  total: string;
};

const buscar = async (consulta: string, limite = 25, offset = 0) => {
  const r = await db.query<Fila>("select * from public.admin_buscar_usuarios($1, $2, $3)", [
    consulta,
    limite,
    offset,
  ]);
  return r.rows;
};

beforeAll(async () => {
  db = await crearBase();

  // El trigger `handle_new_user` crea perfil, wallet y puntos por cada uno, y
  // desde 0014 copia también el correo a `profiles`.
  await db.exec(`
    insert into auth.users (id, email, raw_user_meta_data)
    select gen_random_uuid(),
           'socio' || lpad(n::text, 4, '0') || '@siembra.test',
           jsonb_build_object('first_name', 'Socio', 'last_name', lpad(n::text, 4, '0'))
      from generate_series(1, ${CUENTAS}) n;
  `);
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe("el techo de 200 usuarios", () => {
  it("copia el correo a profiles en el alta", async () => {
    const r = await db.query<{ sin_correo: number }>(
      "select count(*)::int as sin_correo from public.profiles where email is null"
    );
    expect(r.rows[0]!.sin_correo).toBe(0);
  });

  it("encuentra por correo al socio 1 con 250 cuentas en la base", async () => {
    // Este es el caso exacto que fallaba: el más antiguo, fuera de las 200
    // primeras que devolvía la API de Auth.
    const filas = await buscar("socio0001@siembra.test");
    expect(filas).toHaveLength(1);
    expect(filas[0]!.email).toBe("socio0001@siembra.test");
  });

  it("encuentra también al último", async () => {
    const filas = await buscar("socio0250@siembra.test");
    expect(filas).toHaveLength(1);
  });

  it("busca por nombre, por member ID y por parte del correo", async () => {
    expect((await buscar("Socio", 5)).length).toBe(5);

    const uno = (await buscar("socio0100@siembra.test"))[0]!;
    expect((await buscar(uno.member_id))).toHaveLength(1);
    expect((await buscar("socio0100")).length).toBeGreaterThan(0);
  });
});

describe("paginación", () => {
  it("el total es el de la consulta, no el de la página", async () => {
    const filas = await buscar("", 25, 0);
    expect(filas).toHaveLength(25);
    expect(Number(filas[0]!.total)).toBe(CUENTAS);
  });

  it("la segunda página no repite a nadie de la primera", async () => {
    const p1 = await buscar("", 25, 0);
    const p2 = await buscar("", 25, 25);
    const ids = new Set(p1.map((f) => f.id));
    expect(p2.some((f) => ids.has(f.id))).toBe(false);
  });

  it("una consulta vacía lista todo, ordenado por alta descendente", async () => {
    const filas = await buscar("   ", 3);
    expect(filas).toHaveLength(3);
    expect(Number(filas[0]!.total)).toBe(CUENTAS);
  });
});

describe("comodines de LIKE", () => {
  it("un guion bajo no devuelve a todo el mundo", async () => {
    // Sin escapar, `_` casa con cualquier carácter y la búsqueda se convierte
    // en un listado completo con pinta de resultado legítimo.
    const filas = await buscar("_");
    expect(filas).toHaveLength(0);
  });

  it("un porcentaje tampoco", async () => {
    const filas = await buscar("%");
    expect(filas).toHaveLength(0);
  });
});

describe("permisos", () => {
  it("ni anon ni authenticated pueden buscar usuarios", async () => {
    for (const rol of ["anon", "authenticated"]) {
      await db.exec(`set role ${rol}`);
      try {
        await expect(
          db.query("select * from public.admin_buscar_usuarios('', 10, 0)")
        ).rejects.toThrow();
      } finally {
        await db.exec("reset role");
      }
    }
  });

  it("un cliente no puede cambiarse el correo en su perfil", async () => {
    /*
      `profiles.email` es una copia de `auth.users`. Si el cliente pudiera
      reescribirla, la administración buscaría por un correo falso mientras el
      real sigue siendo otro. El trigger de 0014 lo restaura.
    */
    const victima = (
      await db.query<{ id: string }>("select id from public.profiles limit 1")
    ).rows[0]!.id;

    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claims', $1, false)", [
      JSON.stringify({ sub: victima, role: "authenticated" }),
    ]);
    try {
      await db.query("update public.profiles set email = 'robado@ejemplo.test' where id = $1", [
        victima,
      ]);
    } catch {
      // Si RLS lo rechaza directamente, mejor todavía.
    } finally {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claims', '', false)");
    }

    const r = await db.query<{ email: string }>(
      "select email from public.profiles where id = $1",
      [victima]
    );
    expect(r.rows[0]!.email).not.toBe("robado@ejemplo.test");
  });
});

// @vitest-environment node
/**
 * Edición del catálogo (migración 0015).
 *
 * Tres cosas importan aquí, en este orden:
 *
 *  1. Que un empleado pueda marcar agotados y NADA más.
 *  2. Que cada cambio de precio deje rastro. Hasta ahora subir un latte dos
 *     dólares no dejaba ninguno.
 *  3. Que reordenar no choque con `unique (producto_id, orden)` y que archivar
 *     no deje favoritos huérfanos.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { crearBase, crearUsuario, leerFresco, type Db } from "./supabase-harness";

let db: Db;
let duena: string;
let empleado: string;
let cliente: string;

/** Un producto conocido de la carta sembrada por 0011. */
async function productoPorSlug(slug: string) {
  const r = await db.query<{ id: string; disponible: boolean; nombre: string }>(
    "select id, disponible, nombre from public.menu_productos where slug = $1",
    [slug]
  );
  return r.rows[0]!;
}

async function variantesDe(slug: string) {
  const r = await db.query<{ id: string; etiqueta: string | null; precio_cents: number; orden: number }>(
    `select v.id, v.etiqueta, v.precio_cents, v.orden
       from public.menu_variantes v
       join public.menu_productos p on p.id = v.producto_id
      where p.slug = $1 order by v.orden`,
    [slug]
  );
  return r.rows;
}

beforeEach(async () => {
  db = await crearBase();
  duena = await crearUsuario(db, { email: "duena@siembra.test", firstName: "Erika" });
  empleado = await crearUsuario(db, { email: "empleado@siembra.test", firstName: "Isa" });
  cliente = await crearUsuario(db, { email: "cliente@siembra.test", firstName: "Valeria" });

  await db.query("insert into public.admin_users (user_id, rol) values ($1, 'duena')", [duena]);
  await db.query("insert into public.admin_users (user_id, rol) values ($1, 'empleado')", [empleado]);
});

afterEach(async () => {
  await db?.close();
});

describe("precio", () => {
  it("la dueña cambia el precio y queda auditado con el antes y el después", async () => {
    const [v] = await variantesDe("matcha-clasico");
    expect(v!.precio_cents).toBe(875);

    await db.query("select * from public.admin_catalogo_precio($1,$2,$3,$4,$5)", [
      duena,
      v!.id,
      925,
      "Sube el precio del matcha ceremonial",
      "req-1",
    ]);

    expect((await variantesDe("matcha-clasico"))[0]!.precio_cents).toBe(925);

    const log = await db.query<{ before_data: Record<string, unknown>; after_data: Record<string, unknown>; reason: string }>(
      "select before_data, after_data, reason from public.audit_logs where action = 'menu_precio'"
    );
    expect(log.rows).toHaveLength(1);
    expect(log.rows[0]!.before_data).toMatchObject({ precio_cents: 875 });
    expect(log.rows[0]!.after_data).toMatchObject({ precio_cents: 925, slug: "matcha-clasico" });
    // El log lleva el nombre del producto: leerlo no debería exigir resolver
    // un UUID contra la tabla.
    expect(log.rows[0]!.after_data).toHaveProperty("producto", "Matcha Clásico");
  });

  it("el empleado NO puede cambiar precios", async () => {
    const [v] = await variantesDe("matcha-clasico");
    await expect(
      db.query("select * from public.admin_catalogo_precio($1,$2,$3,$4,$5)", [
        empleado,
        v!.id,
        1,
        "Intento",
        null,
      ])
    ).rejects.toThrow(/no_autorizado/);

    expect((await variantesDe("matcha-clasico"))[0]!.precio_cents).toBe(875);
  });

  it("sin motivo no se cambia nada", async () => {
    const [v] = await variantesDe("matcha-clasico");
    await expect(
      db.query("select * from public.admin_catalogo_precio($1,$2,$3,$4,$5)", [
        duena,
        v!.id,
        1,
        "   ",
        null,
      ])
    ).rejects.toThrow(/motivo_obligatorio/);

    expect((await variantesDe("matcha-clasico"))[0]!.precio_cents).toBe(875);
    const log = await db.query("select 1 from public.audit_logs where action = 'menu_precio'");
    expect(log.rows).toHaveLength(0);
  });

  it("un precio negativo se rechaza", async () => {
    const [v] = await variantesDe("matcha-clasico");
    await expect(
      db.query("select * from public.admin_catalogo_precio($1,$2,$3,$4,$5)", [
        duena,
        v!.id,
        -100,
        "Motivo suficiente",
        null,
      ])
    ).rejects.toThrow(/precio_invalido/);
  });
});

describe("agotado — lo único que escribe el mostrador", () => {
  it("el empleado SÍ puede marcar agotado", async () => {
    const p = await productoPorSlug("donut-de-azucar");
    expect(p.disponible).toBe(true);

    await db.query("select * from public.admin_catalogo_disponibilidad($1,$2,$3,$4,$5)", [
      empleado,
      p.id,
      false,
      "Se acabó hoy",
      "req-2",
    ]);

    expect((await productoPorSlug("donut-de-azucar")).disponible).toBe(false);
  });

  it("y queda auditado con quién fue", async () => {
    const p = await productoPorSlug("donut-de-azucar");
    await db.query("select * from public.admin_catalogo_disponibilidad($1,$2,$3,$4,$5)", [
      empleado,
      p.id,
      false,
      "Se acabó hoy",
      null,
    ]);

    const log = await db.query<{ actor_user_id: string; after_data: Record<string, unknown> }>(
      "select actor_user_id, after_data from public.audit_logs where action = 'menu_disponibilidad'"
    );
    expect(log.rows[0]!.actor_user_id).toBe(empleado);
    expect(log.rows[0]!.after_data).toMatchObject({ disponible: false, slug: "donut-de-azucar" });
  });

  it("quien no es administrador no puede", async () => {
    const p = await productoPorSlug("donut-de-azucar");
    await expect(
      db.query("select * from public.admin_catalogo_disponibilidad($1,$2,$3,$4,$5)", [
        cliente,
        p.id,
        false,
        "Se acabó hoy",
        null,
      ])
    ).rejects.toThrow(/no_autorizado/);
  });
});

describe("archivar en vez de borrar", () => {
  it("archivar retira el producto pero no toca los favoritos", async () => {
    /*
      `favorites.item_slug` no tiene clave foránea. Si esto borrara de verdad,
      el favorito quedaría apuntando a la nada y la persona vería desaparecer
      algo que guardó, sin que nadie se entere.
    */
    await db.query("insert into public.favorites (user_id, item_slug) values ($1, 'glow-rose')", [
      cliente,
    ]);

    const p = await productoPorSlug("glow-rose");
    const r = await db.query<{ favoritos: number }>(
      "select * from public.admin_catalogo_producto_archivar($1,$2,$3,$4,$5)",
      [duena, p.id, true, "Fuera de temporada", null]
    );

    expect(r.rows[0]!.favoritos).toBe(1);

    // El producto sigue existiendo, solo marcado.
    const tras = await db.query<{ archivado_at: string | null }>(
      "select archivado_at from public.menu_productos where slug = 'glow-rose'"
    );
    expect(tras.rows[0]!.archivado_at).not.toBeNull();

    // Y el favorito sigue ahí.
    const fav = await db.query("select 1 from public.favorites where item_slug = 'glow-rose'");
    expect(fav.rows).toHaveLength(1);
  });

  it("el log dice a cuánta gente afectó", async () => {
    for (const email of ["a@t.test", "b@t.test", "c@t.test"]) {
      const u = await crearUsuario(db, { email });
      await db.query("insert into public.favorites (user_id, item_slug) values ($1, 'iced-latte')", [u]);
    }

    const p = await productoPorSlug("iced-latte");
    await db.query("select * from public.admin_catalogo_producto_archivar($1,$2,$3,$4,$5)", [
      duena,
      p.id,
      true,
      "Se retira de la carta",
      null,
    ]);

    const log = await db.query<{ after_data: Record<string, unknown> }>(
      "select after_data from public.audit_logs where action = 'menu_producto_archivado'"
    );
    expect(log.rows[0]!.after_data).toMatchObject({ favoritos_afectados: 3 });
  });

  it("se puede restaurar", async () => {
    const p = await productoPorSlug("glow-rose");
    await db.query("select * from public.admin_catalogo_producto_archivar($1,$2,$3,$4,$5)", [
      duena, p.id, true, "Fuera de temporada", null,
    ]);
    await db.query("select * from public.admin_catalogo_producto_archivar($1,$2,$3,$4,$5)", [
      duena, p.id, false, "Vuelve la temporada", null,
    ]);

    const tras = await db.query<{ archivado_at: string | null }>(
      "select archivado_at from public.menu_productos where slug = 'glow-rose'"
    );
    expect(tras.rows[0]!.archivado_at).toBeNull();
  });

  it("el empleado no puede archivar", async () => {
    const p = await productoPorSlug("glow-rose");
    await expect(
      db.query("select * from public.admin_catalogo_producto_archivar($1,$2,$3,$4,$5)", [
        empleado, p.id, true, "Intento", null,
      ])
    ).rejects.toThrow(/no_autorizado/);
  });
});

describe("reordenar sin chocar con el índice único", () => {
  it("invierte el orden de dos variantes del mismo producto", async () => {
    /*
      `menu_variantes` tiene `unique (producto_id, orden)`. Asignar los órdenes
      finales de uno en uno choca: para poner la 16 oz en la posición 1 hay que
      sacar antes a la 12 oz, y mientras tanto las dos valen 1.
    */
    const antes = await variantesDe("americano");
    expect(antes.map((v) => v.etiqueta)).toEqual(["12 oz", "16 oz"]);

    await db.query("select * from public.admin_catalogo_reordenar($1,$2,$3,$4,$5)", [
      duena,
      "variante",
      [antes[1]!.id, antes[0]!.id],
      "Primero el tamaño grande",
      null,
    ]);

    const despues = await variantesDe("americano");
    expect(despues.map((v) => v.etiqueta)).toEqual(["16 oz", "12 oz"]);
    // Y los precios viajaron con su etiqueta, no se quedaron en su posición.
    expect(despues[0]!.precio_cents).toBe(475);
  });

  it("reordena productos dentro de una categoría", async () => {
    const r = await db.query<{ id: string; slug: string }>(
      `select p.id, p.slug from public.menu_productos p
         join public.menu_categorias c on c.id = p.categoria_id
        where c.slug = 'matcha' order by p.orden`
    );
    const invertido = [...r.rows].reverse().map((x) => x.id);

    await db.query("select * from public.admin_catalogo_reordenar($1,$2,$3,$4,$5)", [
      duena, "producto", invertido, "Nuevo orden de la barra", null,
    ]);

    const tras = await db.query<{ slug: string }>(
      `select p.slug from public.menu_productos p
         join public.menu_categorias c on c.id = p.categoria_id
        where c.slug = 'matcha' order by p.orden`
    );
    expect(tras.rows[0]!.slug).toBe(r.rows.at(-1)!.slug);
  });

  it("rechaza un tipo inventado", async () => {
    await expect(
      db.query("select * from public.admin_catalogo_reordenar($1,$2,$3,$4,$5)", [
        duena, "loquesea", [duena], "Motivo suficiente", null,
      ])
    ).rejects.toThrow(/tipo_invalido/);
  });
});

describe("variantes", () => {
  it("no se puede quitar la última: un producto sin precio no se puede pedir", async () => {
    const v = await variantesDe("espresso");
    expect(v).toHaveLength(1);

    await expect(
      db.query("select * from public.admin_catalogo_variante_borrar($1,$2,$3,$4)", [
        duena, v[0]!.id, "Quitar tamaño", null,
      ])
    ).rejects.toThrow(/ultima_variante/);
  });

  it("sí se puede quitar una cuando hay dos", async () => {
    const v = await variantesDe("americano");
    await db.query("select * from public.admin_catalogo_variante_borrar($1,$2,$3,$4)", [
      duena, v[1]!.id, "Se deja de servir en 16 oz", null,
    ]);
    expect(await variantesDe("americano")).toHaveLength(1);
  });

  it("añadir una variante la pone al final", async () => {
    const p = await productoPorSlug("espresso");
    await db.query("select * from public.admin_catalogo_variante_crear($1,$2,$3,$4,$5,$6)", [
      duena, p.id, "doble", 450, "Nuevo tamaño", null,
    ]);
    const v = await variantesDe("espresso");
    expect(v).toHaveLength(2);
    expect(v[1]!.etiqueta).toBe("doble");
  });
});

describe("alta de producto", () => {
  it("crea con sus variantes y queda auditado", async () => {
    const cat = await db.query<{ id: string }>(
      "select id from public.menu_categorias where slug = 'matcha'"
    );

    await db.query("select * from public.admin_catalogo_producto_crear($1,$2,$3,$4,$5,$6,$7,$8,$9)", [
      duena,
      cat.rows[0]!.id,
      "matcha-de-temporada",
      "Matcha de Temporada",
      "Edición limitada",
      true,
      JSON.stringify([{ etiqueta: null, precio_cents: 950 }]),
      "Nueva bebida de temporada",
      null,
    ]);

    const v = await variantesDe("matcha-de-temporada");
    expect(v).toHaveLength(1);
    expect(v[0]!.precio_cents).toBe(950);

    const log = await db.query("select 1 from public.audit_logs where action = 'menu_producto_creado'");
    expect(log.rows).toHaveLength(1);
  });

  it("rechaza un slug repetido en vez de romper el índice", async () => {
    const cat = await db.query<{ id: string }>(
      "select id from public.menu_categorias where slug = 'matcha'"
    );
    await expect(
      db.query("select * from public.admin_catalogo_producto_crear($1,$2,$3,$4,$5,$6,$7,$8,$9)", [
        duena, cat.rows[0]!.id, "espresso", "Otro Espresso", null, false,
        JSON.stringify([{ etiqueta: null, precio_cents: 100 }]), "Motivo suficiente", null,
      ])
    ).rejects.toThrow(/slug_duplicado/);
  });

  it("rechaza un slug con mayúsculas o espacios", async () => {
    const cat = await db.query<{ id: string }>(
      "select id from public.menu_categorias where slug = 'matcha'"
    );
    for (const malo of ["Matcha Nuevo", "matcha_nuevo", "-matcha", "matcha--nuevo"]) {
      await expect(
        db.query("select * from public.admin_catalogo_producto_crear($1,$2,$3,$4,$5,$6,$7,$8,$9)", [
          duena, cat.rows[0]!.id, malo, "X", null, false,
          JSON.stringify([{ etiqueta: null, precio_cents: 100 }]), "Motivo suficiente", null,
        ])
      ).rejects.toThrow(/slug_invalido/);
    }
  });

  it("rechaza un producto sin variantes: no tendría precio", async () => {
    const cat = await db.query<{ id: string }>(
      "select id from public.menu_categorias where slug = 'matcha'"
    );
    await expect(
      db.query("select * from public.admin_catalogo_producto_crear($1,$2,$3,$4,$5,$6,$7,$8,$9)", [
        duena, cat.rows[0]!.id, "sin-precio", "Sin precio", null, false,
        JSON.stringify([]), "Motivo suficiente", null,
      ])
    ).rejects.toThrow(/sin_variantes/);
  });
});

describe("editar nombre", () => {
  it("cambiar el nombre NO cambia el slug", async () => {
    /*
      `favorites.item_slug` guarda el slug. Regenerarlo al renombrar dejaría
      huérfano cada favorito de ese producto en silencio. El slug es la
      identidad; el nombre es solo la etiqueta.
    */
    await db.query("insert into public.favorites (user_id, item_slug) values ($1, 'glow-rose')", [
      cliente,
    ]);

    const p = await productoPorSlug("glow-rose");
    await db.query("select * from public.admin_catalogo_producto_editar($1,$2,$3,$4,$5,$6,$7)", [
      duena, p.id, "Glow Rosa", "Mezcla Glow", true, "Se traduce el nombre", null,
    ]);

    const tras = await db.query<{ slug: string; nombre: string }>(
      "select slug, nombre from public.menu_productos where id = $1",
      [p.id]
    );
    expect(tras.rows[0]!.nombre).toBe("Glow Rosa");
    expect(tras.rows[0]!.slug).toBe("glow-rose");

    // El favorito sigue resolviendo.
    const fav = await db.query("select 1 from public.favorites where item_slug = 'glow-rose'");
    expect(fav.rows).toHaveLength(1);
  });
});

describe("permisos de las funciones", () => {
  it("ni anon ni authenticated pueden llamarlas", async () => {
    const p = await productoPorSlug("glow-rose");
    for (const rol of ["anon", "authenticated"]) {
      await db.exec(`set role ${rol}`);
      try {
        await expect(
          db.query("select * from public.admin_catalogo_disponibilidad($1,$2,$3,$4,$5)", [
            duena, p.id, false, "Motivo suficiente", null,
          ])
        ).rejects.toThrow();
      } finally {
        await db.exec("reset role");
      }
    }
  });

  it("el catálogo sigue siendo de solo lectura desde el navegador", async () => {
    await db.exec("set role authenticated");
    try {
      await db.query("update public.menu_variantes set precio_cents = 1");
    } catch {
      // Si RLS lo rechaza directamente, mejor.
    } finally {
      await db.exec("reset role");
    }
    // Lo que importa es que no cambió nada.
    expect((await variantesDe("matcha-clasico"))[0]!.precio_cents).toBe(875);
  });
});

describe("foto del producto", () => {
  const asignar = (
    productoId: string,
    clave: string | null,
    actor: string,
    motivo = "Ya tenemos foto de esta bebida"
  ) =>
    db.query<{ producto_id: string }>(
      "select * from public.admin_catalogo_producto_foto($1,$2,$3,$4)",
      [actor, productoId, clave, motivo]
    );

  const claveDe = async (slug: string) => {
    const r = await leerFresco<{ imagen_clave: string | null }>(
      db,
      "select imagen_clave from public.menu_productos where slug = $1",
      [slug]
    );
    return r[0]!.imagen_clave;
  };

  it("la dueña asigna una foto y queda auditado", async () => {
    const p = await productoPorSlug("matcha-clasico");
    await asignar(p.id, "siembraMatchaLattePromo", duena);

    expect(await claveDe("matcha-clasico")).toBe("siembraMatchaLattePromo");

    const log = await leerFresco<{ action: string; despues: string }>(
      db,
      `select action, after_data::text as despues from public.audit_logs
        where entity_type = 'menu_producto'`
    );
    expect(log[0]!.action).toBe("menu_producto_foto");
    expect(log[0]!.despues).toContain("siembraMatchaLattePromo");
  });

  it("cadena vacía quita la foto, no guarda una clave vacía", async () => {
    const p = await productoPorSlug("matcha-clasico");
    await asignar(p.id, "siembraMatchaLattePromo", duena);
    await asignar(p.id, "   ", duena, "Se retira la foto");

    expect(await claveDe("matcha-clasico")).toBeNull();
  });

  it("el mostrador no toca las fotos", async () => {
    const p = await productoPorSlug("matcha-clasico");
    await expect(asignar(p.id, "siembraMatchaLattePromo", empleado)).rejects.toThrow(
      /no_autorizado/
    );
  });

  it("exige motivo", async () => {
    const p = await productoPorSlug("matcha-clasico");
    await expect(asignar(p.id, "siembraMatchaLattePromo", duena, "   ")).rejects.toThrow(
      /motivo_obligatorio/
    );
  });

  it("un producto que no existe no se inventa", async () => {
    await expect(
      asignar("00000000-0000-0000-0000-000000000000", "x", duena)
    ).rejects.toThrow(/producto_no_encontrado/);
  });

  /*
    La prueba que no existía en ningún sitio del repo.

    Postgres concede EXECUTE a PUBLIC por defecto. Una función `security definer`
    que escriba en el catálogo y se olvide del bloque de revoke queda ejecutable
    por `anon`, y el fallo es silencioso: nada más lo detectaría.
  */
  it("anon y authenticated NO tienen privilegio de ejecución", async () => {
    const r = await leerFresco<{ de_anon: boolean; de_auth: boolean }>(
      db,
      `select
         has_function_privilege('anon',
           'public.admin_catalogo_producto_foto(uuid,uuid,text,text,text)', 'EXECUTE') as de_anon,
         has_function_privilege('authenticated',
           'public.admin_catalogo_producto_foto(uuid,uuid,text,text,text)', 'EXECUTE') as de_auth`
    );
    expect(r[0]!.de_anon).toBe(false);
    expect(r[0]!.de_auth).toBe(false);
  });
});

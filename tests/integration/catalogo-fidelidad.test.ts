import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { MENU } from "@/lib/site";
import { slugDeItem } from "@/lib/menu";
import { crearBase, type Db } from "./supabase-harness";

/**
 * El catálogo sembrado en `0011_catalogo.sql` dice EXACTAMENTE lo mismo que la
 * carta de `src/lib/site.ts`.
 *
 * `MENU` es la transcripción del PDF oficial y aquí hace de oráculo: la
 * migración pasó 30 productos de cadenas de texto a centavos enteros, y ese es
 * justo el tipo de trabajo donde se cuela un 8.75 convertido en 875 en un sitio
 * y en 8750 en otro sin que nadie lo note hasta que alguien cobra de más.
 *
 * La comprobación fuerte es la última: reconstruye el precio original a partir
 * de los centavos guardados y lo compara carácter a carácter con la cadena de
 * la que salió. Un solo dígito mal y este test falla.
 */
describe("catálogo vs. carta oficial", () => {
  let db: Db;

  type FilaCategoria = {
    slug: string;
    nombre_es: string;
    nombre_en: string;
    mundo: string;
    estado: string;
    etiqueta_tamanos: string | null;
    orden: number;
  };

  type FilaProducto = {
    categoria_slug: string;
    slug: string;
    nombre: string;
    nota_es: string | null;
    nota_en: string | null;
    destacado: boolean;
    es_modificador: boolean;
    orden: number;
    precios: string; // centavos concatenados por orden, p.ej. "425,475"
  };

  let categorias: FilaCategoria[];
  let productos: FilaProducto[];

  beforeAll(async () => {
    db = await crearBase();

    categorias = (
      await db.query<FilaCategoria>(
        "select slug, nombre_es, nombre_en, mundo, estado, etiqueta_tamanos, orden" +
          " from public.menu_categorias order by orden"
      )
    ).rows;

    productos = (
      await db.query<FilaProducto>(
        `select c.slug as categoria_slug, p.slug, p.nombre, p.nota_es, p.nota_en,
                p.destacado, p.es_modificador, p.orden,
                (select string_agg(v.precio_cents::text, ',' order by v.orden)
                   from public.menu_variantes v where v.producto_id = p.id) as precios
           from public.menu_productos p
           join public.menu_categorias c on c.id = p.categoria_id
          order by c.orden, p.orden`
      )
    ).rows;
  });

  afterAll(async () => {
    await db.close();
  });

  it("tiene las mismas secciones, en el mismo orden", () => {
    expect(categorias.map((c) => c.slug)).toEqual(MENU.map((s) => s.id));
  });

  it("cada sección conserva título, mundo, estado y etiqueta de tamaños", () => {
    for (const [i, seccion] of MENU.entries()) {
      const cat = categorias[i]!;
      expect(cat.nombre_es, `título es de ${seccion.id}`).toBe(seccion.titulo.es);
      expect(cat.nombre_en, `título en de ${seccion.id}`).toBe(seccion.titulo.en);
      expect(cat.mundo, `mundo de ${seccion.id}`).toBe(seccion.mundo);
      expect(cat.estado, `estado de ${seccion.id}`).toBe(seccion.status);
      // `sizes` opcional en el tipo, columna anulable en la tabla.
      expect(cat.etiqueta_tamanos, `tamaños de ${seccion.id}`).toBe(seccion.sizes ?? null);
    }
  });

  it("no sobra ni falta ningún producto", () => {
    const esperados = MENU.flatMap((s) => s.items.map((i) => `${s.id}/${i.nombre}`));
    const reales = productos.map((p) => `${p.categoria_slug}/${p.nombre}`);
    expect(reales).toEqual(esperados);
  });

  it("conserva la estrella del menú oficial y las notas", () => {
    const porClave = new Map(productos.map((p) => [`${p.categoria_slug}/${p.nombre}`, p]));

    for (const seccion of MENU) {
      for (const item of seccion.items) {
        const p = porClave.get(`${seccion.id}/${item.nombre}`)!;
        expect(p.destacado, `destacado de ${item.nombre}`).toBe(item.destacado === true);
        expect(p.nota_es, `nota es de ${item.nombre}`).toBe(item.nota?.es ?? null);
        expect(p.nota_en, `nota en de ${item.nombre}`).toBe(item.nota?.en ?? null);
      }
    }
  });

  it("los centavos reconstruyen EXACTAMENTE el precio original", () => {
    const porClave = new Map(productos.map((p) => [`${p.categoria_slug}/${p.nombre}`, p]));

    for (const seccion of MENU) {
      for (const item of seccion.items) {
        const p = porClave.get(`${seccion.id}/${item.nombre}`)!;
        expect(p.precios, `${item.nombre} se quedó sin variantes`).toBeTruthy();

        const reconstruido = p.precios
          .split(",")
          .map((c) => (Number(c) / 100).toFixed(2))
          .join(" / ");

        expect(reconstruido, `precio de ${item.nombre}`).toBe(item.precio);
      }
    }
  });

  it("un producto con dos precios tiene dos variantes etiquetadas, y uno solo ninguna", () => {
    // Sin esto, "4.25 / 4.75" podría haberse guardado como una única variante de
    // 425 centavos perdiendo el segundo tamaño, y el test de arriba lo cazaría
    // pero no diría por qué.
    const filas = productos.map((p) => ({ slug: p.slug, n: p.precios.split(",").length }));

    for (const { slug, n } of filas) {
      const item = MENU.flatMap((s) => s.items).find(
        (i) => productos.find((p) => p.slug === slug)!.nombre === i.nombre
      )!;
      expect(n, `variantes de ${slug}`).toBe(item.precio.includes("/") ? 2 : 1);
    }
  });

  it("el slug de cada producto es el que ya guardan los favoritos", () => {
    /*
      `favorites.item_slug` es clave primaria y guarda exactamente lo que
      devuelve `slugDeItem()`. Si el catálogo eligiera otro slug —"pizza-queso"
      en vez de "queso"—, cada favorito guardado hasta hoy quedaría huérfano en
      silencio: la fila seguiría ahí y el producto no aparecería nunca.

      Por eso el slug no se inventa: se deriva del nombre con la misma función.
    */
    for (const p of productos) {
      expect(p.slug, `slug de "${p.nombre}"`).toBe(slugDeItem(p.nombre));
    }
  });

  it("no hay dos productos con el mismo slug", () => {
    // `slugDeItem` puede colisionar si dos secciones repiten nombre, y la
    // columna es unique: la migración fallaría al aplicarse. Mejor verlo aquí.
    const slugs = productos.map((p) => p.slug);
    expect(new Set(slugs).size, "hay slugs repetidos").toBe(slugs.length);
  });

  it("los tamaños solo se etiquetan cuando hay más de uno", async () => {
    const sueltas = await db.query<{ slug: string; etiqueta: string | null }>(
      `select p.slug, v.etiqueta
         from public.menu_variantes v
         join public.menu_productos p on p.id = v.producto_id
        where (select count(*) from public.menu_variantes w where w.producto_id = p.id) = 1
          and v.etiqueta is not null`
    );
    // Un donut no necesita inventarse un tamaño que la carta no tiene.
    expect(sueltas.rows).toEqual([]);
  });
});

describe("modificadores del catálogo", () => {
  let db: Db;

  beforeAll(async () => {
    db = await crearBase();
  });

  afterAll(async () => {
    await db.close();
  });

  it("marca como modificador el shot extra y los seis extras, y nada más", async () => {
    const r = await db.query<{ slug: string }>(
      "select slug from public.menu_productos where es_modificador order by slug"
    );
    expect(r.rows.map((x) => x.slug)).toEqual([
      "acido-hialuronico",
      "colageno-peptidos",
      "creatina",
      "espirulina",
      "extra-shot",
      // El extra "Matcha" de la carta, no la sección "Barra de Matcha".
      "matcha",
      "semillas-de-chia",
    ]);
  });

  it("los extras se pueden añadir a cualquier bebida, que es lo que dice la carta", async () => {
    const r = await db.query<{ n: number }>(
      `select count(*)::int as n
         from public.menu_modificadores_permitidos mp
         join public.menu_productos base on base.id = mp.producto_id
         join public.menu_categorias c on c.id = base.categoria_id
        where c.mundo in ('matcha', 'cafe', 'piel')`
    );
    expect(r.rows[0]!.n).toBeGreaterThan(0);
  });

  it("no se le echa espirulina a un sándwich", async () => {
    const r = await db.query<{ n: number }>(
      `select count(*)::int as n
         from public.menu_modificadores_permitidos mp
         join public.menu_productos base on base.id = mp.producto_id
         join public.menu_categorias c on c.id = base.categoria_id
        where c.mundo = 'comida'`
    );
    expect(r.rows[0]!.n).toBe(0);
  });

  it("ningún modificador se puede añadir a sí mismo", async () => {
    const r = await db.query<{ n: number }>(
      "select count(*)::int as n from public.menu_modificadores_permitidos" +
        " where producto_id = modificador_id"
    );
    expect(r.rows[0]!.n).toBe(0);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { slugDeItem } from "@/lib/menu";
import { precioDeCarta } from "@/lib/catalogo/tipos";
import { crearBase, type Db } from "./supabase-harness";

/**
 * La sección «Coffee Party» de `0024` dice lo mismo que el flyer del soft
 * opening.
 *
 * Mismo criterio que `catalogo-fidelidad`: el oráculo son los precios TAL COMO
 * están impresos, en dólares y centavos, y la prueba fuerte reconstruye esa
 * cadena a partir de los centavos guardados. Un 895 escrito como 89 o como 8950
 * pasaría cualquier revisión de código y lo caza esto.
 */

/** El flyer, transcrito. `precio` es lo que se lee impreso. */
const FLYER = [
  { nombre: "Siembra Rolls (Trio)", precio: "14.95", sabores: [] },
  { nombre: "Dupleta (2 Empanadas)", precio: "9.95", sabores: [] },
  { nombre: "Donas", precio: "4.75", sabores: ["Matcha", "Nutella", "Azúcar Glaze"] },
  { nombre: "Mango Matcha Pop", precio: "7.95", sabores: [] },
  { nombre: "Galletas de Chocolate Chip con Matcha", precio: "4.95", sabores: [] },
  { nombre: "Coffee Bar", precio: "8.95", sabores: ["Iced Latte", "Espresso", "Cortadito"] },
  { nombre: "Matcha Vanilla", precio: "8.95", sabores: [] },
  { nombre: "Matcha Strawberry", precio: "8.95", sabores: [] },
  { nombre: "Matcha Coconut Water", precio: "8.95", sabores: [] },
  { nombre: "Matcha Mango", precio: "8.95", sabores: [] },
  { nombre: "Matcha Banana & Honey", precio: "8.95", sabores: [] },
] as const;

describe("Coffee Party — carta del soft opening", () => {
  let db: Db;

  type Fila = {
    slug: string;
    nombre: string;
    nota_es: string | null;
    nota_en: string | null;
    disponible: boolean;
    es_modificador: boolean;
    imagen_clave: string | null;
    orden: number;
    /** Centavos por orden, p. ej. "475,475,475". */
    precios: string | null;
    /** Etiquetas por orden; NULL se pierde en string_agg, por eso el coalesce. */
    etiquetas: string | null;
  };

  let productos: Fila[];

  beforeAll(async () => {
    db = await crearBase();

    productos = (
      await db.query<Fila>(
        `select p.slug, p.nombre, p.nota_es, p.nota_en, p.disponible, p.es_modificador,
                p.imagen_clave, p.orden,
                (select string_agg(v.precio_cents::text, ',' order by v.orden)
                   from public.menu_variantes v where v.producto_id = p.id) as precios,
                (select string_agg(coalesce(v.etiqueta, ''), ',' order by v.orden)
                   from public.menu_variantes v where v.producto_id = p.id) as etiquetas
           from public.menu_productos p
           join public.menu_categorias c on c.id = p.categoria_id
          where c.slug = 'coffee-party'
          order by p.orden`
      )
    ).rows;
  });

  afterAll(async () => {
    await db.close();
  });

  it("la sección existe, va primera y sale en la carta de hoy", async () => {
    const r = await db.query<{
      nombre_es: string;
      nombre_en: string;
      mundo: string;
      estado: string;
      etiqueta_tamanos: string | null;
      orden: number;
    }>(
      `select nombre_es, nombre_en, mundo, estado, etiqueta_tamanos, orden
         from public.menu_categorias where slug = 'coffee-party'`
    );

    expect(r.rows).toHaveLength(1);
    const c = r.rows[0]!;
    expect(c.nombre_es).toBe("Coffee Party");
    expect(c.nombre_en).toBe("Coffee Party");
    expect(c.mundo).toBe("cafe");
    // `hoy` es lo que la pone en «Lo que puedes pedir hoy» de /menu; con
    // `pronto` se pintaría bajo «Próximamente» y nadie podría pedirla.
    expect(c.estado).toBe("hoy");
    expect(c.etiqueta_tamanos).toBe("Soft Opening");
    expect(c.orden).toBe(0);
  });

  it("no desordenó ninguna de las nueve secciones que ya estaban", async () => {
    // Meterla delante con `orden = 0` no debe haber tocado a las demás: si
    // alguien las renumerase, esto lo diría antes de que la carta pública
    // saliera barajada.
    const r = await db.query<{ slug: string; orden: number }>(
      "select slug, orden from public.menu_categorias where slug <> 'coffee-party' order by orden"
    );
    expect(r.rows.map((x) => `${x.slug}:${x.orden}`)).toEqual([
      "matcha:1",
      "cafes:2",
      "piel:3",
      "pasteleria:4",
      "sandwiches:5",
      "frios:6",
      "extras:7",
      "pizzas:8",
      "llevar:9",
    ]);
  });

  it("tiene los once productos del flyer, en el orden en que están impresos", () => {
    expect(productos.map((p) => p.nombre)).toEqual(FLYER.map((f) => f.nombre));
  });

  it("los centavos reconstruyen EXACTAMENTE el precio impreso", () => {
    for (const [i, esperado] of FLYER.entries()) {
      const p = productos[i]!;
      expect(p.precios, `${esperado.nombre} se quedó sin precio`).toBeTruthy();

      for (const centavos of p.precios!.split(",")) {
        expect((Number(centavos) / 100).toFixed(2), `precio de ${esperado.nombre}`).toBe(
          esperado.precio
        );
      }
    }
  });

  it("las filas con elección llevan una variante por sabor, y el resto ninguna", () => {
    /*
      El flyer viñetea dos cosas distintas con la misma viñeta. Aquí se separa:
      donde se ELIGE hay variantes etiquetadas —y en /pedir salen como botones,
      «Nutella · 4.75»—; donde la viñeta solo describe lo que viene dentro, no.

      Una variante sin etiqueta y sola es lo correcto para un producto de un
      solo precio: un Mango Matcha Pop no tiene que inventarse un tamaño.
    */
    for (const [i, esperado] of FLYER.entries()) {
      const p = productos[i]!;
      const etiquetas = p.etiquetas!.split(",");

      if (esperado.sabores.length > 0) {
        expect(etiquetas, `sabores de ${esperado.nombre}`).toEqual([...esperado.sabores]);
      } else {
        expect(etiquetas, `${esperado.nombre} no debería tener variantes`).toEqual([""]);
      }
    }
  });

  it("cada sabor del mismo precio se anuncia una sola vez en la carta", () => {
    // Las tres donas cuestan 4.75. Sin deduplicar, /menu pintaría
    // «4.75 / 4.75 / 4.75», que se lee como si costaran catorce dólares.
    const donas = productos.find((p) => p.slug === "donas")!;
    const variantes = donas
      .precios!.split(",")
      .map((c, i) => ({ id: String(i), etiqueta: null, precioCents: Number(c) }));

    expect(variantes).toHaveLength(3);
    expect(precioDeCarta(variantes)).toBe("4.75");
  });

  it("conserva los ingredientes del Matcha Bar en los dos idiomas", () => {
    const porSlug = new Map(productos.map((p) => [p.slug, p]));

    // Cinco bebidas con ingredientes distintos: es justo lo que no cabe en una
    // variante —que solo lleva etiqueta y precio— y por lo que van sueltas.
    expect(porSlug.get("matcha-vanilla")!.nota_es).toBe(
      "Cold foam, matcha, oat milk, sirope de vainilla"
    );
    expect(porSlug.get("matcha-vanilla")!.nota_en).toBe(
      "Cold foam, matcha, oat milk, vanilla syrup"
    );
    expect(porSlug.get("matcha-coconut-water")!.nota_es).toBe("Cold foam, matcha, agua de coco");
    expect(porSlug.get("matcha-banana-honey")!.nota_es).toBe(
      "Cold foam, matcha, oat milk, guineo y miel"
    );

    for (const slug of [
      "matcha-vanilla",
      "matcha-strawberry",
      "matcha-coconut-water",
      "matcha-mango",
      "matcha-banana-honey",
    ]) {
      const p = porSlug.get(slug)!;
      expect(p.nota_es, `nota es de ${slug}`).toBeTruthy();
      expect(p.nota_en, `nota en de ${slug}`).toBeTruthy();
    }
  });

  it("el slug sale del nombre, como el que guardan los favoritos", () => {
    for (const p of productos) {
      expect(p.slug, `slug de "${p.nombre}"`).toBe(slugDeItem(p.nombre));
    }
  });

  it("se puede pedir: disponible, con precio y sin ser modificador", () => {
    /*
      `Carrito.tsx` filtra por `disponible && variantes.length > 0`. Un producto
      sin variante no da error: desaparece de /pedir en silencio, que es peor.
    */
    for (const p of productos) {
      expect(p.disponible, `${p.nombre} nace agotado`).toBe(true);
      expect(p.es_modificador, `${p.nombre} nace como extra`).toBe(false);
      expect(p.precios, `${p.nombre} no se puede pedir sin precio`).toBeTruthy();
    }
  });

  it("nace sin fotos, en vez de con fotos inventadas", () => {
    // El flyer trae fotos, pero no están en `public/brand/originals/` y por
    // tanto no existen en el manifiesto. `docs/11`: el asset que falta se lista
    // y se para. Se asignan desde el panel cuando entren.
    for (const p of productos) {
      expect(p.imagen_clave, `${p.nombre} salió con foto de la nada`).toBeNull();
    }
  });
});

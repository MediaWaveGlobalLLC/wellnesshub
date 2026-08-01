-- ─────────────────────────────────────────────────────────────────────────────
-- 0024 — Coffee Party: la carta del soft opening.
--
-- Transcripción del flyer oficial de SIEMBRA («SOFT OPENING PRESENTS — Coffee
-- Party»). Mismo criterio que `0011`: nada inventado, precios en centavos
-- enteros, y el slug derivado del nombre con la misma regla que `slugDeItem()`
-- para que un favorito guardado apunte a algo.
--
-- POR QUÉ UNA MIGRACIÓN Y NO EL PANEL
-- El panel de `0015`/`0022`/`0023` puede hacer esto y la dueña lo hará para el
-- día a día. Pero son 11 productos con 15 variantes de una tirada: metidos a
-- mano son 40 formularios y ningún sitio donde revisar el resultado antes de
-- que esté en la carta pública. Aquí queda versionado, revisable y con una
-- prueba que reconstruye cada precio contra el flyer.
--
-- CÓMO SE MODELA CADA FILA DEL FLYER
-- El flyer pone viñetas debajo de casi todo, pero no significan lo mismo:
--
--  · «Siembra Rolls (Trio)» viñeta lo que VIENE dentro —los tres a la vez—, así
--    que es una nota, no una elección.
--  · «Donas» y «Coffee Bar» viñetan lo que ELIGES, todo al mismo precio: eso son
--    variantes. En `/pedir` cada variante es un botón («Nutella · 4.75»), que es
--    exactamente la forma de pedir un sabor.
--  · El Matcha Bar viñeta cinco bebidas con INGREDIENTES distintos cada una. Una
--    variante solo lleva etiqueta y precio: no tiene dónde guardar «cold foam,
--    matcha, oat milk, puré de fresa». Por eso van como cinco productos.
--
-- LO QUE NO SE SIEMBRA
--  · «¡Mas!» del Coffee Bar no es un producto; queda como nota de la fila.
--  · Ninguna foto. El flyer trae fotos preciosas pero no están en
--    `public/brand/originals/`, y `docs/11` es explícito: el asset que falta se
--    lista y se para, no se sustituye. Se asignan desde el panel (botón FOTO)
--    en cuanto entren al manifiesto.
--  · Ningún modificador enganchado. Los extras de `0011` se sembraron una vez
--    para la carta de entonces; una barra de evento con precio único no es el
--    sitio para empezar a sumar dólares por encima.
-- ─────────────────────────────────────────────────────────────────────────────

/*
  `orden = 0`, o sea la primera de la carta.

  Las demás secciones van de 1 a 9 y no se tocan: renumerarlas para meter esta
  delante habría movido nueve filas para colocar una. Cero cabe delante sin
  pedirle permiso a nadie, y `menu_categorias.orden` es un integer sin más.

  Y va delante porque es la carta del evento que está pasando: enterrada bajo
  «Para Llevar (pronto)» no la vería quien viene por el soft opening.
*/
insert into public.menu_categorias
  (slug, nombre_es, nombre_en, mundo, estado, etiqueta_tamanos, orden) values
  ('coffee-party', 'Coffee Party', 'Coffee Party', 'cafe', 'hoy', 'Soft Opening', 0)
on conflict (slug) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Productos
-- ─────────────────────────────────────────────────────────────────────────────
/*
  Los nombres del Matcha Bar llevan «Matcha» delante y el flyer no.

  En el flyer la palabra la pone la cabecera de la sección, que está justo
  encima. En un carrito no hay cabecera: la línea diría «Vanilla», y en la
  comanda del local eso no es una bebida, es un adjetivo. «Matcha Vanilla»
  conserva el nombre y dice qué es.

  El «Cortadito» va en singular por la misma razón: se pide uno.
*/
insert into public.menu_productos
  (categoria_id, slug, nombre, nota_es, nota_en, destacado, es_modificador, orden)
select c.id, p.slug, p.nombre, p.nota_es, p.nota_en, p.destacado, p.es_modificador, p.orden
  from (values
    ('siembra-rolls-trio',
     'Siembra Rolls (Trio)',
     'Pan dulce: peanut butter, pavo y suizo, forest ham y cheddar',
     'Sweet bread: peanut butter, turkey and swiss, forest ham and cheddar',
     false, false, 1),

    ('dupleta-2-empanadas',
     'Dupleta (2 Empanadas)',
     'Pollo, carne o queso',
     'Chicken, beef or cheese',
     false, false, 2),

    -- Sin nota: los tres sabores son las variantes, y repetirlos aquí sería
    -- decir dos veces lo mismo en la misma fila.
    ('donas', 'Donas', null, null, false, false, 3),

    ('mango-matcha-pop',
     'Mango Matcha Pop',
     'Paleta de mango 100% natural, cubierta en coco y drizzle de matcha',
     '100% natural mango pop, coconut coated with a matcha drizzle',
     false, false, 4),

    ('galletas-de-chocolate-chip-con-matcha',
     'Galletas de Chocolate Chip con Matcha',
     'Paquete de 2',
     'Pack of 2',
     false, false, 5),

    -- El «¡Mas!» del flyer, que no es un producto pero sí es una promesa.
    ('coffee-bar', 'Coffee Bar', 'Y más en barra', 'And more at the bar',
     false, false, 6),

    ('matcha-vanilla', 'Matcha Vanilla',
     'Cold foam, matcha, oat milk, sirope de vainilla',
     'Cold foam, matcha, oat milk, vanilla syrup',
     false, false, 7),

    ('matcha-strawberry', 'Matcha Strawberry',
     'Cold foam, matcha, oat milk, puré de fresa',
     'Cold foam, matcha, oat milk, strawberry purée',
     false, false, 8),

    ('matcha-coconut-water', 'Matcha Coconut Water',
     'Cold foam, matcha, agua de coco',
     'Cold foam, matcha, coconut water',
     false, false, 9),

    ('matcha-mango', 'Matcha Mango',
     'Cold foam, matcha, oat milk, puré de mango',
     'Cold foam, matcha, oat milk, mango purée',
     false, false, 10),

    ('matcha-banana-honey', 'Matcha Banana & Honey',
     'Cold foam, matcha, oat milk, guineo y miel',
     'Cold foam, matcha, oat milk, banana & honey',
     false, false, 11)
  ) as p(slug, nombre, nota_es, nota_en, destacado, es_modificador, orden)
  cross join (select id from public.menu_categorias where slug = 'coffee-party') as c
on conflict (slug) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Precios
-- ─────────────────────────────────────────────────────────────────────────────
/*
  Centavos enteros. $14.95 es 1495, no 14.95: un carrito que suma en coma
  flotante acaba cobrando un centavo de más o de menos, y eso en dinero no es
  una curiosidad, es un descuadre.

  `etiqueta` va NULL cuando el producto tiene un solo precio —una paleta no
  necesita inventarse un tamaño— y lleva el sabor cuando hay que elegir.
*/
insert into public.menu_variantes (producto_id, etiqueta, precio_cents, orden)
select pr.id, v.etiqueta, v.precio_cents, v.orden
  from (values
    ('siembra-rolls-trio',                    null,           1495, 1),
    ('dupleta-2-empanadas',                   null,            995, 1),
    -- $4.75 c/u, elige sabor.
    ('donas',                                 'Matcha',        475, 1),
    ('donas',                                 'Nutella',       475, 2),
    ('donas',                                 'Azúcar Glaze',  475, 3),
    ('mango-matcha-pop',                      null,            795, 1),
    ('galletas-de-chocolate-chip-con-matcha', null,            495, 1),
    -- $8.95 c/u en la barra.
    ('coffee-bar',                            'Iced Latte',    895, 1),
    ('coffee-bar',                            'Espresso',      895, 2),
    ('coffee-bar',                            'Cortadito',     895, 3),
    -- Matcha Bar, $8.95 c/u.
    ('matcha-vanilla',                        null,            895, 1),
    ('matcha-strawberry',                     null,            895, 1),
    ('matcha-coconut-water',                  null,            895, 1),
    ('matcha-mango',                          null,            895, 1),
    ('matcha-banana-honey',                   null,            895, 1)
  ) as v(producto_slug, etiqueta, precio_cents, orden)
  join public.menu_productos pr on pr.slug = v.producto_slug
on conflict (producto_id, orden) do nothing;

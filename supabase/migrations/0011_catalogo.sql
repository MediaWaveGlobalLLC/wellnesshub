-- ─────────────────────────────────────────────────────────────────────────────
-- 0011 — Catálogo real: el menú deja de ser texto y pasa a ser datos.
--
-- Hasta ahora el menú vivía en `src/lib/site.ts` como transcripción del PDF
-- oficial, y no servía para pedir:
--
--   { nombre: "Americano", precio: "4.25 / 4.75" }
--
-- El precio era una CADENA con dos precios dentro. No se puede sumar un carrito
-- con eso, ningún producto tenía identificador con el que referirse a él, y los
-- extras eran una sección suelta en vez de algo enganchable a una bebida.
--
-- Aquí el precio pasa a centavos enteros, como el wallet y las gift cards. Un
-- pedido no puede tener un total en coma flotante: 0.1 + 0.2 no es 0.3, y en
-- dinero eso no es una curiosidad, es un descuadre.
--
-- CONTENIDO IDÉNTICO AL ACTUAL. No se añade, quita ni renombra ningún producto
-- y no se cambia ningún precio: `tests/integration/catalogo-fidelidad.test.ts`
-- compara fila por fila contra la constante MENU original y falla si difieren.
--
-- Los `clover_*_id` van vacíos a propósito. Si algún día se integra el punto de
-- venta, el enganche ya tiene dónde ir; ver `docs/17_PEDIDOS_ONLINE_CLOVER.md`.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.menu_categorias (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nombre_es text not null,
  nombre_en text not null,
  -- El "mundo" decide el color de la sección en /menu. Mismos valores que el
  -- tipo MenuSection de site.ts, para que la página no cambie de aspecto.
  mundo text not null check (mundo in ('cafe', 'matcha', 'piel', 'comida')),
  estado text not null check (estado in ('hoy', 'pronto')),
  -- Etiqueta que se pinta junto al título ("16 oz", "+ $1.00"). Es rótulo, no
  -- dato: los tamaños de verdad viven en menu_variantes.
  etiqueta_tamanos text,
  orden integer not null,
  clover_categoria_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.menu_productos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.menu_categorias(id) on delete cascade,
  slug text not null unique,
  nombre text not null,
  nota_es text,
  nota_en text,
  -- La estrella del menú oficial.
  destacado boolean not null default false,
  -- Agotado hoy. Se apaga desde administración sin tocar el catálogo ni desplegar.
  disponible boolean not null default true,
  /*
    Un modificador es un producto que además puede engancharse a otro: el shot
    extra, el colágeno, la espirulina. Siguen siendo productos y siguen saliendo
    en su sección de /menu exactamente como hoy —el menú oficial los lista así—,
    pero el motor de pedidos puede ofrecerlos como añadido de una bebida.

    Modelarlos como tabla aparte habría duplicado su precio en dos sitios, que
    es como se acaba cobrando $1.00 en la carta y $1.25 en el carrito.
  */
  es_modificador boolean not null default false,
  orden integer not null,
  clover_item_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists menu_productos_categoria_idx
  on public.menu_productos (categoria_id, orden);

create table if not exists public.menu_variantes (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.menu_productos(id) on delete cascade,
  -- NULL cuando el producto tiene un solo tamaño. Así un donut no necesita
  -- inventarse una etiqueta que el menú no tiene.
  etiqueta text,
  precio_cents integer not null check (precio_cents >= 0),
  orden integer not null,
  clover_variante_id text,
  unique (producto_id, orden)
);

create index if not exists menu_variantes_producto_idx
  on public.menu_variantes (producto_id, orden);

/*
  Qué modificador se puede añadir a qué producto.

  Se siembra con la regla que YA está escrita en la carta —«Los extras se añaden
  a cualquier bebida por $1.00»— y no con una lista inventada. Si mañana resulta
  que la creatina no va en el café, se corrige aquí sin tocar código.
*/
create table if not exists public.menu_modificadores_permitidos (
  producto_id uuid not null references public.menu_productos(id) on delete cascade,
  modificador_id uuid not null references public.menu_productos(id) on delete cascade,
  primary key (producto_id, modificador_id),
  -- Un producto no puede ser modificador de sí mismo.
  check (producto_id <> modificador_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: el catálogo es público de leer y de nadie de escribir.
--
-- Escribir no tiene política, así que solo entra `service_role` (que salta RLS)
-- desde el servidor. Un cliente con la clave publicable puede leer la carta
-- —igual que quien pasa por la puerta— y nada más.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.menu_categorias enable row level security;
alter table public.menu_productos enable row level security;
alter table public.menu_variantes enable row level security;
alter table public.menu_modificadores_permitidos enable row level security;

drop policy if exists "catalogo lectura publica" on public.menu_categorias;
create policy "catalogo lectura publica" on public.menu_categorias
  for select to anon, authenticated using (true);

drop policy if exists "catalogo lectura publica" on public.menu_productos;
create policy "catalogo lectura publica" on public.menu_productos
  for select to anon, authenticated using (true);

drop policy if exists "catalogo lectura publica" on public.menu_variantes;
create policy "catalogo lectura publica" on public.menu_variantes
  for select to anon, authenticated using (true);

drop policy if exists "catalogo lectura publica" on public.menu_modificadores_permitidos;
create policy "catalogo lectura publica" on public.menu_modificadores_permitidos
  for select to anon, authenticated using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Siembra — transcripción exacta de MENU en `src/lib/site.ts`.
--
-- Idempotente: `on conflict do nothing` en categorías y productos para que
-- reaplicar la migración no duplique la carta ni pise un precio que se haya
-- cambiado desde administración.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.menu_categorias (slug, nombre_es, nombre_en, mundo, estado, etiqueta_tamanos, orden) values
  ('matcha',      'Barra de Matcha',        'Matcha Bar',          'matcha', 'hoy',    '16 oz',       1),
  ('cafes',       'Cafés Calientes y Fríos','Hot & Cold Coffees',  'cafe',   'hoy',    null,          2),
  ('piel',        'Bebidas para tu Piel',   'Drinks for your Skin','piel',   'hoy',    '16 oz',       3),
  ('pasteleria',  'Pastelería',             'Pastries',            'comida', 'hoy',    null,          4),
  ('sandwiches',  'Sándwiches',             'Sandwiches',          'comida', 'hoy',    null,          5),
  ('frios',       'Favoritos Fríos',        'Cold Favorites',      'cafe',   'pronto', '12 oz / 16 oz', 6),
  ('extras',      'Extras',                 'Extras',              'piel',   'pronto', '+ $1.00',     7),
  ('pizzas',      'Pizzas Personales',      'Personal Pizzas',     'comida', 'pronto', null,          8),
  ('llevar',      'Para Llevar',            'To Go',               'comida', 'pronto', null,          9)
on conflict (slug) do nothing;

-- Productos. El precio NO va aquí: va en menu_variantes, porque un producto
-- puede tener dos tamaños con dos precios distintos.
insert into public.menu_productos
  (categoria_id, slug, nombre, nota_es, nota_en, destacado, es_modificador, orden)
select c.id, p.slug, p.nombre, p.nota_es, p.nota_en, p.destacado, p.es_modificador, p.orden
  from (values
    -- Barra de Matcha
    ('matcha',     'matcha-clasico',           'Matcha Clásico',           null,               null,              false, false, 1),
    ('matcha',     'fresa-glow',               'Fresa Glow',               null,               null,              false, false, 2),
    ('matcha',     'mango-radiance',           'Mango Radiance',           null,               null,              true,  false, 3),
    ('matcha',     'platano-mellow',           'Plátano Mellow',           null,               null,              false, false, 4),
    ('matcha',     'matcha-refrescante',       'Matcha Refrescante',       null,               null,              false, false, 5),
    -- Cafés Calientes y Fríos
    ('cafes',      'espresso',                 'Espresso',                 null,               null,              false, false, 1),
    ('cafes',      'cortado',                  'Cortado',                  null,               null,              false, false, 2),
    ('cafes',      'americano',                'Americano',                null,               null,              false, false, 3),
    ('cafes',      'latte',                    'Latte',                    null,               null,              false, false, 4),
    ('cafes',      'extra-shot',               'Extra Shot',               null,               null,              false, true,  5),
    -- Bebidas para tu Piel
    ('piel',       'glow-rose',                'Glow Rose',                'Mezcla Glow',      'Glow Blend',      false, false, 1),
    ('piel',       'tropical-sun',             'Tropical Sun',             'Energía Tropical', 'Tropical Energy', false, false, 2),
    ('piel',       'blue-calm',                'Blue Calm',                'Recuperación',     'Recovery',        false, false, 3),
    -- Pastelería
    ('pasteleria', 'donut-de-azucar',          'Donut de Azúcar',          null,               null,              false, false, 1),
    ('pasteleria', 'donut-de-queso',           'Donut de Queso',           null,               null,              false, false, 2),
    -- Sándwiches
    ('sandwiches', 'sandwich-mallorca',        'Sandwich Mallorca',        null,               null,              false, false, 1),
    -- Favoritos Fríos
    ('frios',      'iced-latte',               'Iced Latte',               null,               null,              true,  false, 1),
    ('frios',      'latte-con-sabor',          'Latte con Sabor',          null,               null,              false, false, 2),
    ('frios',      'iced-chai-latte',          'Iced Chai Latte',          null,               null,              false, false, 3),
    -- Extras (todos modificadores)
    ('extras',     'colageno-peptidos',        'Colágeno Péptidos',        null,               null,              false, true,  1),
    ('extras',     'acido-hialuronico',        'Ácido Hialurónico',        null,               null,              false, true,  2),
    ('extras',     'espirulina',               'Espirulina',               null,               null,              false, true,  3),
    ('extras',     'creatina',                 'Creatina',                 null,               null,              false, true,  4),
    ('extras',     'matcha',                   'Matcha',                   null,               null,              false, true,  5),
    ('extras',     'semillas-de-chia',         'Semillas de Chía',         null,               null,              false, true,  6),
    -- Pizzas Personales
    ('pizzas',     'queso',                    'Queso',                    null,               null,              false, false, 1),
    ('pizzas',     'veggie',                   'Veggie',                   null,               null,              false, false, 2),
    ('pizzas',     'pepperoni',                'Pepperoni',                null,               null,              false, false, 3),
    -- Para Llevar
    ('llevar',     'yogurt-parfait',           'Yogurt Parfait',           null,               null,              false, false, 1),
    ('llevar',     'pudin-de-chia-con-matcha', 'Pudín de Chía con Matcha', null,               null,              false, false, 2)
  ) as p(categoria_slug, slug, nombre, nota_es, nota_en, destacado, es_modificador, orden)
  join public.menu_categorias c on c.slug = p.categoria_slug
on conflict (slug) do nothing;

/*
  Variantes y precios en centavos.

  Los cinco productos con dos precios llevan dos filas. En «Favoritos Fríos» la
  carta rotula «12 oz / 16 oz»; en «Cafés» no rotula nada aunque Americano y
  Latte tengan dos precios, así que se aplica la convención documentada en el
  tipo MenuItem de site.ts. PENDIENTE de confirmar con el local: hoy el cliente
  ve «4.25 / 4.75» sin que nada le diga a qué tamaño corresponde cada número.
*/
insert into public.menu_variantes (producto_id, etiqueta, precio_cents, orden)
select pr.id, v.etiqueta, v.precio_cents, v.orden
  from (values
    ('matcha-clasico',           null,    875, 1),
    ('fresa-glow',               null,    895, 1),
    ('mango-radiance',           null,    895, 1),
    ('platano-mellow',           null,    895, 1),
    ('matcha-refrescante',       null,    875, 1),
    ('espresso',                 null,    275, 1),
    ('cortado',                  null,    375, 1),
    ('americano',                '12 oz', 425, 1),
    ('americano',                '16 oz', 475, 2),
    ('latte',                    '12 oz', 625, 1),
    ('latte',                    '16 oz', 725, 2),
    ('extra-shot',               null,    150, 1),
    ('glow-rose',                null,    995, 1),
    ('tropical-sun',             null,    995, 1),
    ('blue-calm',                null,    995, 1),
    ('donut-de-azucar',          null,    195, 1),
    ('donut-de-queso',           null,    295, 1),
    ('sandwich-mallorca',        null,    900, 1),
    ('iced-latte',               '12 oz', 725, 1),
    ('iced-latte',               '16 oz', 795, 2),
    ('latte-con-sabor',          '12 oz', 775, 1),
    ('latte-con-sabor',          '16 oz', 825, 2),
    ('iced-chai-latte',          '12 oz', 725, 1),
    ('iced-chai-latte',          '16 oz', 825, 2),
    ('colageno-peptidos',        null,    100, 1),
    ('acido-hialuronico',        null,    100, 1),
    ('espirulina',               null,    100, 1),
    ('creatina',                 null,    100, 1),
    ('matcha',                   null,    100, 1),
    ('semillas-de-chia',         null,    100, 1),
    ('queso',                    null,    400, 1),
    ('veggie',                   null,    450, 1),
    ('pepperoni',                null,    425, 1),
    ('yogurt-parfait',           null,    750, 1),
    ('pudin-de-chia-con-matcha', null,    895, 1)
  ) as v(producto_slug, etiqueta, precio_cents, orden)
  join public.menu_productos pr on pr.slug = v.producto_slug
on conflict (producto_id, orden) do nothing;

/*
  Qué se puede añadir a qué.

  Regla 1 — los Extras van en cualquier bebida. Es literalmente lo que dice la
  carta, así que se aplica a los mundos de bebida (matcha, cafe, piel) y no a la
  comida: nadie le echa espirulina a una mallorca.

  Regla 2 — el shot extra solo en café.

  Ambas son deducciones del texto oficial, no política del local. Si el local
  dice otra cosa, se corrigen filas, no código.
*/
insert into public.menu_modificadores_permitidos (producto_id, modificador_id)
select base.id, modif.id
  from public.menu_productos base
  join public.menu_categorias cb on cb.id = base.categoria_id
  cross join lateral (
    select m.id, cm.slug as cat_slug
      from public.menu_productos m
      join public.menu_categorias cm on cm.id = m.categoria_id
     where m.es_modificador
  ) as modif
 where base.es_modificador = false
   and cb.mundo in ('matcha', 'cafe', 'piel')
   and (modif.cat_slug = 'extras' or cb.mundo = 'cafe')
on conflict do nothing;

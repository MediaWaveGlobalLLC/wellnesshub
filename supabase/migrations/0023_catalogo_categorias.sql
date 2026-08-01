-- ─────────────────────────────────────────────────────────────────────────────
-- 0023 — Las categorías, que no tenían ninguna forma de gestionarse.
--
-- `0015` dio a la dueña control sobre los productos —precio, agotado, alta,
-- edición, archivado, tamaños, orden— pero las secciones de la carta seguían
-- siendo intocables: añadir «Bebidas de temporada» exigía SQL a mano.
--
-- Aquí van las tres que faltaban. Mismo guion que `0015`: rol comprobado EN SQL,
-- motivo obligatorio, captura del antes y `audit_logs` en la misma transacción.
-- ─────────────────────────────────────────────────────────────────────────────

/*
  El slug se deriva del nombre, no lo escribe nadie.

  Es lo que identifica la sección en la URL de la carta (`/menu#barra-de-matcha`)
  y lo que ata `menu_categorias.slug` a los anclajes de la página. Dejarlo a mano
  invita a espacios, acentos y mayúsculas que rompen el enlace en silencio.
*/
create or replace function public.slug_de_categoria(p_nombre text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select trim(both '-' from regexp_replace(
    lower(translate(
      btrim(coalesce(p_nombre, '')),
      'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
      'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
    )),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Alta
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_catalogo_categoria_crear(
  p_actor_id uuid,
  p_nombre_es text,
  p_nombre_en text,
  p_mundo text,
  p_estado text,
  p_etiqueta_tamanos text,
  p_reason text,
  p_request_id text default null
)
/*
  El parámetro de salida se llama `categoria_slug` y no `slug` a propósito: un
  OUT llamado igual que una columna vuelve AMBIGUA cualquier referencia sin
  cualificar dentro del cuerpo, y Postgres aborta con «column reference "slug"
  is ambiguous». Las consultas de abajo además cualifican con alias.
*/
returns table (categoria_id uuid, categoria_slug text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_slug text;
  v_orden integer;
begin
  if not public.es_duena(p_actor_id) then
    raise exception 'no_autorizado';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'motivo_obligatorio';
  end if;

  if p_nombre_es is null or btrim(p_nombre_es) = '' then
    raise exception 'nombre_obligatorio';
  end if;

  -- `mundo` y `estado` los valida el CHECK de la tabla, pero un error propio se
  -- traduce a algo legible en pantalla y el del CHECK no.
  if p_mundo not in ('cafe', 'matcha', 'piel', 'comida') then
    raise exception 'mundo_invalido';
  end if;
  if p_estado not in ('hoy', 'pronto') then
    raise exception 'estado_invalido';
  end if;

  v_slug := public.slug_de_categoria(p_nombre_es);
  if v_slug = '' then
    raise exception 'slug_invalido';
  end if;
  if exists (select 1 from public.menu_categorias c where c.slug = v_slug) then
    raise exception 'slug_duplicado';
  end if;

  -- Al final de la carta. Reordenar es otra operación, con su propio motivo.
  select coalesce(max(c.orden), 0) + 1 into v_orden from public.menu_categorias c;

  insert into public.menu_categorias (
    slug, nombre_es, nombre_en, mundo, estado, etiqueta_tamanos, orden
  ) values (
    v_slug, btrim(p_nombre_es),
    -- `nombre_en` es NOT NULL: sin traducción se repite el castellano, que es
    -- mejor que una sección en blanco para quien mire la carta en inglés. Se
    -- resuelve AQUÍ y no con un update posterior, que llegaría tarde.
    coalesce(nullif(btrim(coalesce(p_nombre_en, '')), ''), btrim(p_nombre_es)),
    p_mundo, p_estado,
    nullif(btrim(coalesce(p_etiqueta_tamanos, '')), ''),
    v_orden
  ) returning id into v_id;

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id, reason, after_data, request_id
  ) values (
    p_actor_id, 'menu_categoria_creada', 'menu_categoria', v_id::text, btrim(p_reason),
    jsonb_build_object('slug', v_slug, 'nombre', btrim(p_nombre_es),
                       'mundo', p_mundo, 'estado', p_estado),
    p_request_id
  );

  return query select v_id, v_slug;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Edición
-- ─────────────────────────────────────────────────────────────────────────────
/*
  El slug NO se recalcula al renombrar.

  Es un enlace público: `/menu#barra-de-matcha` está en marcadores, en mensajes
  y quizá en un QR impreso. Cambiarlo porque alguien corrigió una tilde rompería
  esos enlaces sin avisar. El nombre se edita; la dirección se queda.
*/
create or replace function public.admin_catalogo_categoria_editar(
  p_actor_id uuid,
  p_categoria_id uuid,
  p_nombre_es text,
  p_nombre_en text,
  p_mundo text,
  p_estado text,
  p_etiqueta_tamanos text,
  p_reason text,
  p_request_id text default null
)
returns table (categoria_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes public.menu_categorias%rowtype;
begin
  if not public.es_duena(p_actor_id) then
    raise exception 'no_autorizado';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'motivo_obligatorio';
  end if;

  if p_nombre_es is null or btrim(p_nombre_es) = '' then
    raise exception 'nombre_obligatorio';
  end if;

  if p_mundo not in ('cafe', 'matcha', 'piel', 'comida') then
    raise exception 'mundo_invalido';
  end if;
  if p_estado not in ('hoy', 'pronto') then
    raise exception 'estado_invalido';
  end if;

  select c.* into v_antes
    from public.menu_categorias c
   where c.id = p_categoria_id
     for update;

  if not found then
    raise exception 'categoria_no_encontrada';
  end if;

  update public.menu_categorias
     set nombre_es = btrim(p_nombre_es),
         nombre_en = coalesce(nullif(btrim(coalesce(p_nombre_en, '')), ''), btrim(p_nombre_es)),
         mundo = p_mundo,
         estado = p_estado,
         etiqueta_tamanos = nullif(btrim(coalesce(p_etiqueta_tamanos, '')), ''),
         updated_at = now()
   where id = p_categoria_id;

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id, reason, before_data, after_data, request_id
  ) values (
    p_actor_id, 'menu_categoria_editada', 'menu_categoria', p_categoria_id::text, btrim(p_reason),
    jsonb_build_object('nombre', v_antes.nombre_es, 'mundo', v_antes.mundo,
                       'estado', v_antes.estado, 'etiqueta', v_antes.etiqueta_tamanos),
    jsonb_build_object('nombre', btrim(p_nombre_es), 'mundo', p_mundo,
                       'estado', p_estado, 'etiqueta', p_etiqueta_tamanos),
    p_request_id
  );

  return query select p_categoria_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Borrado
-- ─────────────────────────────────────────────────────────────────────────────
/*
  Solo si está vacía. Esto no es prudencia decorativa.

  `menu_productos.categoria_id` tiene `on delete cascade` (0011:45): borrar una
  categoría con productos dentro los borraría todos en silencio. Y
  `order_items.producto_id` es `on delete restrict` (0021), así que si alguno de
  esos productos aparece en un pedido, el borrado reventaría a mitad con un error
  de clave foránea que nadie sabría leer.

  Peor todavía: si NINGUNO estuviera en un pedido, funcionaría — y se llevaría
  por delante productos que gente tiene en favoritos.

  Así que se exige vaciarla primero, archivando o moviendo sus productos. Es un
  paso más, y es el que convierte un accidente en una decisión.
*/
create or replace function public.admin_catalogo_categoria_borrar(
  p_actor_id uuid,
  p_categoria_id uuid,
  p_reason text,
  p_request_id text default null
)
returns table (borrada boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes public.menu_categorias%rowtype;
  v_productos integer;
begin
  if not public.es_duena(p_actor_id) then
    raise exception 'no_autorizado';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'motivo_obligatorio';
  end if;

  select c.* into v_antes
    from public.menu_categorias c
   where c.id = p_categoria_id
     for update;

  if not found then
    raise exception 'categoria_no_encontrada';
  end if;

  -- Cuentan también los archivados: siguen resolviendo para los favoritos.
  select count(*) into v_productos
    from public.menu_productos where categoria_id = p_categoria_id;

  if v_productos > 0 then
    raise exception 'categoria_con_productos';
  end if;

  delete from public.menu_categorias where id = p_categoria_id;

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id, reason, before_data, request_id
  ) values (
    p_actor_id, 'menu_categoria_borrada', 'menu_categoria', p_categoria_id::text, btrim(p_reason),
    jsonb_build_object('slug', v_antes.slug, 'nombre', v_antes.nombre_es),
    p_request_id
  );

  return query select true;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Permisos: solo el servidor.
-- ─────────────────────────────────────────────────────────────────────────────
/*
  Obligatorio. Postgres concede EXECUTE a PUBLIC por defecto, así que una
  función `security definer` que escriba en el catálogo y no se revoque queda
  ejecutable por `anon`, en silencio. `slug_de_categoria` es pura y no escribe
  nada, pero se revoca igual: no hay motivo para exponerla.
*/
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.slug_de_categoria(text)',
    'public.admin_catalogo_categoria_crear(uuid,text,text,text,text,text,text,text)',
    'public.admin_catalogo_categoria_editar(uuid,uuid,text,text,text,text,text,text,text)',
    'public.admin_catalogo_categoria_borrar(uuid,uuid,text,text)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

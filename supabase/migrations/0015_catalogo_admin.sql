-- ─────────────────────────────────────────────────────────────────────────────
-- 0015 — El catálogo se edita desde el panel, y cada cambio deja rastro.
--
-- `0011` sacó la carta del código y la puso en la base de datos, y sus propios
-- comentarios prometían dos cosas que no existían:
--
--   «Se apaga desde administración sin tocar el catálogo ni desplegar»
--   «para que reaplicar la migración no pise un precio que se haya cambiado
--    desde administración»
--
-- La administración que hacía eso no estaba escrita. Aquí está.
--
-- Y con auditoría, que hasta ahora NO cubría el catálogo en absoluto: subir un
-- latte dos dólares no dejaba ningún rastro de quién ni cuándo. Cada función
-- sigue el patrón de `0008`: verifica rol, exige motivo, captura el antes,
-- aplica y escribe el `audit_log` EN LA MISMA TRANSACCIÓN. Si el log falla, el
-- precio no cambia.
-- ─────────────────────────────────────────────────────────────────────────────

/*
  Archivar en vez de borrar.

  `favorites.item_slug` es texto suelto SIN clave foránea a `menu_productos`
  (`0005:63`): se valida contra el catálogo en la aplicación, no en la base.
  Borrar un producto no borra los favoritos que lo apuntan — los deja
  huérfanos, en silencio, y la persona ve desaparecer algo que había guardado
  sin que nadie se entere.

  No se añade la FK a propósito. Con `on delete cascade` borraría datos del
  usuario sin avisar; con `restrict` haría imposible retirar un producto. Se
  prefiere archivar: el producto sale de la carta, el favorito sigue
  resolviendo, y la decisión es reversible.
*/
alter table public.menu_productos
  add column if not exists archivado_at timestamptz;

comment on column public.menu_productos.archivado_at is
  'Retirado de la carta sin borrarlo. NULL = activo. Los favoritos siguen resolviendo.';

create index if not exists menu_productos_activos_idx
  on public.menu_productos (categoria_id, orden) where archivado_at is null;

/*
  Rol del actor, como texto. `es_duena` (0012) responde sí/no; aquí hace falta
  distinguir empleado de desconocido, porque marcar agotados sí lo puede hacer
  el mostrador.
*/
create or replace function public.admin_rol(p_actor_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select rol from public.admin_users where user_id = p_actor_id;
$$;

revoke all on function public.admin_rol(uuid) from public, anon, authenticated;
grant execute on function public.admin_rol(uuid) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Precio.
--
-- Es la operación más delicada del catálogo: cambia lo que se le cobra a la
-- gente. Por eso el motivo es libre y obligatorio, y el antes/después guarda
-- también el slug del producto, para que el log se lea sin tener que resolver
-- un UUID contra la tabla.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_catalogo_precio(
  p_actor_id uuid,
  p_variante_id uuid,
  p_precio_cents integer,
  p_reason text,
  p_request_id text default null
)
returns table (variante_id uuid, precio_cents integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes integer;
  v_producto record;
begin
  if not public.es_duena(p_actor_id) then
    raise exception 'no_autorizado';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'motivo_obligatorio';
  end if;

  if p_precio_cents is null or p_precio_cents < 0 then
    raise exception 'precio_invalido';
  end if;

  -- `for update` sobre la variante: dos personas cambiando el mismo precio a la
  -- vez no pueden pisarse a mitad de la transacción.
  select v.precio_cents into v_antes
    from public.menu_variantes v
   where v.id = p_variante_id
     for update;

  if not found then
    raise exception 'variante_no_encontrada';
  end if;

  select p.id, p.slug, p.nombre, v.etiqueta into v_producto
    from public.menu_variantes v
    join public.menu_productos p on p.id = v.producto_id
   where v.id = p_variante_id;

  update public.menu_variantes set precio_cents = p_precio_cents where id = p_variante_id;
  update public.menu_productos set updated_at = now() where id = v_producto.id;

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id,
    reason, before_data, after_data, request_id
  ) values (
    p_actor_id, 'menu_precio', 'menu_variante', p_variante_id::text,
    btrim(p_reason),
    jsonb_build_object('precio_cents', v_antes),
    jsonb_build_object(
      'precio_cents', p_precio_cents,
      'producto', v_producto.nombre,
      'slug', v_producto.slug,
      'tamano', v_producto.etiqueta
    ),
    p_request_id
  );

  return query select p_variante_id, p_precio_cents;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Agotado.
--
-- La ÚNICA escritura que puede hacer un empleado. Es la operación del día a
-- día: se acabó la mallorca, se apaga.
--
-- El motivo aquí llega de una lista cerrada, no de un campo libre. Pedir seis
-- caracteres escritos a mano diez veces en una mañana garantiza que alguien
-- teclee «xxxxxx», y entonces la auditoría existe pero no dice nada.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_catalogo_disponibilidad(
  p_actor_id uuid,
  p_producto_id uuid,
  p_disponible boolean,
  p_reason text,
  p_request_id text default null
)
returns table (producto_id uuid, disponible boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes boolean;
  v_slug text;
  v_nombre text;
begin
  if public.admin_rol(p_actor_id) is null then
    raise exception 'no_autorizado';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'motivo_obligatorio';
  end if;

  select p.disponible, p.slug, p.nombre into v_antes, v_slug, v_nombre
    from public.menu_productos p
   where p.id = p_producto_id
     for update;

  if not found then
    raise exception 'producto_no_encontrado';
  end if;

  update public.menu_productos
     set disponible = p_disponible, updated_at = now()
   where id = p_producto_id;

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id,
    reason, before_data, after_data, request_id
  ) values (
    p_actor_id, 'menu_disponibilidad', 'menu_producto', p_producto_id::text,
    btrim(p_reason),
    jsonb_build_object('disponible', v_antes),
    jsonb_build_object('disponible', p_disponible, 'producto', v_nombre, 'slug', v_slug),
    p_request_id
  );

  return query select p_producto_id, p_disponible;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Destacado y nota.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_catalogo_producto_editar(
  p_actor_id uuid,
  p_producto_id uuid,
  p_nombre text,
  p_nota_es text,
  p_destacado boolean,
  p_reason text,
  p_request_id text default null
)
returns table (producto_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes jsonb;
begin
  if not public.es_duena(p_actor_id) then
    raise exception 'no_autorizado';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'motivo_obligatorio';
  end if;

  if p_nombre is null or btrim(p_nombre) = '' then
    raise exception 'nombre_obligatorio';
  end if;

  select jsonb_build_object('nombre', nombre, 'nota_es', nota_es, 'destacado', destacado)
    into v_antes
    from public.menu_productos where id = p_producto_id for update;

  if v_antes is null then
    raise exception 'producto_no_encontrado';
  end if;

  /*
    El `slug` NO se toca aunque cambie el nombre.

    `favorites.item_slug` lo guarda: renombrar «Matcha Clásico» a «Matcha
    Original» y regenerar el slug dejaría huérfano cada favorito de ese
    producto. El slug es la identidad; el nombre es la etiqueta.
  */
  update public.menu_productos
     set nombre = btrim(p_nombre),
         nota_es = nullif(btrim(coalesce(p_nota_es, '')), ''),
         destacado = p_destacado,
         updated_at = now()
   where id = p_producto_id;

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id,
    reason, before_data, after_data, request_id
  ) values (
    p_actor_id, 'menu_producto_editado', 'menu_producto', p_producto_id::text,
    btrim(p_reason),
    v_antes,
    jsonb_build_object(
      'nombre', btrim(p_nombre),
      'nota_es', nullif(btrim(coalesce(p_nota_es, '')), ''),
      'destacado', p_destacado
    ),
    p_request_id
  );

  return query select p_producto_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Alta de producto, con sus variantes.
--
-- Las variantes llegan como jsonb: `[{"etiqueta":"12 oz","precio_cents":425}]`.
-- Un producto sin ninguna variante no tendría precio y no se podría pedir, así
-- que se exige al menos una.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_catalogo_producto_crear(
  p_actor_id uuid,
  p_categoria_id uuid,
  p_slug text,
  p_nombre text,
  p_nota_es text,
  p_destacado boolean,
  p_variantes jsonb,
  p_reason text,
  p_request_id text default null
)
returns table (producto_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_orden integer;
  v_n integer;
begin
  if not public.es_duena(p_actor_id) then
    raise exception 'no_autorizado';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'motivo_obligatorio';
  end if;

  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'slug_invalido';
  end if;

  select count(*) into v_n from jsonb_array_elements(coalesce(p_variantes, '[]'::jsonb));
  if v_n < 1 then
    raise exception 'sin_variantes';
  end if;

  if exists (select 1 from public.menu_productos where slug = p_slug) then
    raise exception 'slug_duplicado';
  end if;

  -- Va al final de su categoría: crear algo no debería reordenar la carta.
  select coalesce(max(orden), 0) + 1 into v_orden
    from public.menu_productos where categoria_id = p_categoria_id;

  insert into public.menu_productos
    (categoria_id, slug, nombre, nota_es, destacado, orden)
  values
    (p_categoria_id, p_slug, btrim(p_nombre),
     nullif(btrim(coalesce(p_nota_es, '')), ''), p_destacado, v_orden)
  returning id into v_id;

  insert into public.menu_variantes (producto_id, etiqueta, precio_cents, orden)
  select v_id,
         nullif(btrim(coalesce(e ->> 'etiqueta', '')), ''),
         (e ->> 'precio_cents')::integer,
         (ordinalidad)::integer
    from jsonb_array_elements(p_variantes) with ordinality as t(e, ordinalidad);

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id,
    reason, before_data, after_data, request_id
  ) values (
    p_actor_id, 'menu_producto_creado', 'menu_producto', v_id::text,
    btrim(p_reason),
    null,
    jsonb_build_object('slug', p_slug, 'nombre', btrim(p_nombre), 'variantes', p_variantes),
    p_request_id
  );

  return query select v_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Archivar y restaurar.
--
-- Archivar retira el producto de la carta sin borrarlo. Es lo correcto aquí
-- porque los favoritos apuntan por slug sin clave foránea, y porque retirar
-- algo de la carta rara vez es definitivo: vuelve la temporada y vuelve el
-- producto.
--
-- El log guarda cuántos favoritos quedan apuntando, para que quien lea la
-- auditoría sepa a cuánta gente afectó.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_catalogo_producto_archivar(
  p_actor_id uuid,
  p_producto_id uuid,
  p_archivar boolean,
  p_reason text,
  p_request_id text default null
)
returns table (producto_id uuid, archivado boolean, favoritos integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_slug text;
  v_nombre text;
  v_antes timestamptz;
  v_favoritos integer;
begin
  if not public.es_duena(p_actor_id) then
    raise exception 'no_autorizado';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'motivo_obligatorio';
  end if;

  select slug, nombre, archivado_at into v_slug, v_nombre, v_antes
    from public.menu_productos where id = p_producto_id for update;

  if not found then
    raise exception 'producto_no_encontrado';
  end if;

  select count(*)::integer into v_favoritos
    from public.favorites where item_slug = v_slug;

  update public.menu_productos
     set archivado_at = case when p_archivar then now() else null end,
         updated_at = now()
   where id = p_producto_id;

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id,
    reason, before_data, after_data, request_id
  ) values (
    p_actor_id,
    case when p_archivar then 'menu_producto_archivado' else 'menu_producto_restaurado' end,
    'menu_producto', p_producto_id::text,
    btrim(p_reason),
    jsonb_build_object('archivado', v_antes is not null),
    jsonb_build_object(
      'archivado', p_archivar,
      'producto', v_nombre,
      'slug', v_slug,
      -- Cuánta gente lo tenía guardado. Si se borrara de verdad, este número
      -- es el de favoritos que quedarían apuntando a la nada.
      'favoritos_afectados', v_favoritos
    ),
    p_request_id
  );

  return query select p_producto_id, p_archivar, v_favoritos;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Reordenar.
--
-- `menu_variantes` tiene `unique (producto_id, orden)` (`0011:82`). Asignar los
-- órdenes finales de uno en uno choca a mitad de camino: para poner la variante
-- B en la posición 1 hay que quitar antes a A de ahí, y mientras tanto las dos
-- valen 1.
--
-- Por eso se hace en dos pasadas dentro de la misma transacción: primero todos
-- los órdenes se ponen en negativo —un espacio donde nadie colisiona— y después
-- se asignan los definitivos. `menu_productos` y `menu_categorias` no tienen
-- ese índice, pero se tratan igual para que la función sea una sola.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_catalogo_reordenar(
  p_actor_id uuid,
  p_tipo text,
  p_ids uuid[],
  p_reason text,
  p_request_id text default null
)
returns table (movidos integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  if not public.es_duena(p_actor_id) then
    raise exception 'no_autorizado';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'motivo_obligatorio';
  end if;

  if p_tipo not in ('producto', 'categoria', 'variante') then
    raise exception 'tipo_invalido: %', p_tipo;
  end if;

  v_n := coalesce(array_length(p_ids, 1), 0);
  if v_n = 0 then
    raise exception 'sin_elementos';
  end if;

  if p_tipo = 'producto' then
    update public.menu_productos set orden = -orden where id = any(p_ids);
    update public.menu_productos p set orden = t.pos
      from (select unnest(p_ids) as id, generate_series(1, v_n) as pos) t
     where p.id = t.id;

  elsif p_tipo = 'categoria' then
    update public.menu_categorias set orden = -orden where id = any(p_ids);
    update public.menu_categorias c set orden = t.pos
      from (select unnest(p_ids) as id, generate_series(1, v_n) as pos) t
     where c.id = t.id;

  else
    update public.menu_variantes set orden = -orden where id = any(p_ids);
    update public.menu_variantes v set orden = t.pos
      from (select unnest(p_ids) as id, generate_series(1, v_n) as pos) t
     where v.id = t.id;
  end if;

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id,
    reason, before_data, after_data, request_id
  ) values (
    p_actor_id, 'menu_reordenado', 'menu_' || p_tipo, null,
    btrim(p_reason),
    null,
    jsonb_build_object('tipo', p_tipo, 'orden', to_jsonb(p_ids)),
    p_request_id
  );

  return query select v_n;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Variantes: añadir y quitar tamaños.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_catalogo_variante_borrar(
  p_actor_id uuid,
  p_variante_id uuid,
  p_reason text,
  p_request_id text default null
)
returns table (variante_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_producto uuid;
  v_quedan integer;
  v_antes jsonb;
begin
  if not public.es_duena(p_actor_id) then
    raise exception 'no_autorizado';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'motivo_obligatorio';
  end if;

  select producto_id, jsonb_build_object('etiqueta', etiqueta, 'precio_cents', precio_cents)
    into v_producto, v_antes
    from public.menu_variantes where id = p_variante_id for update;

  if not found then
    raise exception 'variante_no_encontrada';
  end if;

  select count(*)::integer into v_quedan
    from public.menu_variantes where producto_id = v_producto;

  -- Un producto sin variantes no tiene precio: no se puede pedir ni mostrar.
  -- Antes que dejarlo en ese estado, se rechaza.
  if v_quedan <= 1 then
    raise exception 'ultima_variante';
  end if;

  delete from public.menu_variantes where id = p_variante_id;
  update public.menu_productos set updated_at = now() where id = v_producto;

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id,
    reason, before_data, after_data, request_id
  ) values (
    p_actor_id, 'menu_variante_borrada', 'menu_variante', p_variante_id::text,
    btrim(p_reason), v_antes, null, p_request_id
  );

  return query select p_variante_id;
end;
$$;

create or replace function public.admin_catalogo_variante_crear(
  p_actor_id uuid,
  p_producto_id uuid,
  p_etiqueta text,
  p_precio_cents integer,
  p_reason text,
  p_request_id text default null
)
returns table (variante_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_orden integer;
begin
  if not public.es_duena(p_actor_id) then
    raise exception 'no_autorizado';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'motivo_obligatorio';
  end if;

  if p_precio_cents is null or p_precio_cents < 0 then
    raise exception 'precio_invalido';
  end if;

  select coalesce(max(orden), 0) + 1 into v_orden
    from public.menu_variantes where producto_id = p_producto_id;

  insert into public.menu_variantes (producto_id, etiqueta, precio_cents, orden)
  values (p_producto_id, nullif(btrim(coalesce(p_etiqueta, '')), ''), p_precio_cents, v_orden)
  returning id into v_id;

  update public.menu_productos set updated_at = now() where id = p_producto_id;

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id,
    reason, before_data, after_data, request_id
  ) values (
    p_actor_id, 'menu_variante_creada', 'menu_variante', v_id::text,
    btrim(p_reason), null,
    jsonb_build_object('etiqueta', p_etiqueta, 'precio_cents', p_precio_cents),
    p_request_id
  );

  return query select v_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Permisos: solo el servidor.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.admin_catalogo_precio(uuid,uuid,integer,text,text)',
    'public.admin_catalogo_disponibilidad(uuid,uuid,boolean,text,text)',
    'public.admin_catalogo_producto_editar(uuid,uuid,text,text,boolean,text,text)',
    'public.admin_catalogo_producto_crear(uuid,uuid,text,text,text,boolean,jsonb,text,text)',
    'public.admin_catalogo_producto_archivar(uuid,uuid,boolean,text,text)',
    'public.admin_catalogo_reordenar(uuid,text,uuid[],text,text)',
    'public.admin_catalogo_variante_borrar(uuid,uuid,text,text)',
    'public.admin_catalogo_variante_crear(uuid,uuid,text,integer,text,text)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

/*
  Freno para la edición del catálogo.

  Más holgado que el de los ajustes de saldo: reordenar una carta son muchas
  llamadas seguidas y legítimas. Sigue siendo un tope frente a un bucle.
*/
insert into public.rate_limit_reglas (accion, max_intentos, ventana_segundos, descripcion) values
  ('admin_catalogo', 120, 900, 'Ediciones del catálogo por administrador, 15 min')
on conflict (accion) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0025 — Propina en los pedidos por la web.
--
-- En el mostrador la propina la deja quien quiere. Por la app no había manera:
-- se pagaba el pedido y ya. Este es el hueco que faltaba.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- LA COLUMNA QUE FALTABA, Y POR QUÉ SON DOS
--
-- `orders.total_cents` es lo que se COBRA: lo lee `pagar_pedido_con_saldo` para
-- descontar del wallet y lo lee el Checkout de Stripe como importe único
-- (`src/lib/pedidos/service.ts`). Si la propina entra ahí, ambos cobran bien sin
-- tocar una línea, que es exactamente lo que se quiere de un cambio que mueve
-- dinero.
--
-- Pero entonces `total_cents` ya no sirve para los puntos: `otorgar_puntos_pedido`
-- multiplica por la regla `por_dolar`, y dar puntos por la propina es pagarle a
-- la gente por ser generosa con otra persona. Los puntos son por lo que compras.
--
-- De ahí las dos columnas:
--
--     subtotal_cents   lo que cuesta el pedido      → puntos
--   + propina_cents    lo que añade quien pide      → va íntegra al local
--   ─────────────────
--   = total_cents      lo que se cobra              → wallet y Stripe
--
-- `subtotal_cents` se rellena hacia atrás con `total_cents`, que es exacto: los
-- pedidos anteriores a esta migración no tenían propina que separar.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ ESTE IMPORTE SÍ VIENE DEL NAVEGADOR
--
-- `CLAUDE.md` §5 dice que el importe no lo pone el cliente, y `crear_pedido`
-- sigue calculando cada precio desde `menu_variantes` sin mirar lo que mande
-- nadie. La propina es el único número del pedido que NO tiene precio en el
-- catálogo: es una decisión de quien paga, sobre su propio dinero.
--
-- Lo que sí se comprueba es que no pueda hacer daño: entero, no negativo y con
-- techo. Un teclado móvil convierte «2.00» en 200000 con una pulsación
-- despistada, y sin techo eso sería un cobro de dos mil dólares por un café.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.orders
  add column if not exists subtotal_cents bigint not null default 0,
  add column if not exists propina_cents bigint not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_propina_no_negativa'
  ) then
    alter table public.orders
      add constraint orders_propina_no_negativa check (propina_cents >= 0);
  end if;
end $$;

comment on column public.orders.subtotal_cents is
  'Lo que cuestan las líneas del pedido, sin propina. Es la base de los puntos.';
comment on column public.orders.propina_cents is
  'Propina elegida por quien pide. Va dentro de total_cents, fuera de los puntos.';

/*
  Relleno hacia atrás.

  Se filtra por `subtotal_cents = 0` para que sea idempotente: si la migración
  se aplica dos veces, la segunda no encuentra nada que rellenar. Y no se toca
  ningún pedido con subtotal ya puesto.
*/
update public.orders
   set subtotal_cents = total_cents
 where subtotal_cents = 0
   and total_cents > 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- Crear el pedido, ahora con propina
-- ─────────────────────────────────────────────────────────────────────────────
/*
  DROP y no `create or replace`.

  Dos motivos, y cualquiera de los dos basta. El primero es que cambia el tipo
  de retorno —ahora devuelve también subtotal y propina— y Postgres no deja
  reemplazar una función cambiándolo. El segundo es el de `0022`: añadir un
  argumento crea una SOBRECARGA, la firma de tres argumentos seguiría viva, y
  esa versión vieja escribiría `total_cents` sin tocar `subtotal_cents`. El
  pedido se cobraría bien y no daría ni un punto, en silencio.
*/
drop function if exists public.crear_pedido(uuid, jsonb, text);

create or replace function public.crear_pedido(
  p_user_id uuid,
  p_items jsonb,
  p_client_request_id text default null,
  p_propina_cents bigint default 0
)
returns table (
  order_id uuid,
  order_number text,
  subtotal_cents bigint,
  propina_cents bigint,
  total_cents bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_previo public.orders%rowtype;
  v_id uuid;
  v_numero text;
  v_subtotal bigint := 0;
  v_propina bigint;
  v_item jsonb;
  v_variante record;
  v_cantidad int;
  v_lineas int := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'carrito_vacio';
  end if;

  if jsonb_array_length(p_items) > 40 then
    raise exception 'carrito_demasiado_largo';
  end if;

  -- Techo de $100. Generoso de sobra para un café y suficiente para que un
  -- resbalón con la coma no acabe en el extracto de nadie.
  v_propina := coalesce(p_propina_cents, 0);
  if v_propina < 0 or v_propina > 10000 then
    raise exception 'propina_invalida';
  end if;

  /*
    Reenvío del mismo intento: se devuelve el pedido que se creó entonces en vez
    de uno nuevo. Sin esto, un doble toque en «Pedir» deja dos pedidos idénticos
    sin pagar y alguien tiene que limpiarlos a mano.

    Incluida la propina de ENTONCES, no la de ahora: el mismo identificador de
    intento es la misma petición. Cambiar de idea exige un intento nuevo.
  */
  if p_client_request_id is not null then
    select o.* into v_previo
      from public.orders o
     where o.user_id = p_user_id
       and o.client_request_id = p_client_request_id;

    if found then
      return query select v_previo.id, v_previo.order_number,
                          v_previo.subtotal_cents, v_previo.propina_cents,
                          v_previo.total_cents;
      return;
    end if;
  end if;

  v_numero := public.generar_numero_pedido();

  insert into public.orders (
    user_id, order_number, status, subtotal_cents, propina_cents, total_cents,
    channel, client_request_id
  )
  values (p_user_id, v_numero, 'pendiente_pago', 0, v_propina, 0, 'linea', p_client_request_id)
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_cantidad := coalesce((v_item ->> 'cantidad')::int, 0);
    if v_cantidad <= 0 or v_cantidad > 20 then
      raise exception 'cantidad_invalida';
    end if;

    -- El precio sale de aquí, no del navegador.
    select v.id, v.precio_cents, v.etiqueta, p.id as producto_id, p.nombre, p.disponible
      into v_variante
      from public.menu_variantes v
      join public.menu_productos p on p.id = v.producto_id
     where v.id = (v_item ->> 'variante_id')::uuid;

    if not found then
      raise exception 'producto_no_encontrado';
    end if;
    if not v_variante.disponible then
      raise exception 'producto_agotado';
    end if;

    insert into public.order_items (
      order_id, producto_id, variante_id, nombre, etiqueta_variante, precio_cents, cantidad
    ) values (
      v_id, v_variante.producto_id, v_variante.id, v_variante.nombre,
      v_variante.etiqueta, v_variante.precio_cents, v_cantidad
    );

    v_subtotal := v_subtotal + (v_variante.precio_cents::bigint * v_cantidad);
    v_lineas := v_lineas + 1;
  end loop;

  if v_lineas = 0 or v_subtotal <= 0 then
    raise exception 'carrito_vacio';
  end if;

  update public.orders
     set subtotal_cents = v_subtotal,
         total_cents = v_subtotal + v_propina
   where id = v_id;

  return query select v_id, v_numero, v_subtotal, v_propina, v_subtotal + v_propina;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Puntos: por lo que se compra, no por lo que se regala
-- ─────────────────────────────────────────────────────────────────────────────
/*
  Único cambio respecto a `0021`: la base pasa de `total_cents` a
  `subtotal_cents`.

  Los pedidos viejos quedaron con `subtotal_cents = total_cents` en el relleno de
  arriba, así que los que ya se pagaron dan exactamente los mismos puntos que
  daban. Y `puntos_otorgados` sigue frenando cualquier reintento.
*/
create or replace function public.otorgar_puntos_pedido(p_order_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_por_dolar bigint;
  v_puntos bigint;
begin
  select o.* into v_order from public.orders o where o.id = p_order_id;
  if not found then return 0; end if;

  if v_order.puntos_otorgados is not null then
    return v_order.puntos_otorgados;
  end if;

  select points into v_por_dolar
    from public.loyalty_rules where key = 'por_dolar' and active;

  v_puntos := floor(v_order.subtotal_cents / 100.0)::bigint * coalesce(v_por_dolar, 0);

  if v_puntos > 0 then
    perform public.apply_loyalty_transaction(
      v_order.user_id,
      v_puntos,
      'earn',
      'pedido:' || p_order_id::text,
      p_order_id::text,
      'Compra ' || v_order.order_number
    );
  end if;

  update public.orders set puntos_otorgados = v_puntos where id = p_order_id;
  return v_puntos;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- La cola de la barra ve la propina
-- ─────────────────────────────────────────────────────────────────────────────
/*
  Se suma a la vista porque una propina que nadie ve es una propina que nadie
  reparte. Cambia el tipo de retorno, así que toca DROP antes.
*/
drop function if exists public.admin_pedidos_cola();

create or replace function public.admin_pedidos_cola()
returns table (
  id uuid,
  order_number text,
  status text,
  subtotal_cents bigint,
  propina_cents bigint,
  total_cents bigint,
  metodo_pago text,
  pagado timestamptz,
  persona text,
  email text,
  lineas text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select o.id, o.order_number, o.status,
         o.subtotal_cents, o.propina_cents, o.total_cents,
         o.metodo_pago, o.paid_at,
         btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
         p.email,
         (select string_agg(
                   i.cantidad || '× ' || i.nombre ||
                   coalesce(' (' || i.etiqueta_variante || ')', ''),
                   ' · ' order by i.created_at)
            from public.order_items i where i.order_id = o.id)
    from public.orders o
    left join public.profiles p on p.id = o.user_id
   where o.status in ('pagado', 'preparando')
   order by o.paid_at;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Permisos: solo el servidor.
-- ─────────────────────────────────────────────────────────────────────────────
/*
  Las tres funciones se acaban de crear —dos venían de un DROP—, así que nacen
  con el EXECUTE que Postgres concede a PUBLIC por defecto. Sin este bloque,
  `anon` podría crear pedidos.
*/
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.crear_pedido(uuid,jsonb,text,bigint)',
    'public.otorgar_puntos_pedido(uuid)',
    'public.admin_pedidos_cola()'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

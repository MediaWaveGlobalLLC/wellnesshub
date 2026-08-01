-- ─────────────────────────────────────────────────────────────────────────────
-- 0021 — Pedidos de verdad.
--
-- `orders` existe desde `0005` y solo se leía: `/perfil/pedidos` pintaba un
-- historial que nadie escribía nunca. Guardaba un total y ninguna línea, así
-- que un pedido no podía decir de qué era.
--
-- Aquí se cierra el círculo: pedir del menú, pagar —con saldo o con tarjeta— y
-- recoger en el local.
--
-- Dos reglas mandan sobre todo lo demás (`CLAUDE.md` §5):
--
--  · el importe NUNCA llega del cliente. El navegador manda qué quiere y cuánto;
--    el precio sale de `menu_variantes` dentro de esta transacción. Un carrito
--    manipulado pide otra cosa, no paga menos.
--  · el pedido nace SIN PAGAR y solo un pago confirmado lo cierra. La página de
--    éxito no paga nada (`docs/06`), igual que en las gift cards.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- Estados de recogida
-- ─────────────────────────────────────────────────────────────────────────────
/*
  El CHECK de `0005` era vocabulario de reparto —'en_camino'— y aquí se recoge en
  barra. Se AÑADEN los estados nuevos en vez de sustituir los viejos: cualquier
  fila que existiera seguiría siendo válida, y una migración que invalida datos
  ya escritos no es una migración, es una pérdida.
*/
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in (
  -- Ciclo nuevo, el de pedir por la web y recoger.
  'pendiente_pago', 'pagado', 'preparando', 'entregado',
  -- Vocabulario de `0005`, conservado para no invalidar lo ya escrito.
  'en_camino', 'completado',
  'cancelado'
));

alter table public.orders
  add column if not exists metodo_pago text
    check (metodo_pago is null or metodo_pago in ('wallet', 'stripe')),
  add column if not exists stripe_checkout_session_id text,
  add column if not exists paid_at timestamptz,
  add column if not exists preparando_at timestamptz,
  add column if not exists entregado_at timestamptz,
  -- Cuántos puntos dio. Null mientras no se ha pagado; 0 es un valor legítimo.
  add column if not exists puntos_otorgados bigint,
  /*
    Identificador del intento que creó el pedido, puesto por el navegador.

    Es lo que hace que un doble toque en «Pedir» no deje dos pedidos idénticos
    sin pagar. Va por persona, no global: dos clientes distintos pueden mandar el
    mismo identificador sin pisarse.
  */
  add column if not exists client_request_id text;

create unique index if not exists orders_intento_idx
  on public.orders(user_id, client_request_id)
  where client_request_id is not null;

create unique index if not exists orders_stripe_session_idx
  on public.orders(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

-- La cola de la barra: lo pagado y sin entregar, lo más viejo primero.
create index if not exists orders_cola_idx
  on public.orders(paid_at) where status in ('pagado', 'preparando');

-- ─────────────────────────────────────────────────────────────────────────────
-- Líneas
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  /*
    `on delete restrict`: un producto con pedidos detrás no se borra. Para
    retirarlo del menú está `disponible = false`, que ya existe desde `0011`.
  */
  producto_id uuid not null references public.menu_productos(id) on delete restrict,
  variante_id uuid not null references public.menu_variantes(id) on delete restrict,
  /*
    Nombre, tamaño y precio CONGELADOS, igual que en los canjes de `0020`.

    Si mañana sube el latte, el pedido de ayer siguió costando lo que costó y así
    lo tiene que contar el recibo. Leerlos por join contra el catálogo
    reescribiría cada ticket pasado en cuanto se toca un precio.
  */
  nombre text not null,
  etiqueta_variante text,
  precio_cents integer not null check (precio_cents >= 0),
  cantidad integer not null check (cantidad > 0 and cantidad <= 20),
  created_at timestamptz not null default now()
);

create index if not exists order_items_pedido_idx on public.order_items(order_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Número de pedido
-- ─────────────────────────────────────────────────────────────────────────────
/*
  Corto y legible en voz alta, como el código de canje y por lo mismo: se canta
  en una barra. No es secreto —`orders` está cerrada por RLS a su dueño— y sirve
  para llamar a quien lo pidió.
*/
create or replace function public.generar_numero_pedido()
returns text
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_numero text;
  v_intento int := 0;
begin
  loop
    v_numero := 'P-';
    for _ in 1..5 loop
      v_numero := v_numero || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::int, 1);
    end loop;

    exit when not exists (select 1 from public.orders where order_number = v_numero);

    v_intento := v_intento + 1;
    if v_intento >= 6 then
      raise exception 'no_se_pudo_generar_numero';
    end if;
  end loop;

  return v_numero;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Crear el pedido
-- ─────────────────────────────────────────────────────────────────────────────
/*
  Recibe QUÉ se quiere, nunca CUÁNTO cuesta.

  `p_items` es un array de `{"variante_id": uuid, "cantidad": int}`. El precio,
  el nombre y el tamaño salen del catálogo aquí dentro. Es la diferencia entre un
  carrito manipulado que pide cosas raras y uno que paga menos de la cuenta.

  Nace en 'pendiente_pago'. Nada de lo que ocurra en el navegador lo mueve de
  ahí: lo cierra `pagar_pedido_con_saldo` o el webhook de Stripe.
*/
create or replace function public.crear_pedido(
  p_user_id uuid,
  p_items jsonb,
  p_client_request_id text default null
)
returns table (order_id uuid, order_number text, total_cents bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_previo public.orders%rowtype;
  v_id uuid;
  v_numero text;
  v_total bigint := 0;
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

  /*
    Reenvío del mismo intento: se devuelve el pedido que se creó entonces en vez
    de uno nuevo. Sin esto, un doble toque en «Pedir» deja dos pedidos idénticos
    sin pagar y alguien tiene que limpiarlos a mano.
  */
  if p_client_request_id is not null then
    select o.* into v_previo
      from public.orders o
     where o.user_id = p_user_id
       and o.client_request_id = p_client_request_id;

    if found then
      return query select v_previo.id, v_previo.order_number, v_previo.total_cents;
      return;
    end if;
  end if;

  v_numero := public.generar_numero_pedido();

  insert into public.orders (
    user_id, order_number, status, total_cents, channel, client_request_id
  )
  values (p_user_id, v_numero, 'pendiente_pago', 0, 'linea', p_client_request_id)
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

    v_total := v_total + (v_variante.precio_cents::bigint * v_cantidad);
    v_lineas := v_lineas + 1;
  end loop;

  if v_lineas = 0 or v_total <= 0 then
    raise exception 'carrito_vacio';
  end if;

  update public.orders set total_cents = v_total where id = v_id;

  return query select v_id, v_numero, v_total;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Puntos por compra
-- ─────────────────────────────────────────────────────────────────────────────
/*
  Aplica la regla `por_dolar` sobre un pedido pagado.

  Esa regla lleva desde `0005` marcada como imposible de disparar: el panel dice
  que «hoy la web no ve lo que se cobra en el mostrador». Un pedido por la web sí
  lo ve, así que aquí por fin se puede.

  Se ignora en silencio si la regla está apagada: los puntos son un extra, y
  quedarse sin ellos nunca puede tumbar un cobro que ya ocurrió.
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

  -- Ya se le dieron: no se repiten aunque el webhook reintente.
  if v_order.puntos_otorgados is not null then
    return v_order.puntos_otorgados;
  end if;

  select points into v_por_dolar
    from public.loyalty_rules where key = 'por_dolar' and active;

  v_puntos := floor(v_order.total_cents / 100.0)::bigint * coalesce(v_por_dolar, 0);

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
-- Pagar con el saldo
-- ─────────────────────────────────────────────────────────────────────────────
/*
  O el saldo cubre el pedido entero, o no se usa.

  Nada de pagos partidos: un pedido a medio pagar —parte en saldo, parte
  esperando a Stripe— tiene un estado intermedio en el que el dinero del cliente
  ya salió y el pedido todavía no existe para la barra. Si el saldo no llega, se
  paga todo con tarjeta.
*/
create or replace function public.pagar_pedido_con_saldo(
  p_user_id uuid,
  p_order_id uuid
)
returns table (order_number text, saldo_restante bigint, puntos_ganados bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_saldo bigint;
  v_puntos bigint;
begin
  select o.* into v_order
    from public.orders o
   where o.id = p_order_id
     for update;

  if not found then
    raise exception 'pedido_no_encontrado';
  end if;
  -- El pedido es de quien lo hizo. Aunque llegara un id ajeno, aquí se para.
  if v_order.user_id <> p_user_id then
    raise exception 'pedido_ajeno';
  end if;
  if v_order.status <> 'pendiente_pago' then
    raise exception 'pedido_ya_pagado';
  end if;

  select balance_cents into v_saldo
    from public.wallets where user_id = p_user_id;

  if coalesce(v_saldo, 0) < v_order.total_cents then
    raise exception 'saldo_insuficiente';
  end if;

  -- La clave es el pedido: reintentar no cobra dos veces.
  select t.new_balance_cents into v_saldo
    from public.apply_wallet_transaction(
      p_user_id,
      -v_order.total_cents,
      'purchase',
      'pedido:' || p_order_id::text,
      p_order_id::text,
      'Pedido ' || v_order.order_number
    ) t;

  update public.orders
     set status = 'pagado', metodo_pago = 'wallet', paid_at = now()
   where id = p_order_id;

  v_puntos := public.otorgar_puntos_pedido(p_order_id);

  insert into public.audit_logs (
    actor_user_id, target_user_id, action, entity_type, entity_id, reason, after_data
  ) values (
    p_user_id, p_user_id, 'pedido_pagado', 'order', p_order_id::text,
    'Pago con saldo desde la cuenta',
    jsonb_build_object('total_cents', v_order.total_cents, 'metodo', 'wallet',
                       'saldo_despues', v_saldo, 'puntos', v_puntos)
  );

  return query select v_order.order_number, v_saldo, v_puntos;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Confirmar el pago de Stripe
-- ─────────────────────────────────────────────────────────────────────────────
/*
  Solo la llama el webhook firmado. Idempotente por `stripe_event_id`, igual que
  la emisión de gift cards: Stripe reintenta, y un reintento no puede volver a
  dar puntos ni reescribir el pago.
*/
create or replace function public.marcar_pedido_pagado(
  p_stripe_event_id text,
  p_event_type text,
  p_session_id text
)
returns table (order_id uuid, order_number text, ya_procesado boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
begin
  if exists (
    select 1 from public.stripe_webhook_events
     where stripe_event_id = p_stripe_event_id and status = 'processed'
  ) then
    select o.* into v_order from public.orders o
     where o.stripe_checkout_session_id = p_session_id;
    if not found then raise exception 'pedido_no_encontrado'; end if;
    return query select v_order.id, v_order.order_number, true;
    return;
  end if;

  insert into public.stripe_webhook_events (stripe_event_id, event_type, status)
  values (p_stripe_event_id, p_event_type, 'processing')
  on conflict (stripe_event_id) do nothing;

  select o.* into v_order
    from public.orders o
   where o.stripe_checkout_session_id = p_session_id
     for update;

  if not found then
    raise exception 'pedido_no_encontrado';
  end if;

  if v_order.status <> 'pendiente_pago' then
    update public.stripe_webhook_events
       set status = 'processed', processed_at = now()
     where stripe_event_id = p_stripe_event_id;
    return query select v_order.id, v_order.order_number, true;
    return;
  end if;

  update public.orders
     set status = 'pagado', metodo_pago = 'stripe', paid_at = now()
   where id = v_order.id;

  perform public.otorgar_puntos_pedido(v_order.id);

  insert into public.audit_logs (
    actor_user_id, target_user_id, action, entity_type, entity_id, reason, after_data
  ) values (
    null, v_order.user_id, 'pedido_pagado', 'order', v_order.id::text,
    'Pago confirmado por webhook de Stripe',
    jsonb_build_object('total_cents', v_order.total_cents, 'metodo', 'stripe',
                       'stripe_event_id', p_stripe_event_id)
  );

  update public.stripe_webhook_events
     set status = 'processed', processed_at = now()
   where stripe_event_id = p_stripe_event_id;

  return query select v_order.id, v_order.order_number, false;
end;
$$;

/** Ata la sesión de Stripe al pedido antes de mandar a nadie a pagar. */
create or replace function public.atar_sesion_stripe(
  p_user_id uuid,
  p_order_id uuid,
  p_session_id text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.orders
     set stripe_checkout_session_id = p_session_id
   where id = p_order_id
     and user_id = p_user_id
     and status = 'pendiente_pago';

  if not found then
    raise exception 'pedido_no_encontrado';
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- La cola de la barra
-- ─────────────────────────────────────────────────────────────────────────────
/*
  Mismo patrón que la entrega de recompensas: es trabajo de mostrador, así que
  basta con estar en `admin_users`.

  Solo avanza. Un pedido entregado no vuelve a 'preparando': si algo salió mal,
  se arregla con un ajuste de saldo o de puntos, que son movimientos nuevos y con
  su propio motivo, nunca borrando el anterior (`docs/00`).
*/
create or replace function public.admin_pedido_avanzar(
  p_actor_id uuid,
  p_order_id uuid,
  p_nuevo_estado text,
  p_request_id text default null
)
returns table (estado text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
begin
  if not exists (select 1 from public.admin_users where user_id = p_actor_id) then
    raise exception 'no_autorizado';
  end if;

  if p_nuevo_estado not in ('preparando', 'entregado') then
    raise exception 'estado_invalido';
  end if;

  select o.* into v_order from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'pedido_no_encontrado';
  end if;

  if v_order.status = 'pendiente_pago' then
    raise exception 'pedido_sin_pagar';
  end if;
  if v_order.status = 'entregado' then
    raise exception 'pedido_ya_entregado';
  end if;
  if p_nuevo_estado = 'preparando' and v_order.status <> 'pagado' then
    raise exception 'estado_invalido';
  end if;

  update public.orders
     set status = p_nuevo_estado,
         preparando_at = case when p_nuevo_estado = 'preparando' then now() else preparando_at end,
         entregado_at = case when p_nuevo_estado = 'entregado' then now() else entregado_at end
   where id = p_order_id;

  insert into public.audit_logs (
    actor_user_id, target_user_id, action, entity_type, entity_id, reason,
    before_data, after_data, request_id
  ) values (
    p_actor_id, v_order.user_id, 'pedido_avanzado', 'order', p_order_id::text,
    'Cola del mostrador',
    jsonb_build_object('status', v_order.status),
    jsonb_build_object('status', p_nuevo_estado, 'order_number', v_order.order_number),
    p_request_id
  );

  return query select p_nuevo_estado;
end;
$$;

create or replace function public.admin_pedidos_cola()
returns table (
  id uuid,
  order_number text,
  status text,
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
  select o.id, o.order_number, o.status, o.total_cents, o.metodo_pago, o.paid_at,
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
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.order_items enable row level security;

-- Las líneas se ven si se ve el pedido. `orders` ya tiene su política desde
-- `0005`, así que la regla vive en un solo sitio y no puede divergir.
create policy "order_items_del_pedido_propio" on public.order_items
  for select to authenticated using (
    exists (
      select 1 from public.orders o
       where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Permisos: solo el servidor.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.generar_numero_pedido()',
    'public.crear_pedido(uuid,jsonb,text)',
    'public.otorgar_puntos_pedido(uuid)',
    'public.pagar_pedido_con_saldo(uuid,uuid)',
    'public.marcar_pedido_pagado(text,text,text)',
    'public.atar_sesion_stripe(uuid,uuid,text)',
    'public.admin_pedido_avanzar(uuid,uuid,text,text)',
    'public.admin_pedidos_cola()'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

/*
  Freno del pedido. Crear pedidos sin pagarlos es barato para quien lo hace y
  ensucia la base, así que se limita por persona.
*/
insert into public.rate_limit_reglas (accion, max_intentos, ventana_segundos, descripcion) values
  ('crear_pedido', 15, 900, 'Pedidos creados por persona, 15 min')
on conflict (accion) do nothing;

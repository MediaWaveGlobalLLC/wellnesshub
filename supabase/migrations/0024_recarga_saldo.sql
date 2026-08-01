-- ─────────────────────────────────────────────────────────────────────────────
-- 0024 — Recargar saldo, y el café de bienvenida que la portada promete.
--
-- La barra de anuncio dice «Deposita tus primeros $20 y recibe café gratis» y
-- hasta aquí no existía ninguna forma de depositar: el crédito solo entraba
-- canjeando una gift card o cargándolo a mano desde el panel. Un anuncio sin
-- botón detrás.
--
-- El flujo es el MISMO que el de los pedidos (`0021`) y el de las gift cards
-- (`0009`), a propósito: una fila local en estado 'pendiente', una sesión de
-- Stripe atada a esa fila, y el webhook como ÚNICO camino que acredita nada.
-- Volver a la página de éxito no da saldo; recargarla veinte veces, tampoco.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.wallet_topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  /*
    Rango amplio a propósito.

    Los importes que se ofrecen —20, 50 y 100— viven en la aplicación, donde se
    cambian sin desplegar una migración. Aquí solo hay un freno de cordura: por
    debajo de $5 el coste de la comisión de Stripe se come la recarga, y por
    encima de $500 deja de parecer un saldo de cafetería y empieza a parecer un
    error de tecleo.
  */
  amount_cents bigint not null check (amount_cents between 500 and 50000),

  status text not null default 'pendiente'
    check (status in ('pendiente', 'pagada', 'fallida', 'cancelada')),

  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,

  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists wallet_topups_usuario_idx
  on public.wallet_topups(user_id, created_at desc);

alter table public.wallet_topups enable row level security;

/*
  La persona VE sus recargas y no escribe ninguna.

  Sin política de INSERT ni de UPDATE: si el cliente pudiera crear la fila
  elegiría el importe, y si pudiera actualizarla se pondría 'pagada' sola. Las
  dos cosas las hace el servidor.
*/
create policy "wallet_topups_select_own" on public.wallet_topups
  for select to authenticated using ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- El café de bienvenida
--
-- Se entrega como un CANJE ya hecho en `loyalty_redemptions`, no como puntos:
-- la portada promete un café, y dar puntos equivalentes obligaría a la persona
-- a hacer una conversión mental y a que le cuadre. Aparece en /puntos con su
-- código, igual que cualquier otro canje, y el mostrador lo entrega igual.
--
-- Dos piezas que faltaban para poder hacerlo honestamente:
-- ─────────────────────────────────────────────────────────────────────────────

/*
  `clave` — identificador estable de una recompensa.

  El código necesita poder decir «la recompensa del café de bienvenida» sin
  depender del nombre, que la dueña puede editar, ni del id, que cambia entre
  la base de desarrollo y la de producción.
*/
alter table public.loyalty_rewards
  add column if not exists clave text;

create unique index if not exists loyalty_rewards_clave_idx
  on public.loyalty_rewards(clave) where clave is not null;

/*
  Un canje de promoción cuesta CERO, y eso hay que poder registrarlo.

  El CHECK original exigía `costo_puntos > 0`. Guardar el precio de catálogo en
  un regalo sería mentir en el historial: diría que esa persona pagó 500 puntos
  que nunca tuvo. Se relaja a `>= 0` y se añade `origen`, para que el historial
  distinga un canje de un regalo sin tener que deducirlo del importe.
*/
alter table public.loyalty_redemptions
  add column if not exists origen text not null default 'canje';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'loyalty_redemptions_origen_check') then
    alter table public.loyalty_redemptions
      add constraint loyalty_redemptions_origen_check
      check (origen in ('canje', 'promocion'));
  end if;

  -- El CHECK del coste se llama distinto según cómo lo nombrara Postgres al
  -- crearlo, así que se busca por la columna en vez de por un nombre a ciegas.
  perform 1;
end $$;

do $$
declare
  v_nombre text;
begin
  select con.conname into v_nombre
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
   where c.relname = 'loyalty_redemptions'
     and con.contype = 'c'
     and pg_get_constraintdef(con.oid) ilike '%costo_puntos > 0%';

  if v_nombre is not null then
    execute format('alter table public.loyalty_redemptions drop constraint %I', v_nombre);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'loyalty_redemptions_costo_no_negativo'
  ) then
    alter table public.loyalty_redemptions
      add constraint loyalty_redemptions_costo_no_negativo check (costo_puntos >= 0);
  end if;
end $$;

/*
  La recompensa del café, creada aquí para que la promoción funcione desde el
  primer día sin que nadie tenga que acordarse de darla de alta.

  `activa = false`: NO aparece en el catálogo de «canjea tus puntos». No es algo
  que se compre con puntos, es lo que regala la promoción. Se busca por `clave`,
  y la función de más abajo la usa esté activa o no.
*/
insert into public.loyalty_rewards (clave, nombre, descripcion, costo_puntos, activa, orden)
values (
  'cafe_bienvenida',
  'Café de bienvenida',
  'Un café de la casa, por tu primera recarga de $20 o más.',
  1,
  false,
  999
)
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Crear la recarga. Solo prepara la fila; no toca ningún saldo.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.crear_recarga(
  p_user_id uuid,
  p_amount_cents bigint
)
returns table (recarga_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'usuario_no_encontrado';
  end if;

  if p_amount_cents is null or p_amount_cents < 500 or p_amount_cents > 50000 then
    raise exception 'importe_invalido';
  end if;

  insert into public.wallet_topups (user_id, amount_cents)
  values (p_user_id, p_amount_cents)
  returning id into v_id;

  return query select v_id;
end;
$$;

/*
  Atar la sesión de Stripe a la recarga.

  Se hace ANTES de mandar a nadie a pagar, por lo mismo que en `0021`: un
  webhook rápido puede llegar antes que el update, y entonces no encontraría la
  recarga que tiene que acreditar.
*/
create or replace function public.atar_sesion_recarga(
  p_user_id uuid,
  p_recarga_id uuid,
  p_session_id text
)
returns table (recarga_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  update public.wallet_topups
     set stripe_checkout_session_id = p_session_id
   where id = p_recarga_id
     and user_id = p_user_id
     and status = 'pendiente'
  returning id into v_id;

  if v_id is null then
    raise exception 'recarga_no_encontrada';
  end if;

  return query select v_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Confirmar el pago. El ÚNICO sitio donde el saldo sube.
--
-- Idempotente por `stripe_event_id`, igual que la emisión de gift cards: Stripe
-- reintenta los webhooks, y sin esto un reintento acreditaría el saldo dos
-- veces. `apply_wallet_transaction` añade una segunda red con su propia clave
-- de idempotencia, atada a la recarga.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.confirmar_recarga(
  p_stripe_event_id text,
  p_event_type text,
  p_session_id text,
  p_payment_intent_id text default null
)
returns table (
  recarga_id uuid,
  saldo_cents bigint,
  ya_procesado boolean,
  cafe_otorgado boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recarga public.wallet_topups%rowtype;
  v_saldo bigint;
  v_cafe boolean := false;
  v_recompensa public.loyalty_rewards%rowtype;
  v_codigo text;
  v_previas integer;
begin
  -- Evento ya procesado: se devuelve lo que se hizo, sin repetir nada.
  if exists (
    select 1 from public.stripe_webhook_events
     where stripe_event_id = p_stripe_event_id and status = 'processed'
  ) then
    select t.* into v_recarga from public.wallet_topups t
     where t.stripe_checkout_session_id = p_session_id;

    if not found then
      raise exception 'recarga_no_encontrada';
    end if;

    select w.balance_cents into v_saldo from public.wallets w where w.user_id = v_recarga.user_id;
    return query select v_recarga.id, v_saldo, true, false;
    return;
  end if;

  insert into public.stripe_webhook_events (stripe_event_id, event_type, status)
  values (p_stripe_event_id, p_event_type, 'processing')
  on conflict (stripe_event_id) do nothing;

  -- Bloquea la fila: dos entregas simultáneas del mismo evento se serializan.
  select t.* into v_recarga
    from public.wallet_topups t
   where t.stripe_checkout_session_id = p_session_id
     for update;

  if not found then
    raise exception 'recarga_no_encontrada';
  end if;

  if v_recarga.status = 'pagada' then
    select w.balance_cents into v_saldo from public.wallets w where w.user_id = v_recarga.user_id;
    update public.stripe_webhook_events
       set status = 'processed', processed_at = now()
     where stripe_event_id = p_stripe_event_id;
    return query select v_recarga.id, v_saldo, true, false;
    return;
  end if;

  /*
    Cuántas recargas pagadas había ANTES de esta.

    Se cuenta aquí, con la fila bloqueada y antes de marcarla, porque el café es
    por la PRIMERA. Contarlo después haría que la primera recarga viera ya una
    pagada —ella misma— y no diera nada.
  */
  select count(*)::integer into v_previas
    from public.wallet_topups t
   where t.user_id = v_recarga.user_id and t.status = 'pagada';

  update public.wallet_topups
     set status = 'pagada',
         paid_at = now(),
         stripe_payment_intent_id = coalesce(p_payment_intent_id, stripe_payment_intent_id)
   where id = v_recarga.id;

  select t.new_balance_cents into v_saldo
    from public.apply_wallet_transaction(
      v_recarga.user_id,
      v_recarga.amount_cents,
      'promotion',
      -- La clave lleva la recarga dentro: aunque algo reintentara por otra vía,
      -- el ledger no duplica el crédito.
      'recarga:' || v_recarga.id::text,
      v_recarga.id::text,
      'Recarga de saldo'
    ) t;

  /*
    El café de bienvenida: primera recarga y de $20 o más.

    Si la recompensa no existe —alguien la borró— NO se lanza: la recarga es lo
    que la persona pagó y no puede fallar porque falte un regalo. Se avisa en los
    logs y el saldo entra igual.
  */
  if v_previas = 0 and v_recarga.amount_cents >= 2000 then
    select r.* into v_recompensa
      from public.loyalty_rewards r where r.clave = 'cafe_bienvenida';

    if found then
      v_codigo := public.generar_codigo_canje();

      insert into public.loyalty_redemptions (
        user_id, reward_id, nombre, costo_puntos, codigo, estado, origen
      ) values (
        v_recarga.user_id, v_recompensa.id, v_recompensa.nombre, 0, v_codigo, 'pendiente', 'promocion'
      );

      v_cafe := true;

      insert into public.audit_logs (
        actor_user_id, target_user_id, action, entity_type, entity_id, reason, after_data
      ) values (
        null, v_recarga.user_id, 'cafe_bienvenida_otorgado', 'loyalty_redemption', v_codigo,
        'Primera recarga de $20 o más',
        jsonb_build_object('recarga_id', v_recarga.id, 'amount_cents', v_recarga.amount_cents)
      );
    else
      raise warning 'no existe la recompensa cafe_bienvenida: recarga % sin café', v_recarga.id;
    end if;
  end if;

  insert into public.audit_logs (
    actor_user_id, target_user_id, action, entity_type, entity_id, reason, after_data
  ) values (
    null, v_recarga.user_id, 'recarga_confirmada', 'wallet_topup', v_recarga.id::text,
    'Pago confirmado por webhook de Stripe',
    jsonb_build_object('amount_cents', v_recarga.amount_cents, 'balance_after', v_saldo,
                       'stripe_event_id', p_stripe_event_id, 'cafe', v_cafe)
  );

  update public.stripe_webhook_events
     set status = 'processed', processed_at = now()
   where stripe_event_id = p_stripe_event_id;

  return query select v_recarga.id, v_saldo, false, v_cafe;
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
    'public.crear_recarga(uuid,bigint)',
    'public.atar_sesion_recarga(uuid,uuid,text)',
    'public.confirmar_recarga(text,text,text,text)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

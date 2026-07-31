-- ─────────────────────────────────────────────────────────────────────────────
-- 0019 — Las gift cards pasan a tener saldo.
--
-- Hasta aquí una tarjeta era un cheque: un importe, un canje, y se acabó. Ahora
-- es un monedero: se canjea por partes y la dueña puede recargarla.
--
-- El cambio de fondo es qué significa cada columna:
--
--   · `amount_cents`  — lo que se emitió. NO cambia nunca. Es el importe que se
--                       cobró por Stripe y el que aparece en el recibo.
--   · `balance_cents` — lo que queda. Es el único número que se puede gastar.
--
-- Separarlas y no reutilizar `amount_cents` como saldo vivo es deliberado: el
-- importe cobrado es un hecho contable y `gift_card_orders.amount_cents` tiene
-- que seguir cuadrando con Stripe. Un saldo que se mueve encima del importe
-- cobrado convertiría el histórico de ventas en algo que cambia solo.
--
-- `status` conserva sus cuatro valores. 'redeemed' pasa a significar «sin
-- saldo», que es lo que ya significaba cuando el canje era todo o nada.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- La columna
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.gift_cards
  add column if not exists balance_cents bigint;

/*
  Backfill.

  Una canjeada gastó todo su importe: saldo 0. Cualquier otra —activa, anulada
  o caducada— conserva el suyo íntegro, porque ninguna llegó a acreditarse. Una
  anulada mantiene el saldo a propósito: `admin_gift_card_reactivar` la devuelve
  a la vida y tiene que volver con el dinero que tenía.
*/
update public.gift_cards
   set balance_cents = case when status = 'redeemed' then 0 else amount_cents end
 where balance_cents is null;

/*
  NOT NULL y sin DEFAULT, que no es un olvido.

  Un `default 0` haría que cualquier INSERT que se olvide de la columna cree una
  tarjeta sin saldo: válida, canjeable, y vacía. El fallo aparecería semanas
  después en manos de un cliente. Sin default, ese INSERT falla en la primera
  prueba. `docs/04` pide exactamente esto para las columnas de dinero: que el
  saldo se declare, nunca se asuma.
*/
alter table public.gift_cards
  alter column balance_cents set not null;

-- `add constraint` no admite `if not exists`, y una migración tiene que poder
-- volver a pasar sin romperse.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'gift_cards_balance_no_negativo'
  ) then
    alter table public.gift_cards
      add constraint gift_cards_balance_no_negativo check (balance_cents >= 0);
  end if;
end $$;

-- Buscar las que aún deben dinero es la consulta del pasivo pendiente.
create index if not exists gift_cards_con_saldo_idx
  on public.gift_cards(status) where balance_cents > 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- Emisión — la tarjeta nace con todo su importe disponible
-- ─────────────────────────────────────────────────────────────────────────────
/*
  Igual que en 0009 salvo por el `balance_cents` del INSERT. Se repite entera
  porque `create or replace` no admite parches: o está el cuerpo completo, o no
  está la función.
*/
create or replace function public.emitir_gift_card(
  p_stripe_event_id text,
  p_event_type text,
  p_session_id text,
  p_payment_intent_id text,
  p_code_hash text,
  p_code_last4 text
)
returns table(gift_card_id uuid, order_id uuid, amount_cents bigint, ya_procesado boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.gift_card_orders%rowtype;
  v_card public.gift_cards%rowtype;
begin
  if exists (
    select 1 from public.stripe_webhook_events
     where stripe_event_id = p_stripe_event_id and status = 'processed'
  ) then
    select o.* into v_order from public.gift_card_orders o
     where o.stripe_checkout_session_id = p_session_id;
    if not found then
      raise exception 'pedido_no_encontrado';
    end if;
    select c.* into v_card from public.gift_cards c where c.order_id = v_order.id;
    return query select v_card.id, v_order.id, v_order.amount_cents, true;
    return;
  end if;

  insert into public.stripe_webhook_events (stripe_event_id, event_type, status)
  values (p_stripe_event_id, p_event_type, 'processing')
  on conflict (stripe_event_id) do nothing;

  select o.* into v_order
    from public.gift_card_orders o
   where o.stripe_checkout_session_id = p_session_id
     for update;

  if not found then
    raise exception 'pedido_no_encontrado';
  end if;

  if v_order.status = 'paid' then
    select c.* into v_card from public.gift_cards c where c.order_id = v_order.id;
    update public.stripe_webhook_events
       set status = 'processed', processed_at = now()
     where stripe_event_id = p_stripe_event_id;
    return query select v_card.id, v_order.id, v_order.amount_cents, true;
    return;
  end if;

  update public.gift_card_orders
     set status = 'paid',
         paid_at = now(),
         stripe_payment_intent_id = coalesce(p_payment_intent_id, stripe_payment_intent_id)
   where id = v_order.id;

  insert into public.gift_cards (order_id, code_hash, code_last4, amount_cents, balance_cents)
  values (v_order.id, p_code_hash, p_code_last4, v_order.amount_cents, v_order.amount_cents)
  returning * into v_card;

  insert into public.audit_logs (
    actor_user_id, target_user_id, action, entity_type, entity_id, reason, after_data
  ) values (
    null, v_order.purchaser_user_id, 'gift_card_issued', 'gift_card', v_card.id::text,
    'Pago confirmado por webhook de Stripe',
    jsonb_build_object('order_id', v_order.id, 'amount_cents', v_order.amount_cents,
                       'stripe_event_id', p_stripe_event_id)
  );

  update public.stripe_webhook_events
     set status = 'processed', processed_at = now()
   where stripe_event_id = p_stripe_event_id;

  return query select v_card.id, v_order.id, v_order.amount_cents, false;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Canje parcial
-- ─────────────────────────────────────────────────────────────────────────────
/*
  La versión de dos argumentos se elimina, no se deja convivir.

  Con `p_amount_cents` y `p_client_request_id` por defecto NULL, dejar viva la
  antigua haría que `canjear_gift_card(uuid, text)` fuera ambigua y Postgres
  rechazara toda llamada de dos argumentos. Mejor que desaparezca: así ninguna
  ruta puede seguir canjeando con la semántica de todo-o-nada sin enterarse.
*/
drop function if exists public.canjear_gift_card(uuid, text);

/*
  Canjea PARTE de una tarjeta y acredita el wallet, atómicamente.

  `p_amount_cents` NULL significa «todo lo que quede», que es lo que hacía la
  versión anterior y sigue siendo el caso normal desde la pantalla de canje.

  ── Sobre la idempotencia, que es lo único que cambia de fondo ──

  Antes la clave del ledger era `giftcard:<id>`: una tarjeta, un crédito, y un
  segundo intento con el mismo código chocaba contra la clave y no acreditaba
  nada. Esa clave ya no sirve, porque ahora varios créditos sobre la misma
  tarjeta son legítimos.

  La sustituye `giftcard:<id>:<usuario>:<peticion>`:

   · `<usuario>` está dentro a propósito. Sin él, dos personas que comparten un
     código y envían la misma `p_client_request_id` colisionarían, y la segunda
     recibiría de vuelta el movimiento de la primera —con el saldo del wallet
     ajeno— en lugar de su propio crédito.
   · `<peticion>` la pone el navegador, una por intento de envío. Un doble clic
     o un fetch reintentado repiten la clave y no duplican nada; un canje nuevo
     y deliberado trae una distinta y sí acredita.
   · Si llega NULL se genera un UUID, igual que hace `admin_ajustar_wallet` con
     su referencia. Pierde la protección ante reintentos, pero nunca colisiona
     en silencio, que sería peor.

  La comprobación va ANTES de tocar el saldo. Al revés —descontar y luego dejar
  que `apply_wallet_transaction` detecte la clave repetida y no acredite— la
  tarjeta perdería dinero sin que nadie lo recibiera.
*/
create or replace function public.canjear_gift_card(
  p_user_id uuid,
  p_code_hash text,
  p_amount_cents bigint default null,
  p_client_request_id text default null
)
returns table(
  credited_cents bigint,
  new_balance_cents bigint,
  receipt_id uuid,
  card_balance_cents bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card public.gift_cards%rowtype;
  v_tx uuid;
  v_saldo bigint;
  v_importe bigint;
  v_restante bigint;
  v_clave text;
  v_previo public.wallet_transactions%rowtype;
begin
  select c.* into v_card
    from public.gift_cards c
   where c.code_hash = p_code_hash
     for update;

  if not found then
    raise exception 'codigo_invalido';
  end if;

  v_clave := 'giftcard:' || v_card.id::text || ':' || p_user_id::text || ':' ||
             coalesce(p_client_request_id, gen_random_uuid()::text);

  /*
    Reenvío de una petición ya aplicada: se devuelve lo que ocurrió entonces y
    no se toca nada. Va por delante de las validaciones de estado para que
    reintentar el canje de una tarjeta que entretanto se anuló devuelva su
    resultado original en vez de un 'cancelada' que confundiría a quien ya vio
    el dinero en su saldo.
  */
  select wt.* into v_previo
    from public.wallet_transactions wt
   where wt.idempotency_key = v_clave;

  if found then
    return query
      select v_previo.amount_cents, v_previo.balance_after_cents, v_previo.id,
             v_card.balance_cents;
    return;
  end if;

  if v_card.status = 'cancelled' then
    raise exception 'cancelada';
  end if;

  -- Mismo criterio que 0009: `expires_at < now()` YA es la expiración, así que
  -- no se escribe ningún `status = 'expired'` que la excepción revertiría.
  if v_card.expires_at is not null and v_card.expires_at < now() then
    raise exception 'expirada';
  end if;

  -- Sin saldo es lo que antes era `status = 'redeemed'`. Se conserva el nombre
  -- del error porque es el que la aplicación ya sabe traducir.
  if v_card.balance_cents <= 0 then
    raise exception 'ya_canjeada';
  end if;

  v_importe := coalesce(p_amount_cents, v_card.balance_cents);

  if v_importe <= 0 then
    raise exception 'importe_invalido';
  end if;
  if v_importe > v_card.balance_cents then
    raise exception 'saldo_insuficiente';
  end if;

  v_restante := v_card.balance_cents - v_importe;

  /*
    `redeemed_by_user_id` y `redeemed_at` pasan a significar «quién la agotó y
    cuándo», y solo se escriben en el canje que la deja a cero. Con canje
    parcial la tarjeta puede pasar por varias manos, y el rastro completo de
    quién sacó qué está en `wallet_transactions`, que es el ledger y no se
    reescribe.
  */
  update public.gift_cards
     set balance_cents = v_restante,
         status = case when v_restante = 0 then 'redeemed' else status end,
         redeemed_by_user_id = case when v_restante = 0 then p_user_id else redeemed_by_user_id end,
         redeemed_at = case when v_restante = 0 then now() else redeemed_at end
   where id = v_card.id;

  select t.transaction_id, t.new_balance_cents into v_tx, v_saldo
    from public.apply_wallet_transaction(
      p_user_id,
      v_importe,
      'gift_card_redemption',
      v_clave,
      v_card.id::text,
      'Canje de gift card ····' || v_card.code_last4
    ) t;

  insert into public.audit_logs (
    actor_user_id, target_user_id, action, entity_type, entity_id, reason, after_data
  ) values (
    p_user_id, p_user_id, 'gift_card_redeemed', 'gift_card', v_card.id::text,
    'Canje desde la cuenta del usuario',
    jsonb_build_object('amount_cents', v_importe, 'balance_after', v_saldo,
                       'card_balance_after', v_restante)
  );

  return query select v_importe, v_saldo, v_tx, v_restante;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Recarga
-- ─────────────────────────────────────────────────────────────────────────────
/*
  Añade saldo a una tarjeta. Solo la dueña, con motivo y auditado.

  Esto crea crédito de la nada: no hay ningún cobro de Stripe detrás. Es la
  misma naturaleza que `admin_ajustar_wallet` y por eso lleva los mismos frenos
  —rol comprobado en SQL, motivo obligatorio, tope por operación— y no un
  permiso propio. Una recarga pagada por el cliente sería otra cosa y entraría
  por webhook, como toda acreditación con dinero detrás (`docs/06`).

  Recargar una agotada la revive: mismo código, otra vez válido. Es la decisión
  cómoda para el cliente de siempre, y por eso limpia `redeemed_at` y
  `redeemed_by_user_id` —ya no está agotada, y quién la agotó la vez anterior
  queda en el `before_data` del audit log, no en la fila.

  Sobre una anulada NO se puede: primero se reactiva. Son dos decisiones y el
  panel las audita por separado, igual que hace `admin_gift_card_rotar_codigo`.
*/
create or replace function public.admin_gift_card_recargar(
  p_actor_id uuid,
  p_gift_card_id uuid,
  p_amount_cents bigint,
  p_reason text,
  p_request_id text default null
)
returns table (saldo_cents bigint, estado text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card public.gift_cards%rowtype;
  v_saldo bigint;
  v_estado text;
begin
  if not public.es_duena(p_actor_id) then
    raise exception 'no_autorizado';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'motivo_obligatorio';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'importe_invalido';
  end if;

  -- El mismo tope que el ajuste de wallet ($5.000). No es regla de negocio: es
  -- un freno ante un dedo torpe, y se repite aquí porque la validación de la
  -- aplicación no puede ser la única (`docs/04`).
  if p_amount_cents > 500000 then
    raise exception 'importe_excesivo';
  end if;

  select c.* into v_card from public.gift_cards c where c.id = p_gift_card_id for update;
  if not found then
    raise exception 'tarjeta_no_encontrada';
  end if;

  if v_card.status = 'cancelled' then
    raise exception 'tarjeta_anulada';
  end if;

  if v_card.expires_at is not null and v_card.expires_at < now() then
    raise exception 'tarjeta_caducada';
  end if;

  v_saldo := v_card.balance_cents + p_amount_cents;
  v_estado := 'active';

  update public.gift_cards
     set balance_cents = v_saldo,
         status = 'active',
         redeemed_at = null,
         redeemed_by_user_id = null
   where id = p_gift_card_id;

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id, reason, before_data, after_data, request_id
  ) values (
    p_actor_id, 'gift_card_recargada', 'gift_card', p_gift_card_id::text, btrim(p_reason),
    jsonb_build_object('status', v_card.status, 'balance_cents', v_card.balance_cents,
                       'last4', v_card.code_last4, 'redeemed_at', v_card.redeemed_at,
                       'redeemed_by_user_id', v_card.redeemed_by_user_id),
    jsonb_build_object('status', v_estado, 'balance_cents', v_saldo,
                       'amount_cents', p_amount_cents),
    p_request_id
  );

  return query select v_saldo, v_estado;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- El pasivo pendiente ya no es el importe emitido
-- ─────────────────────────────────────────────────────────────────────────────
/*
  `giftcards_breakage_cents` sumaba `amount_cents` de las activas. Con saldo
  parcial eso deja de ser el dinero que el negocio debe: una tarjeta de $100 con
  $10 dentro seguiría contando $100 y el pasivo aparecería inflado nueve veces.

  Se suma `balance_cents`, que es lo que queda por servir. `giftcards_gmv_cents`
  no se toca: eso es venta cobrada y sale de los pedidos, no de las tarjetas.
*/
create or replace function public.metricas_resumen()
returns table (
  miembros bigint,
  miembros_7d bigint,
  miembros_30d bigint,
  con_marketing bigint,
  correo_confirmado bigint,
  perfil_visitado bigint,
  saldo_total_cents bigint,
  wallets_con_saldo bigint,
  puntos_total bigint,
  pedidos_totales bigint,
  pedidos_pagados bigint,
  giftcards_gmv_cents bigint,
  giftcards_sin_canjear bigint,
  giftcards_breakage_cents bigint,
  suscriptores bigint,
  entradas_auditoria bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.profiles),
    (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
    (select count(*) from public.profiles where created_at >= now() - interval '30 days'),
    (select count(*) from public.profiles where marketing_email_opt_in),
    (select count(*) from auth.users where email_confirmed_at is not null),
    (select count(distinct user_id) from public.member_qr_tokens),
    (select coalesce(sum(balance_cents), 0) from public.wallets),
    (select count(*) from public.wallets where balance_cents > 0),
    (select coalesce(sum(points_balance), 0) from public.loyalty_accounts),
    (select count(*) from public.gift_card_orders),
    (select count(*) from public.gift_card_orders where status = 'paid'),
    (select coalesce(sum(amount_cents), 0) from public.gift_card_orders where status = 'paid'),
    (select count(*) from public.gift_cards where status = 'active'),
    (select coalesce(sum(balance_cents), 0) from public.gift_cards where status = 'active'),
    (select count(*) from public.newsletter_subscribers where unsubscribed_at is null),
    (select count(*) from public.audit_logs);
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Permisos: solo el servidor. El navegador nunca alcanza estas funciones.
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on function public.canjear_gift_card(uuid,text,bigint,text) from public, anon, authenticated;
grant execute on function public.canjear_gift_card(uuid,text,bigint,text) to service_role;

revoke all on function public.admin_gift_card_recargar(uuid,uuid,bigint,text,text) from public, anon, authenticated;
grant execute on function public.admin_gift_card_recargar(uuid,uuid,bigint,text,text) to service_role;

revoke all on function public.metricas_resumen() from public, anon, authenticated;
grant execute on function public.metricas_resumen() to service_role;

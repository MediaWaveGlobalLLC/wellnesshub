-- Fase 5 — emisión y canje de gift cards.
--
-- Las tablas base (`gift_card_orders`, `gift_cards`, `stripe_webhook_events`)
-- ya existen desde `0001`. Aquí van las dos operaciones que tienen que ser
-- atómicas o no ser: el fulfillment del pago y el canje.

-- ─────────────────────────────────────────────────────────────────────────────
-- Control de intentos de canje
-- ─────────────────────────────────────────────────────────────────────────────
-- `docs/06` pide rate limit en el canje. Sin él, un código de 128 bits sigue
-- siendo inatacable por fuerza bruta, pero un bucle de intentos permitiría
-- sondear qué códigos existen midiendo tiempos de respuesta.

create table if not exists public.gift_card_redeem_attempts (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  ip text,
  exito boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists redeem_attempts_user_idx
  on public.gift_card_redeem_attempts(user_id, created_at desc);

alter table public.gift_card_redeem_attempts enable row level security;
-- Sin políticas: solo el servidor lo consulta.

-- ─────────────────────────────────────────────────────────────────────────────
-- Fulfillment del pago
-- ─────────────────────────────────────────────────────────────────────────────
/*
  Marca el pedido como pagado y emite la tarjeta, en una sola transacción.

  Idempotente por `stripe_event_id`: Stripe reintenta los webhooks, y sin esto
  un reintento emitiría una segunda tarjeta por el mismo pago. La clave primaria
  de `stripe_webhook_events` es la que hace de cerrojo.

  Devuelve la tarjeta creada, o la que ya existía si el evento se repite. El
  código en claro nunca pasa por aquí: llega ya hasheado.
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
  -- Si el evento ya se proceso, se devuelve lo emitido y no se toca nada.
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

  -- Bloquea el pedido: dos entregas simultáneas del mismo evento se serializan.
  select o.* into v_order
    from public.gift_card_orders o
   where o.stripe_checkout_session_id = p_session_id
     for update;

  if not found then
    raise exception 'pedido_no_encontrado';
  end if;

  -- El pedido ya estaba pagado (por ejemplo, otro tipo de evento lo cerró):
  -- se devuelve la tarjeta existente en lugar de emitir otra.
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

  insert into public.gift_cards (order_id, code_hash, code_last4, amount_cents)
  values (v_order.id, p_code_hash, p_code_last4, v_order.amount_cents)
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
-- Canje
-- ─────────────────────────────────────────────────────────────────────────────
/*
  Canjea una tarjeta y acredita el wallet, atómicamente.

  El `for update` sobre la fila de la tarjeta es lo que impide el doble canje:
  dos peticiones simultáneas con el mismo código se serializan, y la segunda ve
  el estado ya cambiado a 'redeemed'.

  Los errores se distinguen a propósito —inexistente, ya canjeada, cancelada,
  expirada— porque son estados que la persona necesita entender. No revelan
  nada: para llegar aquí hay que acertar un código de 128 bits.
*/
create or replace function public.canjear_gift_card(
  p_user_id uuid,
  p_code_hash text
)
returns table(credited_cents bigint, new_balance_cents bigint, receipt_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card public.gift_cards%rowtype;
  v_tx uuid;
  v_saldo bigint;
begin
  select c.* into v_card
    from public.gift_cards c
   where c.code_hash = p_code_hash
     for update;

  if not found then
    raise exception 'codigo_invalido';
  end if;

  if v_card.status = 'redeemed' then
    raise exception 'ya_canjeada';
  end if;
  if v_card.status = 'cancelled' then
    raise exception 'cancelada';
  end if;
  /*
    No se escribe `status = 'expired'` antes de abortar: la excepción revierte
    la transacción entera, así que ese update nunca sobreviviría. Y aunque
    sobreviviera sería una copia derivable —`expires_at < now()` YA es la
    expiración—, del mismo tipo que la columna `tier` que se eliminó en 0006.
    Una sola fuente de verdad.
  */
  if v_card.expires_at is not null and v_card.expires_at < now() then
    raise exception 'expirada';
  end if;

  update public.gift_cards
     set status = 'redeemed', redeemed_by_user_id = p_user_id, redeemed_at = now()
   where id = v_card.id;

  -- La clave de idempotencia es la tarjeta: aunque algo reintentara, el ledger
  -- no duplicaría el crédito.
  select t.transaction_id, t.new_balance_cents into v_tx, v_saldo
    from public.apply_wallet_transaction(
      p_user_id,
      v_card.amount_cents,
      'gift_card_redemption',
      'giftcard:' || v_card.id::text,
      v_card.id::text,
      'Canje de gift card ····' || v_card.code_last4
    ) t;

  insert into public.audit_logs (
    actor_user_id, target_user_id, action, entity_type, entity_id, reason, after_data
  ) values (
    p_user_id, p_user_id, 'gift_card_redeemed', 'gift_card', v_card.id::text,
    'Canje desde la cuenta del usuario',
    jsonb_build_object('amount_cents', v_card.amount_cents, 'balance_after', v_saldo)
  );

  return query select v_card.amount_cents, v_saldo, v_tx;
end;
$$;

-- Solo el servidor. El navegador nunca alcanza estas funciones.
revoke all on function public.emitir_gift_card(text,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.canjear_gift_card(uuid,text) from public, anon, authenticated;
grant execute on function public.emitir_gift_card(text,text,text,text,text,text) to service_role;
grant execute on function public.canjear_gift_card(uuid,text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0025 — Se retira el café de bienvenida de la primera recarga.
--
-- `0024_recarga_saldo` regalaba un café por la primera recarga de $20 o más.
-- La dueña retira la promoción (1 de agosto de 2026). Aquí deja de otorgarse.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- LO QUE **NO** HACE ESTA MIGRACIÓN, Y ES DELIBERADO
--
-- No toca ni un solo `loyalty_redemptions` ya emitido.
--
-- Cada uno de esos códigos es un café que alguien ya se ganó, con su recarga ya
-- pagada. Borrarlos o marcarlos caducados sería quitarle algo que ya tiene a
-- quien confió primero en el sitio, y encima sin avisarle: descubriría que su
-- código no vale al pedirlo en el mostrador. Retirar una promoción es dejar de
-- darla, no quitársela a quien ya la tiene.
--
-- Se listan los pendientes con:
--
--   select count(*) from public.loyalty_redemptions
--    where origen = 'promocion' and estado = 'pendiente';
--
-- Tampoco se borra la fila `cafe_bienvenida` de `loyalty_rewards`. Sigue con
-- `activa = false` —nunca apareció en «canjea tus puntos»— y los canjes ya
-- emitidos apuntan a ella por clave foránea: borrarla los rompería. Se queda
-- como lo que es, el registro de una promoción que existió.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ SE REESCRIBE LA FUNCIÓN Y NO SE BORRA LA RECOMPENSA
--
-- La función ya tolera que la recompensa no exista: avisa con `raise warning` y
-- acredita el saldo igual. O sea que borrando la fila la promoción también
-- moriría. Sería un apaño malo: cada primera recarga de $20 dejaría un warning
-- en los logs de producción, y un warning dice «esto está roto» cuando lo que
-- pasa es que alguien tomó una decisión. Los logs son para lo que va mal.
-- ─────────────────────────────────────────────────────────────────────────────

/*
  Misma firma y mismo tipo de retorno que en `0024`, para que valga un
  `create or replace` y no haga falta un DROP que dejaría la función un instante
  sin existir mientras el webhook de Stripe puede estar llamándola.

  `cafe_otorgado` se mantiene en el retorno y devuelve siempre `false`. Quitar
  la columna obligaría a un DROP, a cambiar `src/lib/recarga/service.ts` y la
  ruta del webhook, y a que un despliegue a medias —función nueva, código
  viejo— reventara el cobro de una recarga ya pagada. La columna se queda,
  diciendo la verdad: no se otorgó ningún café.
*/
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
    Aquí iba el conteo de recargas previas, que existía solo para saber si esta
    era la primera y tocaba café. Sin promoción no hay nada que contar: una
    consulta que no decide nada es una consulta que alguien reactivará por
    error dentro de un año.
  */

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

  insert into public.audit_logs (
    actor_user_id, target_user_id, action, entity_type, entity_id, reason, after_data
  ) values (
    null, v_recarga.user_id, 'recarga_confirmada', 'wallet_topup', v_recarga.id::text,
    'Pago confirmado por webhook de Stripe',
    jsonb_build_object('amount_cents', v_recarga.amount_cents, 'balance_after', v_saldo,
                       'stripe_event_id', p_stripe_event_id, 'cafe', false)
  );

  update public.stripe_webhook_events
     set status = 'processed', processed_at = now()
   where stripe_event_id = p_stripe_event_id;

  return query select v_recarga.id, v_saldo, false, false;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Permisos
-- ─────────────────────────────────────────────────────────────────────────────
/*
  `create or replace` CONSERVA los privilegios de la función anterior, así que
  esto es redundante hoy. Se repite igual: si algún día alguien convierte esto
  en un DROP + CREATE —por cambiar el retorno, por ejemplo—, la función nacería
  ejecutable por `anon` y acreditaría saldo a quien la llamara. Es la clase de
  regalo que no se detecta hasta que lo encuentra alguien.
*/
do $$
begin
  execute 'revoke all on function public.confirmar_recarga(text,text,text,text) from public, anon, authenticated';
  execute 'grant execute on function public.confirmar_recarga(text,text,text,text) to service_role';
end $$;

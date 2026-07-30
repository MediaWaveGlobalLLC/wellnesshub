-- Fase 4 — rol administrativo y trazabilidad de los ajustes.
--
-- `docs/06`: el rol debe vivir en un sitio que el usuario no pueda editar.
-- `user_metadata` queda descartado porque lo escribe el propio cliente al
-- registrarse. Aquí se usa una tabla privada sin ninguna política RLS: no hay
-- forma de leerla ni escribirla desde el navegador, solo desde el servidor con
-- `service_role` después de autorizar.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
-- Intencionadamente sin políticas: RLS deniega por defecto y ni `anon` ni
-- `authenticated` pueden mirar quién es administrador.

/*
  Ajuste manual de saldo con auditoría, en una sola transacción.

  `apply_wallet_transaction` ya garantiza la atomicidad e idempotencia del
  movimiento. Lo que añade esta función es que el ajuste y su registro de
  auditoría vivan o mueran juntos: si el audit_log fallara, el crédito no se
  aplica. Un ajuste manual sin rastro es exactamente lo que `docs/06` prohíbe.

  El motivo es obligatorio y se valida aquí, no solo en la capa HTTP: así no hay
  ninguna ruta que pueda saltárselo.
*/
create or replace function public.admin_ajustar_wallet(
  p_actor_id uuid,
  p_target_id uuid,
  p_amount_cents bigint,
  p_reason text,
  p_reference text default null,
  p_request_id text default null
)
returns table(transaction_id uuid, new_balance_cents bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saldo_antes bigint;
  v_tx uuid;
  v_saldo bigint;
begin
  if not exists (select 1 from public.admin_users where user_id = p_actor_id) then
    raise exception 'no_autorizado';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'motivo_obligatorio';
  end if;

  select balance_cents into v_saldo_antes from public.wallets where user_id = p_target_id;

  select t.transaction_id, t.new_balance_cents into v_tx, v_saldo
    from public.apply_wallet_transaction(
      p_target_id,
      p_amount_cents,
      'admin_adjustment',
      -- La clave de idempotencia incluye la referencia: reenviar el mismo
      -- ticket no duplica el ajuste.
      'admin:' || p_actor_id::text || ':' || coalesce(p_reference, gen_random_uuid()::text),
      p_reference,
      btrim(p_reason)
    ) t;

  insert into public.audit_logs (
    actor_user_id, target_user_id, action, entity_type, entity_id,
    reason, before_data, after_data, request_id
  ) values (
    p_actor_id, p_target_id, 'wallet_adjustment', 'wallet', p_target_id::text,
    btrim(p_reason),
    jsonb_build_object('balance_cents', v_saldo_antes),
    jsonb_build_object('balance_cents', v_saldo, 'amount_cents', p_amount_cents),
    p_request_id
  );

  return query select v_tx, v_saldo;
end;
$$;

/* Mismo patrón para puntos. Son sistemas separados y no se tocan a la vez. */
create or replace function public.admin_ajustar_puntos(
  p_actor_id uuid,
  p_target_id uuid,
  p_points bigint,
  p_reason text,
  p_reference text default null,
  p_request_id text default null
)
returns table(transaction_id uuid, new_points_balance bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes bigint;
  v_tx uuid;
  v_saldo bigint;
begin
  if not exists (select 1 from public.admin_users where user_id = p_actor_id) then
    raise exception 'no_autorizado';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'motivo_obligatorio';
  end if;

  select points_balance into v_antes from public.loyalty_accounts where user_id = p_target_id;

  select t.transaction_id, t.new_points_balance into v_tx, v_saldo
    from public.apply_loyalty_transaction(
      p_target_id,
      p_points,
      'admin_adjustment',
      'admin:' || p_actor_id::text || ':' || coalesce(p_reference, gen_random_uuid()::text),
      p_reference,
      btrim(p_reason)
    ) t;

  insert into public.audit_logs (
    actor_user_id, target_user_id, action, entity_type, entity_id,
    reason, before_data, after_data, request_id
  ) values (
    p_actor_id, p_target_id, 'points_adjustment', 'loyalty_account', p_target_id::text,
    btrim(p_reason),
    jsonb_build_object('points_balance', v_antes),
    jsonb_build_object('points_balance', v_saldo, 'points', p_points),
    p_request_id
  );

  return query select v_tx, v_saldo;
end;
$$;

-- Solo el servidor. Ni `anon` ni `authenticated` pueden invocarlas aunque
-- conozcan el nombre.
revoke all on function public.admin_ajustar_wallet(uuid,uuid,bigint,text,text,text) from public, anon, authenticated;
revoke all on function public.admin_ajustar_puntos(uuid,uuid,bigint,text,text,text) from public, anon, authenticated;
grant execute on function public.admin_ajustar_wallet(uuid,uuid,bigint,text,text,text) to service_role;
grant execute on function public.admin_ajustar_puntos(uuid,uuid,bigint,text,text,text) to service_role;

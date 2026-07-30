-- ─────────────────────────────────────────────────────────────────────────────
-- 0012 — Dos niveles de administración: dueña y empleado.
--
-- Hasta ahora `admin_users` era binaria: o estabas dentro y podías mover dinero
-- ajeno, o estabas fuera. Para que alguien del mostrador pueda consultar una
-- cuenta o marcar un producto agotado hacía falta darle también la capacidad de
-- ajustar saldos, que es justo lo que no se quiere.
--
-- El rol se comprueba AQUÍ, en SQL, no solo en la aplicación. Una interfaz que
-- esconde un botón no es autorización: si mañana alguien llama al endpoint a
-- mano, quien decide es la base de datos.
--
-- `default 'duena'` no es pereza: es lo que impide que aplicar esta migración
-- deje fuera a los administradores que ya existen. Quien ya estaba, sigue
-- pudiendo todo.
-- ─────────────────────────────────────────────────────────────────────────────

/*
  La clave va sin eñe: `duena`, no `dueña`.

  Es la convención que ya sigue el proyecto — `loyalty_tiers` guarda
  `key = 'raiz'` con `label = 'Raíz'`, y `loyalty_rules` guarda
  `key = 'cumpleanos'` con `label = 'Bono de cumpleaños'`. La clave es para las
  máquinas y viaja por comparaciones, tipos de TypeScript y a veces URLs; el
  acento es para la persona que lee la pantalla. La interfaz escribe «Dueña».
*/
alter table public.admin_users
  add column if not exists rol text not null default 'duena'
    check (rol in ('duena', 'empleado'));

comment on column public.admin_users.rol is
  'duena: todo, incluido mover dinero. empleado: consultar y marcar agotados.';

/*
  Atajo legible para el resto de funciones administrativas.

  `stable` porque dentro de una misma consulta el rol no cambia, y eso permite
  a Postgres no reevaluarla fila a fila.
*/
create or replace function public.es_duena(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admin_users
     where user_id = p_user_id and rol = 'duena'
  );
$$;

revoke all on function public.es_duena(uuid) from public, anon, authenticated;
grant execute on function public.es_duena(uuid) to service_role;

/*
  Cerrojo: la tabla no puede quedarse sin ninguna dueña.

  Sin esto, degradar a la última dueña —o borrarla— deja el negocio sin nadie
  que pueda ajustar un saldo ni nombrar a otro administrador, y recuperarlo
  exige entrar a la base de datos a mano.

  `constraint trigger ... deferrable initially deferred` comprueba al final de
  la transacción, no fila a fila. Eso permite el traspaso legítimo —degradar a
  una y promocionar a otra en la misma transacción— sin que falle a mitad.
*/
create or replace function public.admin_users_exigir_una_duena()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.admin_users where rol = 'duena') then
    raise exception 'ultima_duena';
  end if;
  return null;
end;
$$;

drop trigger if exists admin_users_una_duena on public.admin_users;
create constraint trigger admin_users_una_duena
  after update or delete on public.admin_users
  deferrable initially deferred
  for each row execute function public.admin_users_exigir_una_duena();

-- ─────────────────────────────────────────────────────────────────────────────
-- Las dos funciones de dinero pasan a exigir rol de dueña.
--
-- Se recrean enteras en vez de parchear: `create or replace` sustituye el
-- cuerpo completo y así queda a la vista qué ejecuta hoy la base de datos, sin
-- tener que leer dos migraciones a la vez para reconstruirlo mentalmente.
--
-- Lo único que cambia respecto a `0008` es la condición de autorización.
-- ─────────────────────────────────────────────────────────────────────────────

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
  -- Antes bastaba con estar en `admin_users`. Ahora hace falta ser dueña: un
  -- empleado que llegue hasta aquí se topa con el mismo 'no_autorizado' que
  -- alguien de fuera, sin pistas sobre por qué.
  if not public.es_duena(p_actor_id) then
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
  if not public.es_duena(p_actor_id) then
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

-- `create or replace` conserva los permisos existentes, pero se repiten para
-- que esta migración sea legible sin ir a buscar la 0008.
revoke all on function public.admin_ajustar_wallet(uuid,uuid,bigint,text,text,text) from public, anon, authenticated;
revoke all on function public.admin_ajustar_puntos(uuid,uuid,bigint,text,text,text) from public, anon, authenticated;
grant execute on function public.admin_ajustar_wallet(uuid,uuid,bigint,text,text,text) to service_role;
grant execute on function public.admin_ajustar_puntos(uuid,uuid,bigint,text,text,text) to service_role;

-- Fase 2 — preferencia de comunicación en el alta.
--
-- `0001_siembra_core.sql` crea el perfil desde raw_user_meta_data pero no lee
-- marketing_email_opt_in, así que el consentimiento del formulario de registro
-- se perdía. Esta migración reemplaza la función; el trigger sigue siendo el
-- mismo y no se toca la migración base.
--
-- Idempotente: `create or replace`.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, phone, marketing_email_opt_in)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'first_name', ''),
    nullif(new.raw_user_meta_data ->> 'last_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    -- El opt-in es explícito: cualquier valor ausente o no booleano queda en false.
    coalesce((new.raw_user_meta_data ->> 'marketing_email_opt_in')::boolean, false)
  ) on conflict (id) do nothing;

  insert into public.wallets (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.loyalty_accounts (user_id) values (new.id) on conflict (user_id) do nothing;

  return new;
end;
$$;

-- El usuario puede cambiar su preferencia desde /perfil/editar, pero nunca su
-- member_id ni las marcas de tiempo. RLS ya limita el UPDATE a su propia fila;
-- este trigger impide además que altere columnas de identidad.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
as $$
begin
  new.id := old.id;
  new.member_id := old.member_id;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_protect_columns on public.profiles;
create trigger profiles_protect_columns
before update on public.profiles
for each row execute procedure public.protect_profile_columns();

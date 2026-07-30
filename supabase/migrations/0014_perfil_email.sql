-- ─────────────────────────────────────────────────────────────────────────────
-- 0014 — El correo baja a `profiles`, y la búsqueda de administración deja de
-- tener techo.
--
-- El problema: el correo vive en `auth.users`, al que no se llega con un JOIN
-- normal desde PostgREST. `buscarUsuarios` lo resolvía trayéndose la lista
-- entera de usuarios y filtrando en JavaScript:
--
--     servicio.auth.admin.listUsers({ page: 1, perPage: 200 })
--
-- Doscientos. Con el socio 201 en adelante, buscar por correo deja de
-- encontrarlos. No da error: simplemente dice «Sin resultados» sobre una cuenta
-- que existe. Y la llamada se hacía DOS veces por búsqueda.
--
-- La solución no es paginar —serían N peticiones por cada listado— sino tener
-- el dato donde se busca. `profiles` ya guarda nombre, apellido y teléfono: el
-- correo no cambia la naturaleza de la tabla ni su exposición, porque
-- `profiles_select_own` limita la lectura a la fila propia y el correo de uno
-- ya lo conoce uno.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles add column if not exists email text;

-- Relleno inicial. Idempotente: se puede reaplicar sin efectos.
update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id
   and p.email is distinct from u.email;

-- Búsqueda por correo insensible a mayúsculas, y listado por fecha de alta.
create index if not exists profiles_email_idx on public.profiles (lower(email));
create index if not exists profiles_created_idx on public.profiles (created_at desc);

/*
  El correo lo manda `auth.users`. Aquí solo hay una copia, y una copia que se
  desincroniza es peor que no tenerla: la administración buscaría por un correo
  que ya no es el de la persona.
*/
create or replace function public.sincronizar_email_perfil()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.sincronizar_email_perfil();

/*
  Y el alta también lo escribe, para que un socio nuevo sea buscable desde el
  primer segundo en vez de a partir de su primer cambio de correo.

  Se recrea la función entera de `0002` añadiendo una columna. El resto es
  idéntico.
*/
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, first_name, last_name, phone, marketing_email_opt_in)
  values (
    new.id,
    new.email,
    -- Los `nullif` vienen de `0002` y no son decorativos: sin ellos un campo
    -- vacío del formulario se guarda como cadena vacía en vez de NULL, y el
    -- nombre compuesto acaba con espacios sueltos.
    nullif(new.raw_user_meta_data ->> 'first_name', ''),
    nullif(new.raw_user_meta_data ->> 'last_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    -- El opt-in es explícito: cualquier valor ausente o no booleano queda en false.
    coalesce((new.raw_user_meta_data ->> 'marketing_email_opt_in')::boolean, false)
  )
  on conflict (id) do nothing;

  insert into public.wallets (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.loyalty_accounts (user_id) values (new.id) on conflict (user_id) do nothing;

  return new;
end;
$$;

/*
  El correo entra en la lista de columnas que el cliente no puede reescribir.

  Sin esto, cualquiera podría hacer `update profiles set email = ...` sobre su
  propia fila —RLS lo permite, es suya— y quedarse con un correo en `profiles`
  distinto del real de `auth.users`. La administración buscaría por el falso.
  La identidad la fija Supabase Auth, no el formulario de perfil.
*/
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
as $$
begin
  -- Roles del navegador: se restauran las columnas de identidad.
  if current_user in ('anon', 'authenticated') then
    new.id := old.id;
    new.member_id := old.member_id;
    new.created_at := old.created_at;
    new.email := old.email;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Búsqueda de administración en UNA consulta.
--
-- Antes eran cuatro viajes (perfiles, lista de usuarios, lealtad, wallets) más
-- el cruce en memoria. Ahora es un `select` con joins, con paginación de verdad
-- y `count(*) over ()` para saber cuántos hay en total sin una segunda consulta.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_buscar_usuarios(
  p_consulta text default '',
  p_limite integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  member_id text,
  nombre text,
  email text,
  telefono text,
  puntos bigint,
  nivel text,
  saldo_cents bigint,
  alta timestamptz,
  total bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with filtrado as (
    select p.*
      from public.profiles p
     where btrim(coalesce(p_consulta, '')) = ''
        -- `%` y `_` son comodines de LIKE: escaparlos evita que buscar un guion
        -- bajo devuelva a todo el mundo.
        or p.first_name ilike '%' || replace(replace(btrim(p_consulta), '%', '\%'), '_', '\_') || '%'
        or p.last_name  ilike '%' || replace(replace(btrim(p_consulta), '%', '\%'), '_', '\_') || '%'
        or p.phone      ilike '%' || replace(replace(btrim(p_consulta), '%', '\%'), '_', '\_') || '%'
        or p.member_id  ilike '%' || replace(replace(btrim(p_consulta), '%', '\%'), '_', '\_') || '%'
        or p.email      ilike '%' || replace(replace(btrim(p_consulta), '%', '\%'), '_', '\_') || '%'
  )
  select
    f.id,
    f.member_id,
    nullif(btrim(concat_ws(' ', f.first_name, f.last_name)), '') as nombre,
    f.email,
    f.phone,
    coalesce(l.points_balance, 0)::bigint,
    coalesce(l.tier, 'semilla'),
    coalesce(w.balance_cents, 0)::bigint,
    f.created_at,
    count(*) over ()::bigint
  from filtrado f
  left join public.loyalty_accounts_con_nivel l on l.user_id = f.id
  left join public.wallets w on w.user_id = f.id
  /*
    El `id` como segundo criterio no es decoración: sin él, dos altas con el
    mismo `created_at` quedan empatadas y Postgres no promete devolverlas
    siempre en el mismo orden. Con LIMIT/OFFSET eso significa que un socio puede
    salir en la página 1 y otra vez en la 2, mientras otro no sale nunca. Pasa
    de verdad: dos registros en el mismo instante bastan.
  */
  order by f.created_at desc, f.id
  limit greatest(p_limite, 1)
  offset greatest(p_offset, 0);
$$;

revoke all on function public.admin_buscar_usuarios(text, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_buscar_usuarios(text, integer, integer) to service_role;

/*
  Freno para los ajustes manuales.

  30 en 15 minutos es holgado para trabajar —nadie corrige treinta cuentas
  seguidas a mano— y estrecho para alguien que se haya hecho con una sesión de
  administración. El cupo va por actor, no por IP: quien responde es quien firma.
*/
insert into public.rate_limit_reglas (accion, max_intentos, ventana_segundos, descripcion) values
  ('admin_ajuste', 30, 900, 'Ajustes manuales de saldo o puntos por administrador, 15 min')
on conflict (accion) do nothing;

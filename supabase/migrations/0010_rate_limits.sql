-- ─────────────────────────────────────────────────────────────────────────────
-- 0010 — Límite de intentos en los endpoints de autenticación (docs/06).
--
-- Por qué en Postgres y no en memoria: la aplicación corre en funciones
-- serverless. Un contador en memoria vive en una instancia concreta, y basta con
-- que el siguiente intento caiga en otra para que el límite no exista. Un
-- contador compartido es la única versión que de verdad limita.
--
-- Los umbrales viven en la base de datos, NO los elige quien llama. La clave
-- publicable de Supabase va en el navegador, así que cualquiera puede invocar
-- esta función: si aceptara un `max` por parámetro, bastaría con pedir un millón
-- para saltarse el límite.
--
-- Alcance honesto: esto protege LOS FORMULARIOS DE ESTA WEB. No impide que
-- alguien ataque la API de Supabase directamente con la clave publicable; de eso
-- se encargan los límites propios de Supabase Auth, que hay que dejar activos.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.rate_limit_reglas (
  accion text primary key,
  max_intentos integer not null check (max_intentos >= 1),
  ventana_segundos integer not null check (ventana_segundos >= 1),
  descripcion text
);

alter table public.rate_limit_reglas enable row level security;
-- Sin políticas a propósito: solo la función security definer las lee.

insert into public.rate_limit_reglas (accion, max_intentos, ventana_segundos, descripcion) values
  ('login',      8,  900,  'Intentos de inicio de sesión por IP + correo, 15 min'),
  ('registro',   5,  3600, 'Cuentas nuevas por IP, 1 hora'),
  ('reset',      4,  3600, 'Correos de recuperación por IP + correo, 1 hora'),
  ('password',   6,  3600, 'Cambios de contraseña por IP, 1 hora')
on conflict (accion) do nothing;

create table if not exists public.rate_limit_hits (
  -- La acción forma parte de la clave. Sin ella, dos acciones distintas con la
  -- misma identidad comparten contador siempre que sus ventanas empiecen a la
  -- vez —y como los tamaños son múltiplos entre sí, eso pasa a menudo: a las
  -- 11:06, la ventana de 15 min y la de 1 hora arrancan ambas a las 11:00—.
  -- El efecto era que agotar el cupo de login bloqueaba también el registro.
  accion text not null references public.rate_limit_reglas(accion) on delete cascade,
  -- SHA-256 de acción + identidad. No se guarda la IP ni el correo en claro:
  -- una tabla de rate limiting no es motivo para acumular datos personales.
  clave_hash text not null,
  ventana_inicio timestamptz not null,
  conteo integer not null default 0,
  primary key (accion, clave_hash, ventana_inicio)
);

alter table public.rate_limit_hits enable row level security;
-- Sin políticas a propósito.

create index if not exists rate_limit_hits_ventana_idx
  on public.rate_limit_hits (ventana_inicio);

-- ─────────────────────────────────────────────────────────────────────────────
-- consumir_rate_limit — cuenta un intento y dice si se permite.
--
-- Ventana fija en vez de deslizante: es una sola fila por clave y ventana, sin
-- historial que purgar por cada petición. A cambio admite una ráfaga a caballo
-- entre dos ventanas; para frenar fuerza bruta contra contraseñas eso sobra.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.consumir_rate_limit(
  p_accion text,
  p_clave_hash text
)
returns table (permitido boolean, restantes integer, reintentar_en integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_regla public.rate_limit_reglas%rowtype;
  v_inicio timestamptz;
  v_conteo integer;
begin
  select * into v_regla from public.rate_limit_reglas where accion = p_accion;
  if not found then
    raise exception 'accion de rate limit desconocida: %', p_accion;
  end if;

  -- Un hash hex de SHA-256 y nada más: evita que se use esta tabla para
  -- almacenar texto arbitrario desde fuera.
  if p_clave_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'clave_hash invalida';
  end if;

  v_inicio := to_timestamp(
    floor(extract(epoch from now()) / v_regla.ventana_segundos) * v_regla.ventana_segundos
  );

  insert into public.rate_limit_hits as h (accion, clave_hash, ventana_inicio, conteo)
  values (p_accion, p_clave_hash, v_inicio, 1)
  on conflict (accion, clave_hash, ventana_inicio)
    do update set conteo = h.conteo + 1
  returning h.conteo into v_conteo;

  -- Limpieza oportunista: una de cada ~100 llamadas barre lo caducado, para no
  -- necesitar un cron. Solo toca ventanas ya cerradas.
  if random() < 0.01 then
    delete from public.rate_limit_hits
     where ventana_inicio < now() - interval '1 day';
  end if;

  return query select
    v_conteo <= v_regla.max_intentos,
    greatest(v_regla.max_intentos - v_conteo, 0),
    ceil(
      extract(epoch from (v_inicio + make_interval(secs => v_regla.ventana_segundos)) - now())
    )::integer;
end;
$$;

revoke all on function public.consumir_rate_limit(text, text) from public;
grant execute on function public.consumir_rate_limit(text, text)
  to anon, authenticated, service_role;

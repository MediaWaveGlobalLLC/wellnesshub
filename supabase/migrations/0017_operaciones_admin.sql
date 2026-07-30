-- ─────────────────────────────────────────────────────────────────────────────
-- 0017 — Las acciones que el panel prometía y no tenía.
--
-- Cuatro huecos, todos del mismo tipo: la base de datos tenía la columna, el
-- CHECK o la tabla desde hace fases, y no había ninguna forma de escribirlos.
--
--  1. Gift cards. `/admin/gift-cards` decía «se puede anular la tarjeta y
--     emitir otra». No se podía: la única salida era Stripe.
--  2. Eventos. `events` y `event_bookings` existen desde 0005. Un evento solo
--     se creaba con SQL a mano, y los estados 'asistio'/'ausente' del CHECK no
--     los escribía nadie: la lista de asistencia no existía.
--  3. Newsletter. `newsletter_subscribers` es WRITE-ONLY desde 0007: se
--     recogían correos que nadie podía consultar salvo entrando a Supabase.
--  4. Administradoras. Solo se nombraba editando `ADMIN_EMAIL_ALLOWLIST` y
--     redesplegando, aunque `admin_users` tiene `granted_by` y `note`
--     precisamente para esto.
--
-- Todas siguen el patrón de 0008 y 0015: comprueban el rol EN SQL, exigen
-- motivo, capturan el antes, aplican y escriben `audit_logs` en la misma
-- transacción. Si el log falla, el cambio no ocurre.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- GIFT CARDS
--
-- «Reemitir» aquí significa ROTAR EL CÓDIGO, no crear una tarjeta nueva, y no
-- es un atajo: `gift_cards.order_id` es UNIQUE (0001:81). Una tarjeta por
-- pedido es la invariante que hace que el fulfillment del webhook sea
-- idempotente —`emitir_gift_card` busca la tarjeta del pedido y espera
-- encontrar una—, así que emitir una segunda rompería algo que funciona para
-- resolver algo que se resuelve igual de bien cambiando el código.
--
-- Para quien perdió su código el efecto es idéntico: el viejo deja de servir
-- —su hash ya no está en ninguna fila— y recibe uno nuevo por el mismo importe.
--
-- El código en claro NO PASA POR AQUÍ. Llega hasheado, igual que en la emisión
-- (0009). Tampoco se guarda en la auditoría: se registra el last4 anterior y el
-- nuevo, que es lo que permite identificar la tarjeta en una conversación.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.admin_gift_card_anular(
  p_actor_id uuid,
  p_gift_card_id uuid,
  p_reason text,
  p_request_id text default null
)
returns table (estado text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card public.gift_cards%rowtype;
begin
  if not public.es_duena(p_actor_id) then
    raise exception 'no_autorizado';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'motivo_obligatorio';
  end if;

  select c.* into v_card from public.gift_cards c where c.id = p_gift_card_id for update;
  if not found then
    raise exception 'tarjeta_no_encontrada';
  end if;

  /*
    Una tarjeta canjeada no se anula.

    El dinero ya está en el wallet de alguien y el movimiento es inmutable por
    diseño (`docs/00`). Anularla aquí dejaría la tarjeta marcada como cancelada
    y el crédito intacto: dos registros contando historias distintas sobre el
    mismo dinero. Si hay que revertirlo, se hace con un ajuste de saldo, que es
    un movimiento nuevo y con su propio motivo.
  */
  if v_card.status = 'redeemed' then
    raise exception 'ya_canjeada';
  end if;

  if v_card.status = 'cancelled' then
    raise exception 'ya_anulada';
  end if;

  update public.gift_cards set status = 'cancelled' where id = p_gift_card_id;

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id, reason, before_data, after_data, request_id
  ) values (
    p_actor_id, 'gift_card_anulada', 'gift_card', p_gift_card_id::text, btrim(p_reason),
    jsonb_build_object('status', v_card.status, 'last4', v_card.code_last4),
    jsonb_build_object('status', 'cancelled', 'amount_cents', v_card.amount_cents),
    p_request_id
  );

  return query select 'cancelled'::text;
end;
$$;

create or replace function public.admin_gift_card_reactivar(
  p_actor_id uuid,
  p_gift_card_id uuid,
  p_reason text,
  p_request_id text default null
)
returns table (estado text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card public.gift_cards%rowtype;
begin
  if not public.es_duena(p_actor_id) then
    raise exception 'no_autorizado';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'motivo_obligatorio';
  end if;

  select c.* into v_card from public.gift_cards c where c.id = p_gift_card_id for update;
  if not found then
    raise exception 'tarjeta_no_encontrada';
  end if;

  if v_card.status <> 'cancelled' then
    raise exception 'no_estaba_anulada';
  end if;

  update public.gift_cards set status = 'active' where id = p_gift_card_id;

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id, reason, before_data, after_data, request_id
  ) values (
    p_actor_id, 'gift_card_reactivada', 'gift_card', p_gift_card_id::text, btrim(p_reason),
    jsonb_build_object('status', 'cancelled', 'last4', v_card.code_last4),
    jsonb_build_object('status', 'active'),
    p_request_id
  );

  return query select 'active'::text;
end;
$$;

/*
  Rota el código de una tarjeta activa.

  Solo sobre 'active'. Sobre una canjeada no significaría nada —el importe ya
  se gastó— y sobre una anulada daría un código que no sirve; para eso se
  reactiva primero, que es una decisión aparte y queda auditada aparte.
*/
create or replace function public.admin_gift_card_rotar_codigo(
  p_actor_id uuid,
  p_gift_card_id uuid,
  p_code_hash text,
  p_code_last4 text,
  p_reason text,
  p_request_id text default null
)
returns table (last4_anterior text, last4_nuevo text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card public.gift_cards%rowtype;
begin
  if not public.es_duena(p_actor_id) then
    raise exception 'no_autorizado';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'motivo_obligatorio';
  end if;

  -- Forma del hash, no su valor: impide que por un fallo de la aplicación
  -- acabe aquí el código en claro, que es exactamente lo que `docs/04` prohíbe
  -- que exista en la base.
  if p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'hash_invalido';
  end if;

  if p_code_last4 is null or p_code_last4 !~ '^[0-9A-Z]{4}$' then
    raise exception 'last4_invalido';
  end if;

  select c.* into v_card from public.gift_cards c where c.id = p_gift_card_id for update;
  if not found then
    raise exception 'tarjeta_no_encontrada';
  end if;

  if v_card.status <> 'active' then
    raise exception 'tarjeta_no_activa';
  end if;

  update public.gift_cards
     set code_hash = p_code_hash, code_last4 = p_code_last4
   where id = p_gift_card_id;

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id, reason, before_data, after_data, request_id
  ) values (
    p_actor_id, 'gift_card_codigo_rotado', 'gift_card', p_gift_card_id::text, btrim(p_reason),
    -- Los hashes no se registran. No son secretos —con el hash no se canjea
    -- nada, el canje parte del código en claro— pero tampoco aportan nada que
    -- se pueda leer, y una auditoría se lee.
    jsonb_build_object('last4', v_card.code_last4),
    jsonb_build_object('last4', p_code_last4),
    p_request_id
  );

  return query select v_card.code_last4, p_code_last4;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- EVENTOS
--
-- Despublicar en vez de borrar cuando hay reservas: `event_bookings.event_id`
-- tiene `on delete cascade` (0005:92), así que borrar un evento borra en
-- silencio las reservas de la gente. Alguien que apartó su plaza vería
-- desaparecer su reserva sin que nadie se lo diga.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.admin_evento_crear(
  p_actor_id uuid,
  p_slug text,
  p_titulo text,
  p_descripcion text,
  p_inicia_at timestamptz,
  p_termina_at timestamptz,
  p_lugar text,
  p_aforo integer,
  p_publicado boolean,
  p_reason text,
  p_request_id text default null
)
returns table (evento_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.es_duena(p_actor_id) then
    raise exception 'no_autorizado';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'motivo_obligatorio';
  end if;

  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'slug_invalido';
  end if;

  if p_titulo is null or btrim(p_titulo) = '' then
    raise exception 'titulo_obligatorio';
  end if;

  if p_inicia_at is null then
    raise exception 'fecha_obligatoria';
  end if;

  if p_termina_at is not null and p_termina_at <= p_inicia_at then
    raise exception 'fin_antes_del_inicio';
  end if;

  if p_aforo is not null and p_aforo <= 0 then
    raise exception 'aforo_invalido';
  end if;

  if exists (select 1 from public.events where slug = p_slug) then
    raise exception 'slug_duplicado';
  end if;

  insert into public.events (
    slug, title, description, starts_at, ends_at, location, capacity, published
  ) values (
    p_slug, btrim(p_titulo), nullif(btrim(coalesce(p_descripcion, '')), ''),
    p_inicia_at, p_termina_at,
    coalesce(nullif(btrim(coalesce(p_lugar, '')), ''), 'SIEMBRA Condado'),
    p_aforo, coalesce(p_publicado, false)
  )
  returning id into v_id;

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id, reason, before_data, after_data, request_id
  ) values (
    p_actor_id, 'evento_creado', 'event', v_id::text, btrim(p_reason), null,
    jsonb_build_object('slug', p_slug, 'title', btrim(p_titulo),
                       'starts_at', p_inicia_at, 'published', coalesce(p_publicado, false)),
    p_request_id
  );

  return query select v_id;
end;
$$;

/*
  Editar.

  El SLUG NO SE REGENERA al cambiar el título, por la misma razón que en el
  catálogo (0015): el slug es la identidad y el título es la etiqueta. Aquí
  además es la URL por la que se comparte un evento en Instagram.
*/
create or replace function public.admin_evento_editar(
  p_actor_id uuid,
  p_evento_id uuid,
  p_titulo text,
  p_descripcion text,
  p_inicia_at timestamptz,
  p_termina_at timestamptz,
  p_lugar text,
  p_aforo integer,
  p_reason text,
  p_request_id text default null
)
returns table (evento_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes public.events%rowtype;
  v_reservas integer;
begin
  if not public.es_duena(p_actor_id) then
    raise exception 'no_autorizado';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'motivo_obligatorio';
  end if;

  select e.* into v_antes from public.events e where e.id = p_evento_id for update;
  if not found then
    raise exception 'evento_no_encontrado';
  end if;

  if p_titulo is null or btrim(p_titulo) = '' then
    raise exception 'titulo_obligatorio';
  end if;

  if p_termina_at is not null and p_termina_at <= p_inicia_at then
    raise exception 'fin_antes_del_inicio';
  end if;

  if p_aforo is not null and p_aforo <= 0 then
    raise exception 'aforo_invalido';
  end if;

  -- Bajar el aforo por debajo de las reservas ya confirmadas dejaría plazas
  -- vendidas dos veces. Se rechaza en vez de decidir a quién se echa.
  if p_aforo is not null then
    select count(*)::integer into v_reservas
      from public.event_bookings b
     where b.event_id = p_evento_id and b.status in ('confirmada', 'asistio');

    if p_aforo < v_reservas then
      raise exception 'aforo_menor_que_reservas: %', v_reservas;
    end if;
  end if;

  update public.events
     set title = btrim(p_titulo),
         description = nullif(btrim(coalesce(p_descripcion, '')), ''),
         starts_at = p_inicia_at,
         ends_at = p_termina_at,
         location = coalesce(nullif(btrim(coalesce(p_lugar, '')), ''), 'SIEMBRA Condado'),
         capacity = p_aforo
   where id = p_evento_id;

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id, reason, before_data, after_data, request_id
  ) values (
    p_actor_id, 'evento_editado', 'event', p_evento_id::text, btrim(p_reason),
    jsonb_build_object('title', v_antes.title, 'starts_at', v_antes.starts_at,
                       'ends_at', v_antes.ends_at, 'location', v_antes.location,
                       'capacity', v_antes.capacity, 'description', v_antes.description),
    jsonb_build_object('title', btrim(p_titulo), 'starts_at', p_inicia_at,
                       'ends_at', p_termina_at, 'location', p_lugar,
                       'capacity', p_aforo, 'description', p_descripcion),
    p_request_id
  );

  return query select p_evento_id;
end;
$$;

create or replace function public.admin_evento_publicar(
  p_actor_id uuid,
  p_evento_id uuid,
  p_publicado boolean,
  p_reason text,
  p_request_id text default null
)
returns table (publicado boolean, reservas integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes boolean;
  v_reservas integer;
begin
  if not public.es_duena(p_actor_id) then
    raise exception 'no_autorizado';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'motivo_obligatorio';
  end if;

  select e.published into v_antes from public.events e where e.id = p_evento_id for update;
  if not found then
    raise exception 'evento_no_encontrado';
  end if;

  update public.events set published = coalesce(p_publicado, false) where id = p_evento_id;

  select count(*)::integer into v_reservas
    from public.event_bookings b
   where b.event_id = p_evento_id and b.status = 'confirmada';

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id, reason, before_data, after_data, request_id
  ) values (
    p_actor_id,
    case when coalesce(p_publicado, false) then 'evento_publicado' else 'evento_despublicado' end,
    'event', p_evento_id::text, btrim(p_reason),
    jsonb_build_object('published', v_antes),
    jsonb_build_object('published', coalesce(p_publicado, false), 'reservas', v_reservas),
    p_request_id
  );

  return query select coalesce(p_publicado, false), v_reservas;
end;
$$;

/*
  Borrar. Solo si NADIE ha reservado.

  Con reservas se rechaza y se dice cuántas hay, para que la salida sea
  despublicar: el evento desaparece de la web y las reservas siguen existiendo.
*/
create or replace function public.admin_evento_borrar(
  p_actor_id uuid,
  p_evento_id uuid,
  p_reason text,
  p_request_id text default null
)
returns table (borrado boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes public.events%rowtype;
  v_reservas integer;
begin
  if not public.es_duena(p_actor_id) then
    raise exception 'no_autorizado';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'motivo_obligatorio';
  end if;

  select e.* into v_antes from public.events e where e.id = p_evento_id for update;
  if not found then
    raise exception 'evento_no_encontrado';
  end if;

  select count(*)::integer into v_reservas
    from public.event_bookings b where b.event_id = p_evento_id;

  if v_reservas > 0 then
    raise exception 'evento_con_reservas: %', v_reservas;
  end if;

  delete from public.events where id = p_evento_id;

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id, reason, before_data, after_data, request_id
  ) values (
    p_actor_id, 'evento_borrado', 'event', p_evento_id::text, btrim(p_reason),
    jsonb_build_object('slug', v_antes.slug, 'title', v_antes.title,
                       'starts_at', v_antes.starts_at),
    null, p_request_id
  );

  return query select true;
end;
$$;

/*
  Marcar asistencia.

  Los estados 'asistio' y 'ausente' están en el CHECK de `event_bookings` desde
  0005 y no los escribía nadie: la política RLS deja al cliente poner solo
  'confirmada' y 'cancelada', a propósito, porque quien dice si alguien vino es
  el personal.

  Lo puede hacer el MOSTRADOR. Es la tarea de la puerta, con la lista delante,
  y exigir a alguien del equipo que llame a la dueña para marcar una casilla
  garantiza que la lista no se marque.

  Sin motivo libre por lo mismo que en el catálogo: pedir seis caracteres por
  cada persona que entra por la puerta, veinte veces en una tarde, garantiza un
  «xxxxxx». La acción y el estado ya cuentan la historia entera.
*/
create or replace function public.admin_evento_asistencia(
  p_actor_id uuid,
  p_reserva_id uuid,
  p_estado text,
  p_request_id text default null
)
returns table (estado text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes text;
  v_evento uuid;
begin
  if public.admin_rol(p_actor_id) is null then
    raise exception 'no_autorizado';
  end if;

  if p_estado not in ('confirmada', 'asistio', 'ausente') then
    raise exception 'estado_invalido: %', p_estado;
  end if;

  select b.status, b.event_id into v_antes, v_evento
    from public.event_bookings b where b.id = p_reserva_id for update;

  if not found then
    raise exception 'reserva_no_encontrada';
  end if;

  -- Una reserva que la persona canceló no se marca como asistida: si vino de
  -- todos modos, se le vuelve a confirmar la plaza primero.
  if v_antes = 'cancelada' then
    raise exception 'reserva_cancelada';
  end if;

  update public.event_bookings set status = p_estado where id = p_reserva_id;

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id, reason, before_data, after_data, request_id
  ) values (
    p_actor_id, 'asistencia_marcada', 'event_booking', p_reserva_id::text,
    'Lista de asistencia del evento',
    jsonb_build_object('status', v_antes),
    jsonb_build_object('status', p_estado, 'event_id', v_evento),
    p_request_id
  );

  return query select p_estado;
end;
$$;

/*
  Listado de eventos con su aforo ocupado.

  Los conteos se calculan EN SQL. Traer las reservas a la aplicación para
  contarlas es el mismo error que producía el crédito falso (0013): el cliente
  de Supabase corta a 1.000 filas y un evento popular empezaría a mentir.
*/
create or replace function public.admin_eventos_listar()
returns table (
  id uuid,
  slug text,
  titulo text,
  descripcion text,
  inicia_at timestamptz,
  termina_at timestamptz,
  lugar text,
  aforo integer,
  publicado boolean,
  confirmadas bigint,
  asistieron bigint,
  ausentes bigint,
  canceladas bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select e.id, e.slug, e.title, e.description, e.starts_at, e.ends_at,
         e.location, e.capacity, e.published,
         count(*) filter (where b.status = 'confirmada'),
         count(*) filter (where b.status = 'asistio'),
         count(*) filter (where b.status = 'ausente'),
         count(*) filter (where b.status = 'cancelada')
    from public.events e
    left join public.event_bookings b on b.event_id = e.id
   group by e.id
   order by e.starts_at desc;
$$;

/* Lista de asistencia de un evento, con la persona ya resuelta. */
create or replace function public.admin_evento_reservas(p_evento_id uuid)
returns table (
  reserva_id uuid,
  user_id uuid,
  nombre text,
  email text,
  member_id text,
  estado text,
  reservado_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select b.id, b.user_id,
         coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), '—'),
         p.email, p.member_id, b.status, b.created_at
    from public.event_bookings b
    left join public.profiles p on p.id = b.user_id
   where b.event_id = p_evento_id
   -- Por nombre y no por fecha de reserva: en la puerta se busca a una persona
   -- en una lista, no se repasa el orden en que apartaron plaza.
   order by 3, b.created_at;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- NEWSLETTER
--
-- `newsletter_subscribers` tiene política de INSERT público y ninguna de
-- SELECT (0007): se llevan recogiendo correos que nadie puede mirar sin entrar
-- al panel de Supabase. Esto es la lectura que faltaba.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.admin_newsletter_listar(
  p_consulta text default '',
  p_limite integer default 50,
  p_offset integer default 0
)
returns table (
  email text,
  origen text,
  confirmado_at timestamptz,
  baja_at timestamptz,
  alta_at timestamptz,
  total bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select n.email, n.source, n.confirmed_at, n.unsubscribed_at, n.created_at,
         count(*) over ()
    from public.newsletter_subscribers n
   where coalesce(btrim(p_consulta), '') = ''
      or n.email ilike '%' || btrim(p_consulta) || '%'
   -- El correo desempata: `created_at` solo puede repetirse y sin segundo
   -- criterio la paginación repite una fila y se salta otra (mismo fallo que
   -- se corrigió en la auditoría).
   order by n.created_at desc, n.email
   limit greatest(1, least(coalesce(p_limite, 50), 500))
  offset greatest(0, coalesce(p_offset, 0));
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- ADMINISTRADORAS
--
-- Hoy solo se nombra editando `ADMIN_EMAIL_ALLOWLIST` y redesplegando, aunque
-- `admin_users` tiene `granted_by` y `note` desde 0008 justamente para esto.
--
-- El trigger anti-cerrojo de 0012 (`admin_users_una_duena`) sigue siendo la
-- última palabra: es `deferrable initially deferred`, así que salta al cerrar
-- la transacción aunque la comprobación de aquí se olvidara.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.admin_conceder(
  p_actor_id uuid,
  p_target_id uuid,
  p_rol text,
  p_nota text,
  p_request_id text default null
)
-- `rol_asignado` y no `rol`: los nombres de `returns table` están en ámbito
-- dentro del cuerpo, y aquí `rol` es además una columna de `admin_users` que
-- aparece en el INSERT y en el ON CONFLICT.
returns table (rol_asignado text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes text;
begin
  if not public.es_duena(p_actor_id) then
    raise exception 'no_autorizado';
  end if;

  if p_rol not in ('duena', 'empleado') then
    raise exception 'rol_invalido: %', p_rol;
  end if;

  if not exists (select 1 from auth.users u where u.id = p_target_id) then
    raise exception 'usuario_no_encontrado';
  end if;

  select a.rol into v_antes from public.admin_users a where a.user_id = p_target_id;

  insert into public.admin_users (user_id, rol, granted_by, note)
  values (p_target_id, p_rol, p_actor_id, nullif(btrim(coalesce(p_nota, '')), ''))
  on conflict (user_id) do update
    set rol = excluded.rol,
        granted_by = excluded.granted_by,
        -- Sin esquema delante: dentro de `on conflict do update` la fila que ya
        -- existía se referencia por el nombre de la tabla, y `public.` ahí es un
        -- error de «missing FROM-clause entry».
        note = coalesce(excluded.note, admin_users.note);

  insert into public.audit_logs (
    actor_user_id, target_user_id, action, entity_type, entity_id,
    reason, before_data, after_data, request_id
  ) values (
    p_actor_id, p_target_id,
    case when v_antes is null then 'admin_concedido' else 'admin_rol_cambiado' end,
    'admin_user', p_target_id::text,
    coalesce(nullif(btrim(coalesce(p_nota, '')), ''), 'Alta de administración'),
    case when v_antes is null then null else jsonb_build_object('rol', v_antes) end,
    jsonb_build_object('rol', p_rol),
    p_request_id
  );

  return query select p_rol;
end;
$$;

/*
  Busca a quién nombrar, por correo.

  Devuelve el usuario aunque ya sea administrador, con su rol actual: así la
  pantalla puede decir «ya es empleado, ¿la asciendes?» en vez de fallar con un
  duplicado después de rellenar el formulario.
*/
create or replace function public.admin_buscar_para_conceder(p_email text)
returns table (user_id uuid, nombre text, email text, rol_actual text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id,
         coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), '—'),
         p.email, a.rol
    from public.profiles p
    left join public.admin_users a on a.user_id = p.id
   where lower(p.email) = lower(btrim(coalesce(p_email, '')))
   limit 1;
$$;

create or replace function public.admin_revocar(
  p_actor_id uuid,
  p_target_id uuid,
  p_reason text,
  p_request_id text default null
)
returns table (revocado boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes text;
begin
  if not public.es_duena(p_actor_id) then
    raise exception 'no_autorizado';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'motivo_obligatorio';
  end if;

  -- Quitarse a una misma es la forma más fácil de quedarse fuera del panel sin
  -- querer, y el trigger anti-cerrojo no lo impide si queda otra dueña.
  if p_actor_id = p_target_id then
    raise exception 'no_puedes_revocarte';
  end if;

  select a.rol into v_antes from public.admin_users a where a.user_id = p_target_id;
  if v_antes is null then
    raise exception 'no_era_admin';
  end if;

  delete from public.admin_users where user_id = p_target_id;

  insert into public.audit_logs (
    actor_user_id, target_user_id, action, entity_type, entity_id,
    reason, before_data, after_data, request_id
  ) values (
    p_actor_id, p_target_id, 'admin_revocado', 'admin_user', p_target_id::text,
    btrim(p_reason), jsonb_build_object('rol', v_antes), null, p_request_id
  );

  return query select true;
end;
$$;

/* Quién administra, con nombre y quién le dio el acceso. */
create or replace function public.admin_listar_admins()
returns table (
  user_id uuid,
  nombre text,
  email text,
  rol text,
  nota text,
  concedido_por text,
  alta_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.user_id,
         coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), '—'),
         p.email, a.rol, a.note,
         coalesce(nullif(btrim(concat_ws(' ', g.first_name, g.last_name)), ''), g.email),
         a.created_at
    from public.admin_users a
    left join public.profiles p on p.id = a.user_id
    left join public.profiles g on g.id = a.granted_by
   -- Las dueñas primero, y dentro de cada rol por antigüedad.
   order by case a.rol when 'duena' then 0 else 1 end, a.created_at;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Permisos: solo el servidor.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.admin_gift_card_anular(uuid,uuid,text,text)',
    'public.admin_gift_card_reactivar(uuid,uuid,text,text)',
    'public.admin_gift_card_rotar_codigo(uuid,uuid,text,text,text,text)',
    'public.admin_evento_crear(uuid,text,text,text,timestamptz,timestamptz,text,integer,boolean,text,text)',
    'public.admin_evento_editar(uuid,uuid,text,text,timestamptz,timestamptz,text,integer,text,text)',
    'public.admin_evento_publicar(uuid,uuid,boolean,text,text)',
    'public.admin_evento_borrar(uuid,uuid,text,text)',
    'public.admin_evento_asistencia(uuid,uuid,text,text)',
    'public.admin_eventos_listar()',
    'public.admin_evento_reservas(uuid)',
    'public.admin_newsletter_listar(text,integer,integer)',
    'public.admin_conceder(uuid,uuid,text,text,text)',
    'public.admin_revocar(uuid,uuid,text,text)',
    'public.admin_listar_admins()',
    'public.admin_buscar_para_conceder(text)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

/*
  Freno para las operaciones del panel.

  Aparte del de catálogo: marcar la asistencia de un evento lleno son cincuenta
  llamadas legítimas en veinte minutos, y compartir cupo con la edición de
  precios haría que la lista de la puerta se bloqueara a mitad.
*/
insert into public.rate_limit_reglas (accion, max_intentos, ventana_segundos, descripcion) values
  ('admin_operaciones', 150, 900, 'Operaciones del panel: gift cards, eventos y equipo, 15 min')
on conflict (accion) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0018 — La lealtad deja de ser decoración, y el sistema deja de callarse.
--
-- Dos cierres.
--
-- 1. `loyalty_rules` (0005:37-53) se sembró con siete reglas del Brand Book y
--    NINGÚN archivo de `src/` la lee. Es configuración muerta: siete filas que
--    describen cómo se ganan puntos y que no dan ni un punto a nadie.
--
--    Y `loyalty_tiers` se documentó como «editable sin desplegar» pero solo se
--    puede cambiar escribiendo SQL a mano, que es exactamente lo contrario.
--
-- 2. Tres tablas se llenan solas y no se miran nunca: `stripe_webhook_events`,
--    `gift_card_redeem_attempts` y `rate_limit_hits`. Si Stripe deja de
--    entregar webhooks, si media docena de clientes están tecleando mal su
--    código, o si alguien lleva una hora bloqueado en el login, hoy no se
--    entera nadie.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- LEALTAD
--
-- Lo primero es decir la verdad sobre cada regla. De las siete, HOY solo una se
-- puede automatizar:
--
--   · por_dolar, bebida, tienda → necesitan el punto de venta, que no está
--     conectado. La tabla `orders` existe y nadie la escribe.
--   · cumpleanos → `profiles` no guarda fecha de nacimiento.
--   · referido → no hay sistema de referidos.
--   · vaso_reusable → es una decisión de quien está en la barra. No es que
--     falte código: es que no hay nada que automatizar.
--   · bienvenida → esta sí. El trigger de alta ya existe.
--
-- Sin esta columna, el panel enseñaría siete reglas con la misma pinta y la
-- dueña creería que el sistema da puntos por siete conceptos cuando no da por
-- ninguno. Un panel que miente sobre lo que hace es peor que uno vacío.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.loyalty_rules
  add column if not exists aplicacion text not null default 'manual'
    check (aplicacion in ('automatica', 'manual', 'bloqueada'));

alter table public.loyalty_rules
  add column if not exists nota text;

/*
  Tope de puntos por regla.

  `loyalty_rules.points` es bigint y no tenía ningún límite. El bono de
  bienvenida de más abajo lo lee de esta tabla y se lo da a cada cuenta nueva:
  un dedo torpe escribiendo 100000000 no daba ningún error, daba cien millones
  de puntos a todo el que se registrara a partir de ese momento. Y los
  movimientos de lealtad son inmutables, así que deshacerlo son mil
  correcciones, no un `update`.

  El límite vive en la tabla y no solo en la función de edición porque la tabla
  también se puede tocar por SQL, y este es el único sitio que lo cubre todo.
*/
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'loyalty_rules_points_razonable'
  ) then
    alter table public.loyalty_rules
      add constraint loyalty_rules_points_razonable
      check (points > 0 and points <= 100000);
  end if;
end $$;

update public.loyalty_rules set aplicacion = 'bloqueada',
  nota = 'Necesita el punto de venta conectado. Hoy la web no ve lo que se cobra en el mostrador.'
 where key in ('por_dolar', 'bebida', 'tienda');

update public.loyalty_rules set aplicacion = 'bloqueada',
  nota = 'Necesita guardar la fecha de nacimiento, que hoy no se pide en el registro.'
 where key = 'cumpleanos';

update public.loyalty_rules set aplicacion = 'bloqueada',
  nota = 'Necesita un sistema de referidos, que todavía no existe.'
 where key = 'referido';

update public.loyalty_rules set aplicacion = 'manual',
  nota = 'La da quien atiende, desde la ficha de la persona.'
 where key = 'vaso_reusable';

update public.loyalty_rules set aplicacion = 'automatica',
  nota = 'Se otorga sola al crear la cuenta.'
 where key = 'bienvenida';

/*
  El bono de bienvenida, de verdad.

  EN SU PROPIO TRIGGER, sin tocar `handle_new_user`. El primer intento sí la
  reescribía —parecía lo natural, es la función del alta— y se llevó por delante
  lo que le habían añadido `0002` (el consentimiento de marketing) y `0014` (la
  copia del correo a `profiles`): un `create or replace` sustituye el cuerpo
  entero, y el cuerpo del que partí era el de `0001`. El resultado habría sido
  que ningún socio nuevo tuviera correo buscable ni preferencia de marketing, en
  silencio y a partir del día del despliegue.

  Lo cazaron catorce tests de otros archivos. Con un trigger aparte el problema
  no puede repetirse en ninguna dirección: ni yo piso a nadie, ni la próxima
  migración que amplíe el alta se lleva el bono por delante.

  El orden está garantizado: Postgres dispara los triggers `after insert` en
  orden alfabético de nombre, y `on_auth_user_created` va antes que
  `on_auth_user_welcome_bonus`, así que la cuenta de puntos ya existe.

  Se lee de la tabla —puntos y `active`— para que cambiarlo desde el panel tenga
  efecto sin desplegar, que es lo que la migración 0005 prometía.
*/
create or replace function public.aplicar_bono_bienvenida()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_puntos bigint;
  v_label text;
begin
  /*
    ENVUELTO EN UN BLOQUE QUE NO PUEDE TUMBAR EL ALTA.

    Esto corre dentro de la transacción que crea la cuenta: si lanzara —la
    regla borrada, un fallo del ledger—, la persona no podría registrarse en la
    web. Un bono de cien puntos no vale una puerta cerrada, así que se avisa en
    los logs de Postgres y el registro continúa.
  */
  begin
    select r.points, r.label into v_puntos, v_label
      from public.loyalty_rules r
     where r.key = 'bienvenida' and r.active;

    if v_puntos is not null and v_puntos > 0 then
      -- La clave de idempotencia es el usuario: aunque el trigger corriera dos
      -- veces, el ledger no duplica el bono.
      perform public.apply_loyalty_transaction(
        new.id,
        v_puntos,
        'promotion',
        'bienvenida:' || new.id::text,
        'bienvenida',
        v_label
      );
    end if;
  exception when others then
    raise warning 'bono de bienvenida no aplicado a %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_welcome_bonus on auth.users;
create trigger on_auth_user_welcome_bonus
after insert on auth.users
for each row execute function public.aplicar_bono_bienvenida();

/* Lectura de la configuración para el panel. */
create or replace function public.admin_lealtad_reglas()
returns table (
  clave text,
  puntos bigint,
  etiqueta text,
  activa boolean,
  aplicacion text,
  nota text,
  -- Cuántas veces se ha aplicado de verdad. Una regla activa con cero usos
  -- lleva meses sin dar un punto a nadie, y eso es lo que hay que ver.
  veces_aplicada bigint,
  puntos_dados bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.key, r.points, r.label, r.active, r.aplicacion, r.nota,
         coalesce(u.veces, 0), coalesce(u.puntos, 0)
    from public.loyalty_rules r
    left join (
      select t.source_id as clave, count(*)::bigint as veces, sum(t.points)::bigint as puntos
        from public.loyalty_transactions t
       where t.source_id is not null
       group by t.source_id
    ) u on u.clave = r.key
   order by r.points desc, r.key;
$$;

create or replace function public.admin_lealtad_niveles()
returns table (
  clave text,
  etiqueta text,
  minimo bigint,
  orden integer,
  descripcion text,
  miembros bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.key, t.label, t.min_points, t.sort_order, t.description,
         (select count(*) from public.loyalty_accounts a
           where public.nivel_para_puntos(a.points_balance) = t.key)
    from public.loyalty_tiers t
   order by t.sort_order;
$$;

/*
  Editar una regla.

  `aplicacion` y `nota` NO se tocan desde aquí: describen lo que el sistema
  puede hacer, no lo que el negocio decide. Cambiar «bloqueada» a «automática»
  desde una pantalla no conectaría el punto de venta; solo haría que el panel
  mintiera. Se mueven cuando se escriba el código que las mueve.
*/
create or replace function public.admin_lealtad_regla_editar(
  p_actor_id uuid,
  p_clave text,
  p_puntos bigint,
  p_etiqueta text,
  p_activa boolean,
  p_reason text,
  p_request_id text default null
)
returns table (clave text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes public.loyalty_rules%rowtype;
begin
  if not public.es_duena(p_actor_id) then
    raise exception 'no_autorizado';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'motivo_obligatorio';
  end if;

  select r.* into v_antes from public.loyalty_rules r where r.key = p_clave for update;
  if not found then
    raise exception 'regla_no_encontrada';
  end if;

  if p_puntos is null or p_puntos <= 0 or p_puntos > 100000 then
    raise exception 'puntos_invalidos';
  end if;

  if p_etiqueta is null or btrim(p_etiqueta) = '' then
    raise exception 'etiqueta_obligatoria';
  end if;

  update public.loyalty_rules
     set points = p_puntos, label = btrim(p_etiqueta), active = coalesce(p_activa, true)
   where key = p_clave;

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id, reason, before_data, after_data, request_id
  ) values (
    p_actor_id, 'lealtad_regla_editada', 'loyalty_rule', p_clave, btrim(p_reason),
    jsonb_build_object('points', v_antes.points, 'label', v_antes.label, 'active', v_antes.active),
    jsonb_build_object('points', p_puntos, 'label', btrim(p_etiqueta), 'active', coalesce(p_activa, true)),
    p_request_id
  );

  return query select p_clave;
end;
$$;

/*
  Editar un nivel.

  Con la guarda que hace falta: los umbrales tienen que quedar ESTRICTAMENTE
  crecientes por orden, y el primero en cero.

  `nivel_para_puntos` (0006) elige el nivel más alto cuyo mínimo no supere el
  saldo, y `calcularProgreso` (src/lib/loyalty.ts) calcula cuánto falta para el
  siguiente. Si Brote quedara por encima de Raíz, el nivel de todo el mundo se
  recalcularía mal en silencio —no hay columna que discrepe, se deriva—, y en
  /perfil aparecerían barras de progreso hacia atrás.
*/
create or replace function public.admin_lealtad_nivel_editar(
  p_actor_id uuid,
  p_clave text,
  p_etiqueta text,
  p_minimo bigint,
  p_descripcion text,
  p_reason text,
  p_request_id text default null
)
returns table (clave text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes public.loyalty_tiers%rowtype;
  v_roto integer;
begin
  if not public.es_duena(p_actor_id) then
    raise exception 'no_autorizado';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'motivo_obligatorio';
  end if;

  select t.* into v_antes from public.loyalty_tiers t where t.key = p_clave for update;
  if not found then
    raise exception 'nivel_no_encontrado';
  end if;

  if p_minimo is null or p_minimo < 0 then
    raise exception 'minimo_invalido';
  end if;

  if p_etiqueta is null or btrim(p_etiqueta) = '' then
    raise exception 'etiqueta_obligatoria';
  end if;

  update public.loyalty_tiers
     set label = btrim(p_etiqueta),
         min_points = p_minimo,
         description = nullif(btrim(coalesce(p_descripcion, '')), '')
   where key = p_clave;

  -- Se comprueba DESPUÉS de aplicar y dentro de la misma transacción: así la
  -- comprobación mira el estado final de la tabla entera, no el que se
  -- imagina, y si no cuadra el `raise` lo revierte todo.
  select count(*)::integer into v_roto
    from (
      select t.min_points,
             lag(t.min_points) over (order by t.sort_order) as anterior
        from public.loyalty_tiers t
    ) s
   where s.anterior is not null and s.min_points <= s.anterior;

  if v_roto > 0 then
    raise exception 'umbrales_desordenados';
  end if;

  if (select min_points from public.loyalty_tiers order by sort_order limit 1) <> 0 then
    raise exception 'primer_nivel_no_empieza_en_cero';
  end if;

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id, reason, before_data, after_data, request_id
  ) values (
    p_actor_id, 'lealtad_nivel_editado', 'loyalty_tier', p_clave, btrim(p_reason),
    jsonb_build_object('label', v_antes.label, 'min_points', v_antes.min_points,
                       'description', v_antes.description),
    jsonb_build_object('label', btrim(p_etiqueta), 'min_points', p_minimo,
                       'description', p_descripcion),
    p_request_id
  );

  return query select p_clave;
end;
$$;

/*
  Aplicar una regla manual a una persona.

  Esto es lo que convierte las reglas en algo que existe. «Vaso reusable, 5
  puntos» deja de ser una fila en una tabla y pasa a ser un botón en la ficha
  de quien acaba de traer su vaso.

  Lo puede hacer el MOSTRADOR, y por eso no admite ni importe ni motivo libres:
  los puntos salen de la tabla y el concepto es la etiqueta de la regla. Un
  empleado no puede regalar mil puntos porque no hay ningún campo donde
  escribir mil. Ajustar una cantidad arbitraria sigue siendo `admin_ajustar_puntos`,
  que es solo de la dueña.

  Sin idempotencia por persona: la misma persona puede traer su vaso mañana. La
  clave lleva el instante, así que dos pulsaciones del mismo botón dan dos
  veces —igual que dos cafés dan dos veces— y el rastro queda en la auditoría.
*/
create or replace function public.admin_aplicar_regla_lealtad(
  p_actor_id uuid,
  p_target_id uuid,
  p_clave text,
  p_request_id text default null
)
returns table (puntos bigint, nuevo_saldo bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_regla public.loyalty_rules%rowtype;
  v_saldo bigint;
begin
  if public.admin_rol(p_actor_id) is null then
    raise exception 'no_autorizado';
  end if;

  select r.* into v_regla from public.loyalty_rules r where r.key = p_clave;
  if not found then
    raise exception 'regla_no_encontrada';
  end if;

  if not v_regla.active then
    raise exception 'regla_inactiva';
  end if;

  -- Solo las manuales. Las automáticas las da el sistema —darlas otra vez a
  -- mano las duplicaría— y las bloqueadas no se pueden dar porque el dato que
  -- las dispara no existe todavía.
  if v_regla.aplicacion <> 'manual' then
    raise exception 'regla_no_manual: %', v_regla.aplicacion;
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_target_id) then
    raise exception 'usuario_no_encontrado';
  end if;

  select t.new_points_balance into v_saldo
    from public.apply_loyalty_transaction(
      p_target_id,
      v_regla.points,
      'earn',
      'regla:' || p_clave || ':' || p_target_id::text || ':' || extract(epoch from clock_timestamp())::text,
      p_clave,
      v_regla.label
    ) t;

  insert into public.audit_logs (
    actor_user_id, target_user_id, action, entity_type, entity_id,
    reason, before_data, after_data, request_id
  ) values (
    p_actor_id, p_target_id, 'lealtad_regla_aplicada', 'loyalty_account', p_target_id::text,
    v_regla.label,
    jsonb_build_object('points_balance', v_saldo - v_regla.points),
    jsonb_build_object('points_balance', v_saldo, 'points', v_regla.points, 'regla', p_clave),
    p_request_id
  );

  return query select v_regla.points, v_saldo;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- SALUD TÉCNICA
--
-- Tres tablas que se llenan solas y no las mira nadie. Lo que se pregunta aquí
-- no es «cuántas filas hay» sino «¿hay algo roto ahora mismo?»:
--
--   · ¿Stripe está entregando los webhooks? Un webhook fallido es una gift
--     card pagada y no emitida: dinero cobrado sin producto.
--   · ¿Hay gente tecleando mal su código de gift card? Muchos fallos seguidos
--     de la misma persona es alguien atascado, no un ataque.
--   · ¿Hay alguien bloqueado en el login ahora mismo? Es el motivo número uno
--     de «no puedo entrar» y hoy no había forma de saberlo.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.metricas_salud()
returns table (
  webhooks_total bigint,
  webhooks_fallidos bigint,
  webhooks_procesando bigint,
  webhooks_fallidos_7d bigint,
  webhook_ultimo timestamptz,
  webhook_latencia_media_ms bigint,
  canjes_intentos bigint,
  canjes_fallidos bigint,
  canjes_fallidos_7d bigint,
  canjes_personas_atascadas bigint,
  bloqueos_activos bigint,
  bloqueos_login_activos bigint,
  auditoria_entradas bigint,
  auditoria_ultima timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.stripe_webhook_events),
    (select count(*) from public.stripe_webhook_events where status = 'failed'),
    -- 'processing' que lleva ahí más de cinco minutos es un evento que se
    -- quedó a medias: nadie lo cerró.
    (select count(*) from public.stripe_webhook_events
      where status = 'processing' and created_at < now() - interval '5 minutes'),
    (select count(*) from public.stripe_webhook_events
      where status = 'failed' and created_at >= now() - interval '7 days'),
    (select max(created_at) from public.stripe_webhook_events),
    (select coalesce(
       avg(extract(epoch from (processed_at - created_at)) * 1000), 0)::bigint
       from public.stripe_webhook_events
      where processed_at is not null and created_at >= now() - interval '30 days'),

    (select count(*) from public.gift_card_redeem_attempts),
    (select count(*) from public.gift_card_redeem_attempts where not exito),
    (select count(*) from public.gift_card_redeem_attempts
      where not exito and created_at >= now() - interval '7 days'),
    -- Tres fallos o más en una semana sin ninguno bueno: alguien con un código
    -- en la mano que no consigue canjear.
    (select count(*) from (
       select a.user_id
         from public.gift_card_redeem_attempts a
        where a.user_id is not null and a.created_at >= now() - interval '7 days'
        group by a.user_id
       having count(*) filter (where not a.exito) >= 3
          and count(*) filter (where a.exito) = 0
     ) s),

    -- Bloqueados AHORA: la ventana vigente de su regla y el cupo ya superado.
    (select count(*) from public.rate_limit_hits h
       join public.rate_limit_reglas r on r.accion = h.accion
      where h.conteo > r.max_intentos
        and h.ventana_inicio + make_interval(secs => r.ventana_segundos) > now()),
    (select count(*) from public.rate_limit_hits h
       join public.rate_limit_reglas r on r.accion = h.accion
      where h.accion = 'login' and h.conteo > r.max_intentos
        and h.ventana_inicio + make_interval(secs => r.ventana_segundos) > now()),

    (select count(*) from public.audit_logs),
    (select max(created_at) from public.audit_logs);
$$;

/* Últimos webhooks, para mirar de cerca cuando el número de arriba no es cero. */
create or replace function public.admin_webhooks_recientes(p_limite integer default 20)
returns table (
  evento_id text,
  tipo text,
  estado text,
  creado_at timestamptz,
  procesado_at timestamptz,
  error text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select w.stripe_event_id, w.event_type, w.status, w.created_at, w.processed_at, w.error_message
    from public.stripe_webhook_events w
   -- Lo roto primero: si hay un fallo entre cien entregas buenas, es lo único
   -- que hay que mirar.
   order by (w.status = 'failed') desc, w.created_at desc
   limit greatest(1, least(coalesce(p_limite, 20), 100));
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Permisos: solo el servidor.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.admin_lealtad_reglas()',
    'public.admin_lealtad_niveles()',
    'public.admin_lealtad_regla_editar(uuid,text,bigint,text,boolean,text,text)',
    'public.admin_lealtad_nivel_editar(uuid,text,text,bigint,text,text,text)',
    'public.admin_aplicar_regla_lealtad(uuid,uuid,text,text)',
    'public.metricas_salud()',
    'public.admin_webhooks_recientes(integer)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

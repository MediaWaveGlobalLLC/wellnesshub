-- ─────────────────────────────────────────────────────────────────────────────
-- 0020 — Los puntos por fin se pueden gastar.
--
-- `loyalty_transactions` admite el tipo 'redeem' desde `0001` y en cuatro fases
-- nadie lo escribió nunca: los puntos entraban y no salían. Un programa de
-- lealtad donde la recompensa no existe es una columna que sube.
--
-- Aquí van las dos piezas que faltaban: el catálogo que la dueña gestiona, y el
-- canje, que tiene que ser atómico o no ser.
--
-- Los puntos NO son dinero. `docs/00` y DEC-005 lo fijan: no hay conversión a
-- crédito, ni aquí ni en ninguna parte. Un canje entrega un producto y descuenta
-- puntos; el wallet no se entera.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- El catálogo
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.loyalty_rewards (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  costo_puntos bigint not null check (costo_puntos > 0),
  /*
    Clave de `src/lib/brand-assets.generated.ts`, no una URL.

    `docs/01` prohíbe imágenes inventadas, de banco o remotas. Guardando la
    clave, una recompensa solo puede apuntar a una foto que ya está aprobada y
    versionada en el repo; una URL libre sería la puerta por la que entrarían
    las otras. Sin foto se pinta una tarjeta tipográfica, que también es
    válida — mejor eso que rellenar con algo que no es de la marca.
  */
  imagen_clave text,
  activa boolean not null default true,
  /*
    `null` es «sin límite», que es lo normal en un café: una bebida gratis no se
    agota. El número sirve para lo contable —diez tote bags y no hay más—, y a
    cero la recompensa deja de poder canjearse aunque siga activa.
  */
  existencias integer check (existencias is null or existencias >= 0),
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists loyalty_rewards_visibles_idx
  on public.loyalty_rewards(orden, costo_puntos) where activa;

-- ─────────────────────────────────────────────────────────────────────────────
-- Los canjes
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.loyalty_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  /*
    `on delete restrict`: una recompensa con canjes detrás no se borra. El
    historial de alguien no puede evaporarse porque la dueña limpie el catálogo;
    para retirarla está `activa = false`.
  */
  reward_id uuid not null references public.loyalty_rewards(id) on delete restrict,
  /*
    Nombre y coste CONGELADOS en el momento del canje.

    Si mañana la bebida gratis sube de 500 a 700 puntos, el canje de ayer siguió
    costando 500 — y así lo tiene que contar el historial. Leerlos por join
    contra el catálogo reescribiría el pasado cada vez que se edita un precio.
  */
  nombre text not null,
  costo_puntos bigint not null check (costo_puntos > 0),
  -- Lo que la persona enseña en el mostrador.
  codigo text not null unique,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'entregada', 'cancelada')),
  created_at timestamptz not null default now(),
  entregada_at timestamptz,
  entregada_por uuid references auth.users(id) on delete set null
);

create index if not exists loyalty_redemptions_usuario_idx
  on public.loyalty_redemptions(user_id, created_at desc);
-- La cola del mostrador: lo que está por entregar, lo más viejo primero.
create index if not exists loyalty_redemptions_pendientes_idx
  on public.loyalty_redemptions(created_at) where estado = 'pendiente';

-- ─────────────────────────────────────────────────────────────────────────────
-- Código de canje
-- ─────────────────────────────────────────────────────────────────────────────
/*
  Corto y legible en voz alta: se dicta en una barra con ruido.

  No es un secreto y no hace falta que lo sea —no vale nada sin la fila que lo
  respalda, y entregarlo exige que alguien del equipo lo marque—, así que se
  guarda en claro. Es lo contrario del código de una gift card, que sí es un
  instrumento al portador y por eso vive hasheado (`docs/04`).

  Alfabeto sin I, O, 1 ni 0: leídos en alto se confunden.
*/
create or replace function public.generar_codigo_canje()
returns text
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_codigo text;
  v_intento int := 0;
begin
  loop
    v_codigo := 'RC-';
    for _ in 1..6 loop
      v_codigo := v_codigo || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::int, 1);
    end loop;

    exit when not exists (
      select 1 from public.loyalty_redemptions where codigo = v_codigo
    );

    -- 32^6 son mil millones de combinaciones: chocar seis veces seguidas no
    -- pasa. Si pasara, es mejor fallar que girar para siempre.
    v_intento := v_intento + 1;
    if v_intento >= 6 then
      raise exception 'no_se_pudo_generar_codigo';
    end if;
  end loop;

  return v_codigo;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Canje
-- ─────────────────────────────────────────────────────────────────────────────
/*
  Descuenta los puntos y crea el canje, atómicamente.

  La idempotencia sigue la lección de `0019`, incluidas las dos trampas que allí
  costaron caro:

   · la clave lleva el usuario dentro. Sin él, dos personas que enviaran el mismo
     identificador de intento colisionarían y la segunda recibiría el canje de la
     primera;
   · la comprobación va ANTES de tocar nada. Al revés —descontar y dejar que
     `apply_loyalty_transaction` detecte la clave repetida y no descuente— restaría
     existencias del catálogo sin que nadie recibiera su recompensa.
*/
create or replace function public.canjear_recompensa(
  p_user_id uuid,
  p_reward_id uuid,
  p_client_request_id text default null
)
returns table (
  redemption_id uuid,
  codigo text,
  nombre text,
  costo_puntos bigint,
  puntos_restantes bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reward public.loyalty_rewards%rowtype;
  v_previo public.loyalty_redemptions%rowtype;
  v_saldo bigint;
  v_puntos bigint;
  v_clave text;
  v_codigo text;
  v_id uuid;
begin
  v_clave := 'reward:' || p_reward_id::text || ':' || p_user_id::text || ':' ||
             coalesce(p_client_request_id, gen_random_uuid()::text);

  -- Reenvío de una petición ya aplicada: se devuelve lo que pasó entonces.
  select r.* into v_previo
    from public.loyalty_redemptions r
   where r.id = (
     select (lt.metadata ->> 'redemption_id')::uuid
       from public.loyalty_transactions lt
      where lt.idempotency_key = v_clave
   );

  if found then
    select points_balance into v_saldo
      from public.loyalty_accounts where user_id = p_user_id;
    return query
      select v_previo.id, v_previo.codigo, v_previo.nombre, v_previo.costo_puntos,
             coalesce(v_saldo, 0);
    return;
  end if;

  select w.* into v_reward
    from public.loyalty_rewards w
   where w.id = p_reward_id
     for update;

  if not found then
    raise exception 'recompensa_no_encontrada';
  end if;
  if not v_reward.activa then
    raise exception 'recompensa_inactiva';
  end if;
  if v_reward.existencias is not null and v_reward.existencias <= 0 then
    raise exception 'recompensa_agotada';
  end if;

  v_puntos := v_reward.costo_puntos;

  /*
    Se comprueba el saldo aquí además de dentro de `apply_loyalty_transaction`.

    No es redundancia inútil: la función de abajo levanta `insufficient_points`,
    que es correcto pero no distingue entre «te faltan puntos» y cualquier otro
    fallo del ledger. Comprobarlo antes permite un error propio que la pantalla
    sabe traducir a algo que la persona entiende.
  */
  select points_balance into v_saldo
    from public.loyalty_accounts where user_id = p_user_id;

  if coalesce(v_saldo, 0) < v_puntos then
    raise exception 'puntos_insuficientes';
  end if;

  v_codigo := public.generar_codigo_canje();

  insert into public.loyalty_redemptions (
    user_id, reward_id, nombre, costo_puntos, codigo
  ) values (
    p_user_id, p_reward_id, v_reward.nombre, v_puntos, v_codigo
  ) returning id into v_id;

  -- Las existencias bajan dentro del mismo bloqueo que las leyó: dos canjes
  -- simultáneos de la última unidad se serializan y el segundo ve el cero.
  if v_reward.existencias is not null then
    update public.loyalty_rewards
       set existencias = existencias - 1, updated_at = now()
     where id = p_reward_id;
  end if;

  select t.new_points_balance into v_saldo
    from public.apply_loyalty_transaction(
      p_user_id,
      -v_puntos,
      'redeem',
      v_clave,
      v_id::text,
      'Canje: ' || v_reward.nombre,
      jsonb_build_object('redemption_id', v_id, 'reward_id', p_reward_id)
    ) t;

  insert into public.audit_logs (
    actor_user_id, target_user_id, action, entity_type, entity_id, reason, after_data
  ) values (
    p_user_id, p_user_id, 'recompensa_canjeada', 'loyalty_redemption', v_id::text,
    'Canje desde la cuenta del usuario',
    jsonb_build_object('reward_id', p_reward_id, 'costo_puntos', v_puntos,
                       'puntos_despues', v_saldo)
  );

  return query select v_id, v_codigo, v_reward.nombre, v_puntos, v_saldo;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Catálogo: alta, edición y retirada
-- ─────────────────────────────────────────────────────────────────────────────
/*
  Mismo patrón que `0015` y `0017`: rol comprobado EN SQL, motivo obligatorio,
  captura del antes y `audit_logs` en la misma transacción.

  Crear recompensas es configurar el programa de lealtad, así que es de dueña,
  igual que editar las reglas y los niveles.
*/
create or replace function public.admin_recompensa_guardar(
  p_actor_id uuid,
  p_reward_id uuid,          -- null = alta
  p_nombre text,
  p_descripcion text,
  p_costo_puntos bigint,
  p_imagen_clave text,
  p_existencias integer,
  p_orden integer,
  p_activa boolean,
  p_reason text,
  p_request_id text default null
)
returns table (reward_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes public.loyalty_rewards%rowtype;
  v_id uuid;
begin
  if not public.es_duena(p_actor_id) then
    raise exception 'no_autorizado';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'motivo_obligatorio';
  end if;

  if p_nombre is null or btrim(p_nombre) = '' then
    raise exception 'nombre_obligatorio';
  end if;

  if p_costo_puntos is null or p_costo_puntos <= 0 then
    raise exception 'costo_invalido';
  end if;

  -- El mismo tope que un ajuste de puntos: un freno ante un dedo torpe.
  if p_costo_puntos > 100000 then
    raise exception 'costo_excesivo';
  end if;

  if p_existencias is not null and p_existencias < 0 then
    raise exception 'existencias_invalidas';
  end if;

  if p_reward_id is null then
    insert into public.loyalty_rewards (
      nombre, descripcion, costo_puntos, imagen_clave, existencias, orden, activa
    ) values (
      btrim(p_nombre), nullif(btrim(coalesce(p_descripcion, '')), ''), p_costo_puntos,
      nullif(btrim(coalesce(p_imagen_clave, '')), ''), p_existencias,
      coalesce(p_orden, 0), coalesce(p_activa, true)
    ) returning id into v_id;

    insert into public.audit_logs (
      actor_user_id, action, entity_type, entity_id, reason, after_data, request_id
    ) values (
      p_actor_id, 'recompensa_creada', 'loyalty_reward', v_id::text, btrim(p_reason),
      jsonb_build_object('nombre', btrim(p_nombre), 'costo_puntos', p_costo_puntos,
                         'existencias', p_existencias, 'activa', coalesce(p_activa, true)),
      p_request_id
    );

    return query select v_id;
    return;
  end if;

  select w.* into v_antes from public.loyalty_rewards w where w.id = p_reward_id for update;
  if not found then
    raise exception 'recompensa_no_encontrada';
  end if;

  update public.loyalty_rewards
     set nombre = btrim(p_nombre),
         descripcion = nullif(btrim(coalesce(p_descripcion, '')), ''),
         costo_puntos = p_costo_puntos,
         imagen_clave = nullif(btrim(coalesce(p_imagen_clave, '')), ''),
         existencias = p_existencias,
         orden = coalesce(p_orden, 0),
         activa = coalesce(p_activa, true),
         updated_at = now()
   where id = p_reward_id;

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id, reason, before_data, after_data, request_id
  ) values (
    p_actor_id, 'recompensa_editada', 'loyalty_reward', p_reward_id::text, btrim(p_reason),
    jsonb_build_object('nombre', v_antes.nombre, 'costo_puntos', v_antes.costo_puntos,
                       'existencias', v_antes.existencias, 'activa', v_antes.activa),
    jsonb_build_object('nombre', btrim(p_nombre), 'costo_puntos', p_costo_puntos,
                       'existencias', p_existencias, 'activa', coalesce(p_activa, true)),
    p_request_id
  );

  return query select p_reward_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Entrega en mostrador
-- ─────────────────────────────────────────────────────────────────────────────
/*
  Marcar una recompensa como entregada es trabajo de barra, no de despacho: lo
  hace quien está delante de la persona. Por eso basta con estar en
  `admin_users`, igual que marcar la asistencia de un taller (`0017`).

  No devuelve puntos ni los mueve: entregar solo cierra el canje. Si hay que
  revertir uno, es un ajuste de puntos con su propio motivo — un movimiento
  nuevo, nunca el borrado del anterior (`docs/00`).
*/
create or replace function public.admin_recompensa_entregar(
  p_actor_id uuid,
  p_redemption_id uuid,
  p_request_id text default null
)
returns table (estado text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_canje public.loyalty_redemptions%rowtype;
begin
  if not exists (select 1 from public.admin_users where user_id = p_actor_id) then
    raise exception 'no_autorizado';
  end if;

  select r.* into v_canje
    from public.loyalty_redemptions r
   where r.id = p_redemption_id
     for update;

  if not found then
    raise exception 'canje_no_encontrado';
  end if;

  if v_canje.estado = 'entregada' then
    raise exception 'ya_entregada';
  end if;
  if v_canje.estado = 'cancelada' then
    raise exception 'canje_cancelado';
  end if;

  update public.loyalty_redemptions
     set estado = 'entregada', entregada_at = now(), entregada_por = p_actor_id
   where id = p_redemption_id;

  insert into public.audit_logs (
    actor_user_id, target_user_id, action, entity_type, entity_id, reason,
    before_data, after_data, request_id
  ) values (
    p_actor_id, v_canje.user_id, 'recompensa_entregada', 'loyalty_redemption',
    p_redemption_id::text, 'Entrega en mostrador',
    jsonb_build_object('estado', v_canje.estado),
    jsonb_build_object('estado', 'entregada', 'codigo', v_canje.codigo,
                       'nombre', v_canje.nombre),
    p_request_id
  );

  return query select 'entregada'::text;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Lecturas del panel
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_recompensas_listar()
returns table (
  id uuid,
  nombre text,
  descripcion text,
  costo_puntos bigint,
  imagen_clave text,
  existencias integer,
  orden integer,
  activa boolean,
  veces_canjeada bigint,
  pendientes bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select w.id, w.nombre, w.descripcion, w.costo_puntos, w.imagen_clave,
         w.existencias, w.orden, w.activa,
         (select count(*) from public.loyalty_redemptions r where r.reward_id = w.id),
         (select count(*) from public.loyalty_redemptions r
           where r.reward_id = w.id and r.estado = 'pendiente')
    from public.loyalty_rewards w
   order by w.activa desc, w.orden, w.costo_puntos;
$$;

/*
  La cola del mostrador. Solo lo pendiente, lo más viejo primero: es el orden en
  el que la gente llegó a pedirlo.
*/
create or replace function public.admin_canjes_pendientes()
returns table (
  id uuid,
  codigo text,
  nombre text,
  costo_puntos bigint,
  creado timestamptz,
  persona text,
  email text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.id, r.codigo, r.nombre, r.costo_puntos, r.created_at,
         btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
         p.email
    from public.loyalty_redemptions r
    left join public.profiles p on p.id = r.user_id
   where r.estado = 'pendiente'
   order by r.created_at;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.loyalty_rewards enable row level security;
alter table public.loyalty_redemptions enable row level security;

-- El catálogo activo es público, igual que las reglas y los niveles (`0005`):
-- son las condiciones del programa y se publican. Escribir, solo el servidor.
create policy "loyalty_rewards_lectura" on public.loyalty_rewards
  for select to anon, authenticated using (activa);

-- Cada quien ve sus canjes y nada más. El código de otra persona no se puede
-- ni leer ni adivinar desde el navegador.
create policy "loyalty_redemptions_propias" on public.loyalty_redemptions
  for select to authenticated using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Permisos: solo el servidor.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.generar_codigo_canje()',
    'public.canjear_recompensa(uuid,uuid,text)',
    'public.admin_recompensa_guardar(uuid,uuid,text,text,bigint,text,integer,integer,boolean,text,text)',
    'public.admin_recompensa_entregar(uuid,uuid,text)',
    'public.admin_recompensas_listar()',
    'public.admin_canjes_pendientes()'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

/*
  Freno del canje.

  Generoso a propósito: canjear no es una operación sospechosa, y quien tiene
  puntos de sobra puede querer varias cosas seguidas. Lo que corta es el bucle
  automático que vaciaría en segundos una recompensa de existencias limitadas.
*/
insert into public.rate_limit_reglas (accion, max_intentos, ventana_segundos, descripcion) values
  ('canje_recompensa', 20, 900, 'Canjes de recompensas por persona, 15 min')
on conflict (accion) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Semilla
-- ─────────────────────────────────────────────────────────────────────────────
/*
  Las cuatro de `05-cuenta-movil-reference.png`, con los costes que enseña.

  Solo dos llevan foto: son las únicas dos que tienen un asset aprobado en el
  repo. «Pastel o snack» y «Experiencia» nacen sin imagen —tarjeta tipográfica—
  porque `docs/01` prohíbe rellenar con fotos de banco o inventadas. En cuanto
  haya foto de marca, se les asigna desde el panel sin tocar código.

  `on conflict do nothing` no aplica —no hay clave natural—, así que se siembra
  solo si la tabla está vacía: volver a pasar la migración no duplica el
  catálogo ni pisa lo que la dueña haya editado.
*/
insert into public.loyalty_rewards (nombre, descripcion, costo_puntos, imagen_clave, orden)
select * from (values
  ('Bebida gratis', 'Cualquier bebida de la carta, de la casa.', 500::bigint,
   'siembraIcedCoffeePromo', 1),
  ('Pastel o snack', 'Acompaña tu café con algo dulce.', 400::bigint,
   null, 2),
  ('Tote bag', 'La bolsa reutilizable de SIEMBRA.', 800::bigint,
   'siembraBagToteCupMockup', 3),
  ('Experiencia', 'Una plaza en uno de nuestros talleres.', 1200::bigint,
   null, 4)
) as semilla(nombre, descripcion, costo_puntos, imagen_clave, orden)
where not exists (select 1 from public.loyalty_rewards);

-- ─────────────────────────────────────────────────────────────────────────────
-- 0013 — Métricas agregadas EN SQL.
--
-- Esto no es una mejora de rendimiento: es una corrección de un número falso.
--
-- `obtenerResumen()` (src/lib/services/admin-consultas.ts) hacía esto:
--
--     .from("wallets").select("balance_cents")     -- trae TODAS las filas
--     saldos.reduce((s, w) => s + w.balance_cents) -- y suma en JavaScript
--
-- El cliente de Supabase devuelve como mucho 1.000 filas por defecto. Con 1.001
-- wallets, el «crédito en circulación» del panel empieza a mentir: no da error,
-- no avisa, simplemente enseña una cifra más baja que la real. Y es el número
-- que dice cuánto dinero debe el negocio.
--
-- La suma se hace donde están los datos. Nada de traer filas para contarlas.
--
-- Todo lo de aquí LEE. Ninguna función escribe, así que ninguna necesita
-- motivo ni auditoría; el rol tampoco se comprueba aquí, porque el acceso ya
-- está cerrado por el `grant` a `service_role` y por `exigirAdmin()` en cada
-- página. Un empleado puede ver el resumen; lo que no puede es tocar nada.
-- ─────────────────────────────────────────────────────────────────────────────

/*
  Foto del negocio ahora mismo.

  Devuelve una sola fila. Cada subconsulta es un agregado independiente, así que
  Postgres las resuelve en paralelo y el coste es el de varios índices, no el de
  traer tablas enteras a la aplicación.
*/
create or replace function public.metricas_resumen()
returns table (
  miembros bigint,
  miembros_7d bigint,
  miembros_30d bigint,
  con_marketing bigint,
  correo_confirmado bigint,
  perfil_visitado bigint,
  saldo_total_cents bigint,
  wallets_con_saldo bigint,
  puntos_total bigint,
  pedidos_totales bigint,
  pedidos_pagados bigint,
  giftcards_gmv_cents bigint,
  giftcards_sin_canjear bigint,
  giftcards_breakage_cents bigint,
  suscriptores bigint,
  entradas_auditoria bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.profiles),
    (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
    (select count(*) from public.profiles where created_at >= now() - interval '30 days'),
    (select count(*) from public.profiles where marketing_email_opt_in),
    (select count(*) from auth.users where email_confirmed_at is not null),
    -- Activación real: `member_qr_tokens` se escribe en cada carga de /perfil,
    -- así que tener fila significa haber entrado al área privada al menos una
    -- vez. Es la única señal de activación que existe hoy.
    (select count(distinct user_id) from public.member_qr_tokens),
    (select coalesce(sum(balance_cents), 0) from public.wallets),
    (select count(*) from public.wallets where balance_cents > 0),
    (select coalesce(sum(points_balance), 0) from public.loyalty_accounts),
    (select count(*) from public.gift_card_orders),
    (select count(*) from public.gift_card_orders where status = 'paid'),
    (select coalesce(sum(amount_cents), 0) from public.gift_card_orders where status = 'paid'),
    -- Breakage: tarjetas emitidas que nadie ha canjeado. Es dinero ya cobrado
    -- que quizá no llegue a servirse nunca; conviene mirarlo de frente.
    (select count(*) from public.gift_cards where status = 'active'),
    (select coalesce(sum(amount_cents), 0) from public.gift_cards where status = 'active'),
    (select count(*) from public.newsletter_subscribers where unsubscribed_at is null),
    (select count(*) from public.audit_logs);
$$;

/*
  Serie temporal para las gráficas.

  Devuelve SIEMPRE todos los periodos del rango, incluidos los que valen cero.
  Sin eso una gráfica de barras se dibuja engañosa: una semana sin altas
  desaparece en vez de verse como un hueco, y la curva parece continua cuando no
  lo es.

  Las fechas se truncan en hora de Puerto Rico, no en UTC. Un registro a las
  8 de la noche en Condado es de ese día, no del siguiente.

  `p_metrica` y `p_grano` no se interpolan en ningún SQL dinámico: se comparan
  contra una lista cerrada y cualquier otro valor levanta excepción.
*/
create or replace function public.metricas_serie(
  p_metrica text,
  p_desde date,
  p_hasta date,
  p_grano text default 'dia'
)
returns table (periodo timestamp, valor bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_unidad text;
  v_zona constant text := 'America/Puerto_Rico';
begin
  v_unidad := case p_grano
    when 'dia' then 'day'
    when 'semana' then 'week'
    when 'mes' then 'month'
    else null
  end;

  if v_unidad is null then
    raise exception 'grano invalido: %', p_grano;
  end if;

  if p_desde > p_hasta then
    raise exception 'rango invalido';
  end if;

  return query
  with periodos as (
    select generate_series(
      date_trunc(v_unidad, p_desde::timestamp),
      date_trunc(v_unidad, p_hasta::timestamp),
      ('1 ' || v_unidad)::interval
    ) as p
  ),
  datos as (
    select date_trunc(v_unidad, f.momento at time zone v_zona) as p,
           sum(f.cantidad)::bigint as v
      from (
        -- Altas de miembros.
        select created_at as momento, 1::bigint as cantidad
          from public.profiles
         where p_metrica = 'altas'

        union all
        -- Crédito que ENTRA en las wallets.
        select created_at, amount_cents
          from public.wallet_transactions
         where p_metrica = 'credito_emitido' and amount_cents > 0

        union all
        -- Crédito que SALE. Se devuelve en positivo: una gráfica de gasto con
        -- barras hacia abajo se lee mal.
        select created_at, -amount_cents
          from public.wallet_transactions
         where p_metrica = 'credito_canjeado' and amount_cents < 0

        union all
        select created_at, points
          from public.loyalty_transactions
         where p_metrica = 'puntos_emitidos' and points > 0

        union all
        select created_at, -points
          from public.loyalty_transactions
         where p_metrica = 'puntos_canjeados' and points < 0

        union all
        -- Ingresos reales por gift cards. Se fecha por `paid_at`, no por
        -- `created_at`: lo que cuenta es cuándo entró el dinero, no cuándo se
        -- abrió un checkout que quizá se abandonó.
        select paid_at, amount_cents
          from public.gift_card_orders
         where p_metrica = 'giftcards_gmv' and status = 'paid' and paid_at is not null

        union all
        select created_at, 1::bigint
          from public.gift_card_orders
         where p_metrica = 'giftcards_pedidos'

        union all
        select created_at, 1::bigint
          from public.newsletter_subscribers
         where p_metrica = 'suscriptores'
      ) f
     where f.momento >= p_desde::timestamp at time zone v_zona
       and f.momento < (p_hasta + 1)::timestamp at time zone v_zona
     group by 1
  )
  select periodos.p, coalesce(datos.v, 0)
    from periodos
    left join datos on datos.p = periodos.p
   order by periodos.p;
end;
$$;

revoke all on function public.metricas_resumen() from public, anon, authenticated;
revoke all on function public.metricas_serie(text, date, date, text) from public, anon, authenticated;
grant execute on function public.metricas_resumen() to service_role;
grant execute on function public.metricas_serie(text, date, date, text) to service_role;

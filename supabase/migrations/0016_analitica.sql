-- ─────────────────────────────────────────────────────────────────────────────
-- 0016 — Analítica de visitas. Propia, anónima y ya agregada.
--
-- Hasta aquí el panel no sabía cuánta gente entra en la web. Todo lo que medía
-- —altas, crédito, gift cards— ocurre DESPUÉS de que alguien se registre. Quien
-- mira la carta y se va no dejaba ni rastro, y esa es la mayoría.
--
-- Por qué no Google Analytics, Vercel Analytics ni Plausible
-- ----------------------------------------------------------
-- Tres razones, y ninguna es ideológica:
--
--  1. La cláusula 5 de /privacidad dice, literalmente, que no se usan cookies de
--     analítica y que por eso no hay banner de consentimiento. Cualquier script
--     de terceros la convierte en mentira y obliga a poner el banner.
--  2. La cláusula 4 enumera los encargados del tratamiento: Supabase, Stripe,
--     Resend y Vercel. Añadir un proveedor obliga a reescribirla.
--  3. La CSP es `script-src 'self'` sin CDN (src/lib/seguridad/cabeceras.ts).
--     Un script externo no cargaría sin abrir un agujero en ella.
--
-- Contando en Postgres desde el servidor, las tres siguen intactas.
--
-- Qué se guarda y qué NO
-- ----------------------
-- Se guardan tres cosas: qué página, en qué hora, y de qué tipo de sitio venía.
-- Y un contador.
--
-- NO se guarda: dirección IP, user-agent, identificador de usuario, cookie,
-- huella de navegador, la URL completa del referente ni sus parámetros. Nada de
-- eso está en la tabla porque no hay columna donde ponerlo — no es una promesa
-- que dependa de que la aplicación se porte bien.
--
-- Es analítica de páginas, no de personas: cuenta visitas, no visitantes. No se
-- puede saber si dos visitas son de la misma persona, y por tanto tampoco hay
-- «usuarios únicos» ni embudos individuales. Se pierde precisión a cambio de no
-- tener que pedir permiso para nada.
-- ─────────────────────────────────────────────────────────────────────────────

/*
  Una fila por (ruta, hora, origen). No una por visita.

  Agregar al escribir en vez de guardar el log crudo y agrupar al leer:

   · La tabla crece con el número de COMBINACIONES, no de visitas. Un día flojo
     y un día de cola en la puerta ocupan lo mismo.
   · Leer es un `sum` sobre unas pocas miles de filas, no sobre millones.
   · Y sobre todo: sin filas individuales no hay nada que correlacionar. Una
     tabla de eventos con marca de tiempo al milisegundo permite reconstruir el
     recorrido de una sesión aunque no haya identificador; agregada por hora, no.

  Lo que se pierde: el orden en que alguien vio las páginas. Es justo lo que
  haría falta para perfilar a una persona, así que el precio está bien pagado.
*/
create table if not exists public.visitas_agregado (
  -- Patrón de ruta, no URL. `/perfil/pedidos`, nunca `/admin/usuarios/<uuid>`:
  -- los identificadores se colapsan a `[id]` antes de llegar aquí y la cadena
  -- de consulta se descarta entera. El CHECK impide que esta columna se use
  -- como almacén de texto libre aunque la aplicación mandara cualquier cosa.
  ruta text not null
    check (ruta ~ '^/[A-Za-z0-9/_\[\]-]*$' and length(ruta) <= 80),

  -- Truncada a la hora. La hora entera es el grano más fino que se guarda: con
  -- minutos, dos visitas seguidas a la misma página serían distinguibles de dos
  -- visitas separadas, que es información sobre una sesión concreta.
  hora timestamptz not null,

  -- CATEGORÍA, no URL. De un enlace de Instagram se guarda 'instagram' y se
  -- tira el resto: el `referer` completo lleva a menudo el identificador de la
  -- publicación, y a veces parámetros de campaña con datos de quien hizo clic.
  --
  -- 'interno' existe para no falsear el resto: son aperturas de página cuyo
  -- enlace venía de esta misma web —un formulario que redirige, una recarga
  -- desde otra página del sitio—. Contarlas como 'directo' inflaría la
  -- categoría equivocada y haría parecer que Instagram trae menos gente de la
  -- que trae. Al leer, la pregunta «¿de dónde viene la gente?» se responde
  -- ignorando 'interno'.
  origen text not null
    check (origen in ('directo','interno','instagram','facebook','tiktok','whatsapp','google','otro')),

  conteo integer not null default 0 check (conteo >= 0),

  primary key (ruta, hora, origen)
);

alter table public.visitas_agregado enable row level security;
-- Sin políticas a propósito: ni anon ni authenticated tienen nada que hacer
-- aquí. Se lee solo desde las funciones `security definer` de más abajo, que
-- únicamente `service_role` puede ejecutar.

-- La clave primaria empieza por `ruta`, así que no sirve para barrer un rango de
-- fechas: todas las lecturas del panel filtran por `hora`.
create index if not exists visitas_agregado_hora_idx
  on public.visitas_agregado (hora);

-- ─────────────────────────────────────────────────────────────────────────────
-- registrar_visita — suma uno.
--
-- Devuelve `true` si contó. Podría no devolver nada —quien llama ignora el
-- resultado, se llama y se olvida—, pero entonces un dato mal formado se
-- perdería en silencio y no habría forma de escribir un test que lo detecte.
--
-- No levanta excepción ante entrada inválida, y eso es deliberado: esto corre en
-- el proxy, en CADA petición. Una ruta que a alguien se le olvidó normalizar no
-- puede llenar los logs de producción de errores ni, mucho menos, tumbar la
-- respuesta. Se descarta la visita, se devuelve `false`, y la web sigue.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.registrar_visita(
  p_ruta text,
  p_origen text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hora timestamptz;
begin
  if p_ruta is null or p_ruta !~ '^/[A-Za-z0-9/_\[\]-]*$' or length(p_ruta) > 80 then
    return false;
  end if;

  if p_origen is null
     or p_origen not in ('directo','interno','instagram','facebook','tiktok','whatsapp','google','otro') then
    return false;
  end if;

  /*
    Truncado en UTC de forma explícita, no en la zona de la sesión.

    Puerto Rico es UTC-4 todo el año, sin horario de verano, así que las
    fronteras horarias coinciden y da igual en cuál se trunque. Pero el desfase
    de una zona no tiene por qué ser un número entero de horas —India es +5:30—
    y dejarlo a merced de la GUC `TimeZone` haría que la misma migración
    guardara cosas distintas según cómo estuviera configurada la conexión. Aquí
    se fija; el paso a hora de Puerto Rico se hace al LEER, igual que en 0013.
  */
  v_hora := date_trunc('hour', now() at time zone 'UTC') at time zone 'UTC';

  insert into public.visitas_agregado as v (ruta, hora, origen, conteo)
  values (p_ruta, v_hora, p_origen, 1)
  on conflict (ruta, hora, origen)
    do update set conteo = v.conteo + 1;

  -- Limpieza oportunista, como en `consumir_rate_limit` (0010:99): una de cada
  -- ~500 llamadas barre lo viejo y así no hace falta un cron.
  --
  -- 400 días, no 365: con un año justo, comparar «julio con el julio pasado»
  -- fallaría por unos días según cuándo se mire.
  if random() < 0.002 then
    delete from public.visitas_agregado where hora < now() - interval '400 days';
  end if;

  return true;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Lectura. Cuatro funciones porque la pantalla hace cuatro preguntas distintas,
-- y devolver las cuatro juntas obligaría a inventar una forma de fila que no es
-- la de ninguna.
--
-- Todas agregan EN SQL. Ninguna trae filas para sumarlas fuera: ese fue el bug
-- del crédito en circulación (0013).
-- ─────────────────────────────────────────────────────────────────────────────

/*
  Visitas por periodo, con los ceros incluidos.

  Mismo contrato que `metricas_serie` (0013): devuelve TODOS los periodos del
  rango, y trunca en hora de Puerto Rico. Un martes sin visitas tiene que
  dibujarse como un valle, no desaparecer y hacer que la curva parezca continua.
*/
create or replace function public.metricas_visitas_serie(
  p_desde date,
  p_hasta date,
  p_grano text default 'dia'
)
returns table (periodo timestamp, visitas bigint)
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
    select date_trunc(v_unidad, v.hora at time zone v_zona) as p,
           sum(v.conteo)::bigint as n
      from public.visitas_agregado v
     where v.hora >= p_desde::timestamp at time zone v_zona
       and v.hora < (p_hasta + 1)::timestamp at time zone v_zona
     group by 1
  )
  select periodos.p, coalesce(datos.n, 0)
    from periodos
    left join datos on datos.p = periodos.p
   order by periodos.p;
end;
$$;

/*
  Las páginas más vistas del rango.

  Ordenadas por visitas y, en empate, por ruta: sin el segundo criterio dos
  páginas con el mismo número bailan de sitio entre una carga y la siguiente sin
  que haya cambiado nada, y eso hace dudar del dato entero.
*/
create or replace function public.metricas_visitas_rutas(
  p_desde date,
  p_hasta date,
  p_limite integer default 12
)
returns table (ruta text, visitas bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- Ordenado y agrupado por POSICIÓN y por columna cualificada, nunca por un
  -- nombre suelto: los nombres de `returns table` están en ámbito dentro del
  -- cuerpo, y un `order by visitas` sería ambiguo entre el alias del select y
  -- la columna de salida.
  select v.ruta, sum(v.conteo)::bigint
    from public.visitas_agregado v
   where v.hora >= p_desde::timestamp at time zone 'America/Puerto_Rico'
     and v.hora < (p_hasta + 1)::timestamp at time zone 'America/Puerto_Rico'
   group by v.ruta
   order by 2 desc, 1
   limit greatest(1, least(coalesce(p_limite, 12), 100));
$$;

/*
  De dónde viene la gente.

  Devuelve TODAS las categorías siempre, incluidas las que valen cero. Una lista
  donde solo aparece lo que tuvo tráfico no deja ver que Instagram trajo cero
  esta semana, que es justamente el dato accionable.

  'interno' viene incluido y la pantalla lo aparta: es navegación dentro de la
  web, no una procedencia. Se devuelve igualmente porque la suma de todas las
  categorías tiene que cuadrar con el total de visitas; si esta función se
  dejara fuera una parte, los dos números de la misma pantalla se contradirían.
*/
create or replace function public.metricas_visitas_origen(
  p_desde date,
  p_hasta date
)
returns table (origen text, visitas bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with categorias(nombre) as (
    values ('directo'),('interno'),('instagram'),('facebook'),
           ('tiktok'),('whatsapp'),('google'),('otro')
  ),
  datos as (
    select v.origen, sum(v.conteo)::bigint as n
      from public.visitas_agregado v
     where v.hora >= p_desde::timestamp at time zone 'America/Puerto_Rico'
       and v.hora < (p_hasta + 1)::timestamp at time zone 'America/Puerto_Rico'
     group by v.origen
  )
  select categorias.nombre, coalesce(datos.n, 0)
    from categorias
    left join datos on datos.origen = categorias.nombre
   order by 2 desc, 1;
$$;

/*
  El titular: total, comparación y hora punta.

  `total_anterior` es el mismo número de días inmediatamente antes del rango.
  Sin él, «1.240 visitas» no dice si eso es mucho o poco.

  `hora_punta` es la hora del día (0–23, en Puerto Rico) que más visitas acumula
  en todo el rango. Para una cafetería es el dato con consecuencia práctica: si
  la carta se mira a las ocho de la mañana, publicar a las siete de la tarde es
  hablarle a nadie. Vale `null` mientras no haya ninguna visita, en vez de decir
  «las 12 de la noche» por defecto.
*/
create or replace function public.metricas_visitas_resumen(
  p_desde date,
  p_hasta date
)
returns table (
  total bigint,
  total_anterior bigint,
  rutas bigint,
  hora_punta integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with zona as (select 'America/Puerto_Rico'::text as z),
  ventana as (
    select
      p_desde::timestamp at time zone z as ini,
      (p_hasta + 1)::timestamp at time zone z as fin,
      (p_desde - (p_hasta - p_desde + 1))::timestamp at time zone z as ini_previa,
      p_desde::timestamp at time zone z as fin_previa,
      z
    from zona
  ),
  actual as (
    -- `n_rutas` y no `rutas`: coincidir con el nombre de una columna de
    -- `returns table` la pone en ámbito dentro del cuerpo y vuelve ambigua
    -- cualquier referencia sin cualificar.
    select coalesce(sum(v.conteo), 0)::bigint as n,
           count(distinct v.ruta)::bigint as n_rutas
      from public.visitas_agregado v, ventana w
     where v.hora >= w.ini and v.hora < w.fin
  ),
  previa as (
    select coalesce(sum(v.conteo), 0)::bigint as n
      from public.visitas_agregado v, ventana w
     where v.hora >= w.ini_previa and v.hora < w.fin_previa
  ),
  punta as (
    select extract(hour from (v.hora at time zone w.z))::integer as h
      from public.visitas_agregado v, ventana w
     where v.hora >= w.ini and v.hora < w.fin
     group by 1
     order by sum(v.conteo) desc, 1
     limit 1
  )
  select actual.n, previa.n, actual.n_rutas, (select punta.h from punta)
    from actual, previa;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Permisos: solo el servidor.
--
-- `registrar_visita` NO se concede a `anon`, aunque quien la llama sea el proxy
-- en nombre de un visitante sin sesión. La clave publicable viaja en el
-- navegador: con el grant, cualquiera podría llamar al RPC en bucle e inflar el
-- contador sin coste. La analítica dejaría de significar nada y la dueña estaría
-- tomando decisiones sobre números inventados.
--
-- Inflar las cifras pidiendo páginas de verdad sigue siendo posible, claro, pero
-- eso cuesta un render entero por visita y se frena en el borde.
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on function public.registrar_visita(text, text) from public, anon, authenticated;
revoke all on function public.metricas_visitas_serie(date, date, text) from public, anon, authenticated;
revoke all on function public.metricas_visitas_rutas(date, date, integer) from public, anon, authenticated;
revoke all on function public.metricas_visitas_origen(date, date) from public, anon, authenticated;
revoke all on function public.metricas_visitas_resumen(date, date) from public, anon, authenticated;

grant execute on function public.registrar_visita(text, text) to service_role;
grant execute on function public.metricas_visitas_serie(date, date, text) to service_role;
grant execute on function public.metricas_visitas_rutas(date, date, integer) to service_role;
grant execute on function public.metricas_visitas_origen(date, date) to service_role;
grant execute on function public.metricas_visitas_resumen(date, date) to service_role;

-- Fase 3 — el nivel se deriva de los puntos, no se guarda.
--
-- `0001` creó `loyalty_accounts.tier` con default 'semilla' y nada la
-- actualizaba: tras sembrar 750 puntos la cuenta seguía marcada como 'semilla'.
--
-- El primer intento fue un trigger que la mantuviera al día. Funcionaba casi
-- siempre, y "casi siempre" en una columna desnormalizada es peor que no
-- tenerla: cuando falla, el balance y el nivel discrepan en silencio y quien
-- consulte la base —soporte, un informe, el panel de la Fase 6— lee un nivel
-- equivocado sin ninguna señal.
--
-- La causa de fondo es tener dos fuentes de verdad para el mismo hecho. Se
-- elimina la copia: los puntos son el dato y el nivel se calcula a partir de
-- ellos y de `loyalty_tiers`, que es configurable. Así no existe un estado en el
-- que puedan discrepar.

-- Función de conveniencia para SQL, informes y el panel administrativo.
create or replace function public.nivel_para_puntos(p_points bigint)
returns text
language sql
stable
as $$
  select key
    from public.loyalty_tiers
   where min_points <= greatest(coalesce(p_points, 0), 0)
   order by min_points desc
   limit 1
$$;

grant execute on function public.nivel_para_puntos(bigint) to anon, authenticated, service_role;

-- Por si quedó instalado el trigger del intento anterior.
drop trigger if exists loyalty_accounts_sync_tier on public.loyalty_accounts;
drop function if exists public.sincronizar_nivel();

-- Fuera la columna: era la única forma de que balance y nivel discreparan.
alter table public.loyalty_accounts drop column if exists tier;

-- Lectura cómoda del nivel vigente sin repetir el cálculo en cada consulta.
-- Hereda la RLS de loyalty_accounts: cada usuario solo ve su fila.
create or replace view public.loyalty_accounts_con_nivel
with (security_invoker = true)
as
  select la.user_id,
         la.points_balance,
         la.updated_at,
         public.nivel_para_puntos(la.points_balance) as tier
    from public.loyalty_accounts la;

grant select on public.loyalty_accounts_con_nivel to authenticated, service_role;

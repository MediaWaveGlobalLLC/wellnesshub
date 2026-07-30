-- Fase 2 — formato del member_id.
--
-- `0001` genera 'SMB-' + 8 hex aleatorios. El mockup 02 muestra 'SMB-000724':
-- seis dígitos, legible para dictarlo en caja. `docs/04` admite ambos
-- ("secuencia o short ID estable") y el plan aprobado fija el del mockup (D10).
--
-- Nota de seguridad: un identificador secuencial es enumerable y revela cuántos
-- miembros hay. Es aceptable aquí porque el member_id no autoriza nada — no da
-- acceso a saldo, puntos ni datos personales; solo identifica al miembro en el
-- mostrador. Toda operación sigue exigiendo sesión verificada server-side.

create sequence if not exists public.member_id_seq as bigint start with 1;

create or replace function public.siguiente_member_id()
returns text
language sql
volatile
as $$
  select 'SMB-' || lpad(nextval('public.member_id_seq')::text, 6, '0')
$$;

alter table public.profiles
  alter column member_id set default public.siguiente_member_id();

-- Reasigna los perfiles ya creados con el formato antiguo, en orden de alta
-- para que la numeración siga la antigüedad real del miembro.
do $$
declare
  fila record;
begin
  for fila in
    select id from public.profiles
     where member_id !~ '^SMB-[0-9]{6}$'
     order by created_at
  loop
    update public.profiles
       set member_id = public.siguiente_member_id()
     where id = fila.id;
  end loop;
end $$;

-- El cliente no puede consumir la secuencia: el member_id lo asigna el default
-- server-side y `protect_profile_columns` impide cambiarlo desde fuera.
revoke all on sequence public.member_id_seq from public, anon, authenticated;

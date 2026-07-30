-- Fase 2 — corrige el alcance de protect_profile_columns.
--
-- `0002` introdujo un trigger BEFORE UPDATE que restaura id, member_id y
-- created_at en CUALQUIER actualización. Protege de más: también revierte el
-- mantenimiento legítimo del servidor. El backfill de `0003` se ejecutó sin
-- error y no cambió una sola fila, porque el trigger deshacía cada UPDATE.
--
-- El objetivo real es que un usuario no pueda reescribir su identidad. Ese
-- ataque solo puede llegar por los roles del cliente, y RLS ya limita el UPDATE
-- a la propia fila. `service_role` y `postgres` son server-side y de confianza:
-- no tiene sentido bloquearlos, y hacerlo rompe las migraciones.
--
-- Por eso el trigger pasa a aplicarse únicamente cuando quien actualiza es
-- `anon` o `authenticated`.

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
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- Ahora sí, el backfill de 0003 que quedó sin efecto.
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

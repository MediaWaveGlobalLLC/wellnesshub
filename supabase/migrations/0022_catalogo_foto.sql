-- ─────────────────────────────────────────────────────────────────────────────
-- 0022 — Foto por producto del menú.
--
-- `menu_productos` no tenía ninguna columna de imagen, así que /menu pintaba
-- una foto genérica por sección y ninguna por producto. La carta no podía
-- enseñar lo que se está pidiendo.
--
-- Se guarda una CLAVE del manifiesto de marca, nunca una URL. Es la misma regla
-- que `loyalty_rewards.imagen_clave` (0020) y la fila «Fotos de recompensa» de
-- DEC-007, y aquí importa todavía más:
--
--  · el validador de diseño NO mira ficheros .sql ni la base de datos, solo
--    fuentes de TypeScript y CSS. Una URL guardada en Postgres y pintada desde
--    la fila pasaría `npm run validate:design` en verde violando `docs/01`. La
--    barrera tiene que estar en el modelo de datos, porque el linter no la ve.
--  · una clave solo puede apuntar a un asset ya aprobado y versionado en el
--    repo. Una URL puede apuntar a cualquier cosa.
--
-- Sin clave se pinta la fila sin foto, que es el caso NORMAL y no la excepción:
-- hay 24 imágenes elegibles para 30 productos, y varias son totes y servilletas.
-- `docs/11` es explícito con el asset que falta: se lista y se para, no se
-- fabrica un sustituto.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.menu_productos
  add column if not exists imagen_clave text;

-- ─────────────────────────────────────────────────────────────────────────────
-- Asignar o quitar la foto
-- ─────────────────────────────────────────────────────────────────────────────
/*
  Función NUEVA, no una ampliación de `admin_catalogo_producto_editar`.

  `create or replace function` con una lista de argumentos distinta no
  reemplaza: crea una SOBRECARGA. La firma vieja seguiría viva —y es la que
  aparece literalmente en el bloque de grants de `0015`— mientras que la nueva
  nacería sin revocar. Además `tests/integration/catalogo-admin.test.ts` llama
  por posición, así que cambiar la firma rompería las llamadas existentes.

  Aparte, tener acción propia deja el cambio distinguible en la auditoría.
*/
create or replace function public.admin_catalogo_producto_foto(
  p_actor_id uuid,
  p_producto_id uuid,
  p_imagen_clave text,
  p_reason text,
  p_request_id text default null
)
returns table (producto_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes public.menu_productos%rowtype;
  v_clave text;
begin
  if not public.es_duena(p_actor_id) then
    raise exception 'no_autorizado';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'motivo_obligatorio';
  end if;

  select p.* into v_antes
    from public.menu_productos p
   where p.id = p_producto_id
     for update;

  if not found then
    raise exception 'producto_no_encontrado';
  end if;

  -- Cadena vacía significa «quitar la foto», no «guardar una clave vacía».
  v_clave := nullif(btrim(coalesce(p_imagen_clave, '')), '');

  update public.menu_productos
     set imagen_clave = v_clave, updated_at = now()
   where id = p_producto_id;

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id, reason, before_data, after_data, request_id
  ) values (
    p_actor_id, 'menu_producto_foto', 'menu_producto', p_producto_id::text, btrim(p_reason),
    jsonb_build_object('imagen_clave', v_antes.imagen_clave, 'nombre', v_antes.nombre),
    jsonb_build_object('imagen_clave', v_clave),
    p_request_id
  );

  return query select p_producto_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Permisos: solo el servidor.
-- ─────────────────────────────────────────────────────────────────────────────
/*
  Esto NO es opcional. Postgres concede EXECUTE a PUBLIC por defecto, así que
  una función `security definer` que escribe en el catálogo y no se revoque
  queda ejecutable por `anon`. El fallo sería silencioso: nada en el repo
  comprueba privilegios de función hoy.

  Por eso la prueba de `catalogo-admin.test.ts` que acompaña a esta migración
  verifica `has_function_privilege('anon', ..., 'EXECUTE') = false`.
*/
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.admin_catalogo_producto_foto(uuid,uuid,text,text,text)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

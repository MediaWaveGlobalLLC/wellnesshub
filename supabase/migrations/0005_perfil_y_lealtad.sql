-- Fase 3 — datos del perfil.
--
-- `0001` cubre identidad, wallet y lealtad. Faltan las tablas que el mockup 02
-- y `docs/02` exigen: niveles, favoritos, eventos, pedidos, direcciones y el
-- token del QR de miembro.
--
-- Dos principios que atraviesan todo el archivo:
--
--  · Puntos y crédito son sistemas separados (`docs/00`). Aquí solo se
--    configuran los NIVELES, que se calculan sobre puntos y no tienen ninguna
--    equivalencia monetaria.
--  · El cliente lee lo suyo y no escribe nada que tenga valor. Favoritos y
--    reservas sí los gestiona el usuario; pedidos, puntos y saldo no.

-- ─────────────────────────────────────────────────────────────────────────────
-- Configuración de lealtad — editable sin tocar código (`docs/04`)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.loyalty_tiers (
  key text primary key check (key in ('semilla','brote','raiz','florecer')),
  label text not null,
  min_points bigint not null check (min_points >= 0),
  sort_order int not null unique,
  description text
);

-- Umbrales semilla. El mockup 02 solo fija dos anclas: nivel brote con 750 pts
-- acumulados y 2.000 como meta siguiente. El resto queda a criterio del negocio
-- y se cambia con un UPDATE, sin desplegar.
insert into public.loyalty_tiers (key, label, min_points, sort_order, description) values
  ('semilla',  'Semilla',  0,    1, 'Acabas de sembrar. Tu primera taza empieza el viaje.'),
  ('brote',    'Brote',    500,  2, 'Estás comenzando tu viaje.'),
  ('raiz',     'Raíz',     2000, 3, 'Ya echaste raíces en la comunidad.'),
  ('florecer', 'Florecer', 5000, 4, 'Floreciste. Gracias por crecer con nosotros.')
on conflict (key) do nothing;

create table if not exists public.loyalty_rules (
  key text primary key,
  points bigint not null,
  label text not null,
  active boolean not null default true
);

-- Reglas de acumulación del Brand Book pág. 6.
insert into public.loyalty_rules (key, points, label) values
  ('por_dolar',    1,   'Cada $1 en compras'),
  ('bebida',       50,  'Bebidas'),
  ('tienda',       100, 'Compras en tienda'),
  ('bienvenida',   100, 'Bono de bienvenida'),
  ('cumpleanos',   100, 'Bono de cumpleaños'),
  ('referido',     100, 'Un referido hace su primera compra'),
  ('vaso_reusable', 5,  'Traer vaso reusable')
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Favoritos
-- ─────────────────────────────────────────────────────────────────────────────
-- El menú vive en `src/lib/site.ts` y es contenido, no base de datos: se guarda
-- el slug del producto, no una FK a una tabla de catálogo que no existe.

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_slug text not null check (char_length(item_slug) between 1 and 80),
  created_at timestamptz not null default now(),
  primary key (user_id, item_slug)
);
create index if not exists favorites_user_created_idx on public.favorites(user_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Eventos y talleres
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text not null default 'SIEMBRA Condado',
  image_slug text,
  capacity int check (capacity is null or capacity > 0),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index if not exists events_starts_idx on public.events(starts_at) where published;

create table if not exists public.event_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  status text not null default 'confirmada' check (status in ('confirmada','cancelada','asistio','ausente')),
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);
create index if not exists event_bookings_user_idx on public.event_bookings(user_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Pedidos
-- ─────────────────────────────────────────────────────────────────────────────
-- No hay POS conectado todavía. La tabla existe para que /perfil/pedidos lea
-- datos reales en lugar de inventarlos, y sale con estado vacío honesto hasta
-- que exista una fuente de ventas. El cliente nunca escribe aquí.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_number text unique not null,
  status text not null default 'completado' check (status in ('en_camino','completado','cancelado')),
  total_cents bigint not null check (total_cents >= 0),
  channel text not null default 'tienda' check (channel in ('tienda','linea')),
  placed_at timestamptz not null default now()
);
create index if not exists orders_user_placed_idx on public.orders(user_id, placed_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Direcciones
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Casa',
  line1 text not null,
  line2 text,
  city text not null,
  region text not null default 'PR',
  postal_code text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists addresses_user_idx on public.addresses(user_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Token del QR de miembro
-- ─────────────────────────────────────────────────────────────────────────────
-- `docs/04`: el QR lleva un token público revocable, nunca secretos, saldos ni
-- correo. Si alguien fotografía el QR ajeno, se revoca y se emite otro sin
-- tocar la identidad del miembro.

create table if not exists public.member_qr_tokens (
  token text primary key default encode(gen_random_bytes(16), 'hex'),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index if not exists member_qr_tokens_activo_idx
  on public.member_qr_tokens(user_id) where revoked_at is null;

-- Emite el token del QR la primera vez que se pide, y lo reutiliza después.
--
-- No recibe el usuario por parámetro: lo toma de `auth.uid()`. Así, aunque se
-- pueda ejecutar desde una sesión de navegador, es imposible pedir el token de
-- otra persona — no hay ningún argumento que manipular.
create or replace function public.obtener_qr_token()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_token text;
begin
  if v_user_id is null then
    raise exception 'sesion_requerida';
  end if;

  select token into v_token
    from public.member_qr_tokens
   where user_id = v_user_id and revoked_at is null;

  if v_token is null then
    insert into public.member_qr_tokens (user_id)
    values (v_user_id)
    returning token into v_token;
  end if;

  return v_token;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.loyalty_tiers    enable row level security;
alter table public.loyalty_rules    enable row level security;
alter table public.favorites        enable row level security;
alter table public.events           enable row level security;
alter table public.event_bookings   enable row level security;
alter table public.orders           enable row level security;
alter table public.addresses        enable row level security;
alter table public.member_qr_tokens enable row level security;

-- Configuración de lealtad: lectura pública. Son las reglas del programa, se
-- publican en la web; escribir solo desde el servidor.
create policy "loyalty_tiers_lectura" on public.loyalty_tiers
  for select to anon, authenticated using (true);
create policy "loyalty_rules_lectura" on public.loyalty_rules
  for select to anon, authenticated using (true) ;

-- Eventos publicados: catálogo público.
create policy "events_publicados_lectura" on public.events
  for select to anon, authenticated using (published);

-- Favoritos: el usuario los gestiona por completo.
create policy "favorites_select_own" on public.favorites
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "favorites_insert_own" on public.favorites
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "favorites_delete_own" on public.favorites
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Reservas: el usuario crea y cancela las suyas. El cambio de estado a
-- 'asistio'/'ausente' lo hace el personal server-side, no el cliente.
create policy "event_bookings_select_own" on public.event_bookings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "event_bookings_insert_own" on public.event_bookings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "event_bookings_update_own" on public.event_bookings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and status in ('confirmada','cancelada'));

-- Pedidos y direcciones: lectura de lo propio.
create policy "orders_select_own" on public.orders
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "addresses_select_own" on public.addresses
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "addresses_insert_own" on public.addresses
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "addresses_update_own" on public.addresses
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "addresses_delete_own" on public.addresses
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Sin política para member_qr_tokens: el token se entrega por la función
-- security definer, no leyendo la tabla desde el navegador.

revoke all on function public.obtener_qr_token() from public, anon;
grant execute on function public.obtener_qr_token() to authenticated, service_role;

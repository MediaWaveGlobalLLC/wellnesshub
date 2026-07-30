-- Fase 7 — suscripción a la comunidad.
--
-- El bloque terracota de la home (mockup 04) capta correos. Sin esta tabla el
-- formulario sería decorativo, y un campo que acepta datos y no los guarda es
-- peor que no ponerlo: el visitante cree que se suscribió.

create table if not exists public.newsletter_subscribers (
  email text primary key,
  -- De dónde llegó, para saber qué bloque convierte.
  source text not null default 'home',
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.newsletter_subscribers enable row level security;

-- Cualquiera puede suscribirse; nadie puede leer la lista desde el navegador.
-- Sin política de SELECT, RLS deniega por defecto: el listado solo se consulta
-- server-side con service_role, desde el panel de la Fase 6.
create policy "newsletter_alta_publica" on public.newsletter_subscribers
  for insert to anon, authenticated with check (true);

grant insert on public.newsletter_subscribers to anon, authenticated;

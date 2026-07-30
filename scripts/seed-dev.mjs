#!/usr/bin/env node
/**
 * Cuenta de desarrollo para verificar /perfil con datos reales.
 *
 * NO es para producción. Crea un usuario con credenciales conocidas usando solo
 * la clave publicable. Confirmar el correo y sembrar la actividad requiere SQL:
 * este script imprime el bloque listo para pegar en el SQL Editor, junto con el
 * de limpieza.
 *
 * Uso: node scripts/seed-dev.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const linea of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const EMAIL = "valeria.dev@mailinator.com";
const PASSWORD = "siembra2026dev";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

const { data, error } = await supabase.auth.signUp({
  email: EMAIL,
  password: PASSWORD,
  options: {
    data: {
      first_name: "Valeria",
      last_name: "Ramos",
      phone: "+19398350044",
      marketing_email_opt_in: true,
    },
  },
});

if (error && !/already registered/i.test(error.message)) {
  console.error("signUp falló:", error.message);
  process.exit(1);
}

console.log(`Cuenta de desarrollo\n  correo:     ${EMAIL}\n  contraseña: ${PASSWORD}`);
if (data?.user?.id) console.log(`  id:         ${data.user.id}`);

console.log(`
${"─".repeat(78)}
Pega esto en el SQL Editor de Supabase para confirmar el correo y sembrar la
actividad que pinta el mockup 02 (750 pts → nivel Brote):
${"─".repeat(78)}

-- 1. Confirmar el correo de las cuentas de prueba
update auth.users
   set email_confirmed_at = coalesce(email_confirmed_at, now())
 where email like '%@mailinator.com';

-- 2. Actividad de puntos (usa el ledger, nunca escribe el balance a mano)
with u as (select id from auth.users where email = '${EMAIL}')
select public.apply_loyalty_transaction(
         u.id, m.puntos, m.tipo, 'seed-' || m.clave, null, m.detalle)
  from u, (values
    (500::bigint, 'earn',       'bienvenida', 'Bono de bienvenida'),
    (45::bigint,  'earn',       'pedido-1',   'Pedido #SMB4821 · Matcha Latte Grande'),
    (100::bigint, 'earn',       'taller-1',   'Taller: Latte Art Básico'),
    (30::bigint,  'earn',       'pedido-2',   'Pedido #SMB4710 · Cold Brew'),
    (-350::bigint,'redeem',     'canje-1',    'Canje de recompensa · Bebida gratis'),
    (425::bigint, 'earn',       'pedido-3',   'Pedido #SMB4903 · Mango Radiance')
  ) as m(puntos, tipo, clave, detalle);

-- 3. Crédito de tienda (ledger, no UPDATE directo al wallet)
with u as (select id from auth.users where email = '${EMAIL}')
select public.apply_wallet_transaction(
         u.id, 6840, 'promotion', 'seed-credito', null, 'Crédito de bienvenida');

-- 4. Favoritos
with u as (select id from auth.users where email = '${EMAIL}')
insert into public.favorites (user_id, item_slug)
select u.id, s FROM u, unnest(array['matcha-clasico','latte']) as s
on conflict do nothing;

-- 5. Un taller publicado y su reserva
insert into public.events (slug, title, description, starts_at, ends_at, published)
values ('ceremonia-de-matcha', 'Ceremonia de Matcha',
        'Una hora de matcha ceremonial y pausa consciente.',
        now() + interval '12 days', now() + interval '12 days 2 hours', true)
on conflict (slug) do nothing;

with u as (select id from auth.users where email = '${EMAIL}'),
     e as (select id from public.events where slug = 'ceremonia-de-matcha')
insert into public.event_bookings (user_id, event_id)
select u.id, e.id from u, e
on conflict do nothing;

${"─".repeat(78)}
LIMPIEZA — borra la cuenta de prueba y todo lo suyo en cascada:
${"─".repeat(78)}

delete from auth.users where email like '%@mailinator.com';
delete from public.events where slug = 'ceremonia-de-matcha';
`);

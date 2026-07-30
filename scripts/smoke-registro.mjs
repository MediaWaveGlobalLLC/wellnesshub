#!/usr/bin/env node
/**
 * Prueba de humo del alta contra el proyecto Supabase real.
 *
 * PGlite ya prueba la LÓGICA del trigger. Esto comprueba lo único que un banco
 * de pruebas local no puede: que el trigger esté instalado y se dispare de
 * verdad en el proyecto, y que RLS deje al usuario ver lo suyo y nada más.
 *
 * Usa solo la clave publicable, como haría el navegador. Sin service_role.
 *
 * Uso: node scripts/smoke-registro.mjs [correo]
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

const email = process.argv[2] ?? `siembra.smoke.${Date.now()}@example.com`;
const password = `Smoke${Date.now()}`;

console.log(`Alta de prueba: ${email}\n`);

const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      first_name: "Prueba",
      last_name: "Fase Dos",
      phone: "+19398350044",
      marketing_email_opt_in: true,
    },
  },
});

if (error) {
  console.error("signUp falló:", error.message);
  process.exit(1);
}

console.log(`✓ Usuario creado: ${data.user?.id}`);

if (!data.session) {
  console.log("\nSin sesión: el proyecto exige confirmar el correo.");
  console.log("Eso es lo correcto para producción y coincide con docs/03");
  console.log("(«no asumir sesión verificada»).");
  console.log("\nPara comprobar las filas creadas por el trigger, mira el Table");
  console.log("Editor de Supabase: profiles, wallets y loyalty_accounts.");
  process.exit(0);
}

// Con sesión activa podemos comprobar el trigger y RLS desde el lado cliente.
const uid = data.user.id;
let fallos = 0;

const { data: perfil } = await supabase
  .from("profiles")
  .select("first_name, last_name, phone, member_id, marketing_email_opt_in")
  .eq("id", uid)
  .single();

if (perfil) {
  console.log(`✓ profiles         → ${perfil.first_name} ${perfil.last_name} · ${perfil.member_id}`);
  if (perfil.marketing_email_opt_in !== true) {
    console.log("  ✗ el opt-in de marketing no se guardó (migración 0002)");
    fallos++;
  }
} else {
  console.log("✗ profiles         → el trigger NO creó el perfil");
  fallos++;
}

const { data: wallet } = await supabase
  .from("wallets")
  .select("balance_cents, currency")
  .eq("user_id", uid)
  .single();
console.log(
  wallet
    ? `✓ wallets          → ${wallet.balance_cents} centavos ${wallet.currency}`
    : "✗ wallets          → no creado"
);
if (!wallet || Number(wallet.balance_cents) !== 0) fallos++;

const { data: lealtad } = await supabase
  .from("loyalty_accounts")
  .select("points_balance, tier")
  .eq("user_id", uid)
  .single();
console.log(
  lealtad
    ? `✓ loyalty_accounts → ${lealtad.points_balance} pts · nivel ${lealtad.tier}`
    : "✗ loyalty_accounts → no creado"
);
if (!lealtad || Number(lealtad.points_balance) !== 0) fallos++;

// RLS: el usuario no debe ver a nadie más.
const { data: todos } = await supabase.from("profiles").select("id");
console.log(
  todos?.length === 1
    ? "✓ RLS              → solo ve su propio perfil"
    : `✗ RLS              → ve ${todos?.length} perfiles`
);
if (todos?.length !== 1) fallos++;

// Tablas que ningún cliente debe alcanzar.
const { data: tarjetas } = await supabase.from("gift_cards").select("id");
console.log(
  !tarjetas || tarjetas.length === 0
    ? "✓ gift_cards       → inalcanzable para el cliente"
    : "✗ gift_cards       → EXPUESTA"
);
if (tarjetas?.length) fallos++;

process.exit(fallos === 0 ? 0 : 1);

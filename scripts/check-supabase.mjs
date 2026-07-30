#!/usr/bin/env node
/**
 * Diagnóstico de la conexión con Supabase.
 *
 * Responde tres preguntas sin exponer ningún secreto:
 *   1. ¿El proyecto responde?
 *   2. ¿Están aplicadas las migraciones (existen las tablas)?
 *   3. ¿RLS bloquea a un cliente anónimo?
 *
 * Uso: node scripts/check-supabase.mjs
 */
import fs from "node:fs";
import path from "node:path";

// Lectura mínima de .env.local — sin dependencias.
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const linea of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  process.exit(1);
}

console.log(`Proyecto: ${url}`);
console.log(`Clave:    ${key.slice(0, 18)}…  (${key.length} caracteres)\n`);

const TABLAS_USUARIO = ["profiles", "wallets", "wallet_transactions", "loyalty_accounts"];
const TABLAS_CERRADAS = ["gift_cards", "audit_logs", "stripe_webhook_events"];

async function sondear(tabla) {
  const res = await fetch(`${url}/rest/v1/${tabla}?select=*&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const cuerpo = await res.text();
  return { status: res.status, cuerpo };
}

let faltantes = 0;
let expuestas = 0;

console.log("Tablas del contrato:");
for (const tabla of [...TABLAS_USUARIO, ...TABLAS_CERRADAS]) {
  const { status, cuerpo } = await sondear(tabla);

  // PGRST205 = la tabla no existe en el esquema expuesto.
  if (cuerpo.includes("PGRST205") || cuerpo.includes("Could not find the table")) {
    console.log(`  ✗ ${tabla.padEnd(24)} NO EXISTE — migración sin aplicar`);
    faltantes++;
    continue;
  }

  if (status === 200) {
    const filas = JSON.parse(cuerpo);
    if (filas.length === 0) {
      console.log(`  ✓ ${tabla.padEnd(24)} existe · RLS devuelve 0 filas a un anónimo`);
    } else {
      console.log(`  ⚠ ${tabla.padEnd(24)} DEVUELVE DATOS A UN ANÓNIMO (${filas.length})`);
      expuestas++;
    }
    continue;
  }

  console.log(`  · ${tabla.padEnd(24)} HTTP ${status} — acceso denegado`);
}

console.log("");
if (faltantes > 0) {
  console.log(`Faltan ${faltantes} tablas. Aplica supabase/migrations/ al proyecto.`);
  process.exit(1);
}
if (expuestas > 0) {
  console.log(`ALERTA: ${expuestas} tablas devuelven datos sin sesión. Revisa RLS.`);
  process.exit(1);
}
console.log("Esquema aplicado y RLS activo desde el exterior.");

#!/usr/bin/env node
/**
 * Captura /perfil autenticado.
 *
 * Inicia sesión por la UI real —el mismo formulario y la misma server action
 * que usa cualquier persona— y fotografía el resultado en desktop y mobile.
 * Las credenciales son las de la cuenta de desarrollo; nunca de producción.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.DEV_EMAIL ?? "siembra.fase2.491609583@mailinator.com";
const PASSWORD = process.env.DEV_PASSWORD ?? "siembra2026dev";

const outDir = path.join(process.cwd(), "evidencia", "fase-3");
fs.mkdirSync(outDir, { recursive: true });

const VISTAS = [
  { etiqueta: "desktop", width: 1440, height: 1000 },
  { etiqueta: "mobile", width: 390, height: 844 },
];

const RUTAS = ["/perfil", "/perfil/favoritos", "/perfil/eventos", "/perfil/pedidos", "/perfil/editar"];

const navegador = await chromium.launch();

for (const vista of VISTAS) {
  const contexto = await navegador.newContext({
    viewport: { width: vista.width, height: vista.height },
    deviceScaleFactor: 2,
  });
  const page = await contexto.newPage();

  // Login por la interfaz real, no inyectando cookies.
  await page.goto(`${BASE}/iniciar-sesion`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await Promise.all([
    page.waitForURL(/\/perfil/, { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);

  for (const ruta of RUTAS) {
    await page.goto(`${BASE}${ruta}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const nombre = ruta.replace(/^\//, "").replace(/\//g, "-") || "perfil";
    const destino = path.join(outDir, `${nombre}-${vista.etiqueta}.png`);
    await page.screenshot({ path: destino, fullPage: true });
    console.log(`✓ evidencia/fase-3/${nombre}-${vista.etiqueta}.png`);
  }

  await contexto.close();
}

await navegador.close();

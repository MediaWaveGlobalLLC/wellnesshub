#!/usr/bin/env node
/**
 * Verificación de la CSP contra un build de producción.
 *
 * Existe porque los siete gates de calidad pasaron en verde mientras la CSP
 * bloqueaba todos los chunks de Next: la página se pintaba y no hidrataba, y
 * ningún formulario respondía. Lint, typecheck, tests y build no ven eso.
 *
 * Comprueba cuatro cosas por página: que no haya violaciones en consola, que no
 * quede contenido invisible, que ninguna petición acabe en error —así apareció
 * que el registro enlazaba a /terminos y /privacidad, que no existían— y —la que
 * de verdad importa— que la aplicación sea interactiva, abriendo el menú móvil,
 * que solo funciona si React hidrató.
 *
 * Uso: node scripts/verify-csp.mjs [baseUrl]
 */
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://localhost:3101";
const RUTAS = ["/", "/menu", "/comunidad", "/gift-cards", "/registro", "/iniciar-sesion"];

const navegador = await chromium.launch();
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await contexto.newPage();

const violaciones = [];
page.on("console", (m) => {
  const t = m.text();
  if (/Content Security Policy|Refused to/i.test(t)) violaciones.push(t.slice(0, 140));
});
page.on("pageerror", (e) => violaciones.push(`ERROR: ${String(e).slice(0, 140)}`));

// Incluye los prefetch de <Link>, que es donde estaban los enlaces rotos.
const rotas = new Set();
page.on("response", (r) => {
  if (r.status() >= 400) rotas.add(`${r.status()} ${r.url().replace(BASE, "")}`);
});

let fallos = 0;

for (const ruta of RUTAS) {
  // `load` y no `networkidle`: este último se cuelga 30 s cuando hay un prefetch
  // fallido, y da un timeout que no dice nada. El listener de arriba lo nombra.
  await page.goto(`${BASE}${ruta}`, { waitUntil: "load" });
  await page.waitForTimeout(1500);

  const estado = await page.evaluate(() => ({
    invisibles: [...document.querySelectorAll("main *")].filter(
      (e) => getComputedStyle(e).opacity === "0"
    ).length,
    scripts: document.querySelectorAll("script[src]").length,
    conNonce: document.querySelectorAll("script[nonce]").length,
  }));

  const ok = estado.invisibles === 0;
  if (!ok) fallos++;
  console.log(
    `${ruta.padEnd(17)} invisibles:${estado.invisibles}  scripts:${estado.scripts}  con-nonce:${estado.conNonce}`
  );
}

// Interactividad real: el menú móvil solo se abre si React hidrató.
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/`, { waitUntil: "load" });
await page.waitForTimeout(1500);
await page.click('button[aria-controls="menu-movil"]');
await page.waitForTimeout(400);
const interactivo = await page.evaluate(() => Boolean(document.querySelector("#menu-movil")));

console.log("");
console.log(`Interactividad (el menú móvil abre): ${interactivo ? "SÍ" : "NO"}`);
if (!interactivo) fallos++;

if (violaciones.length === 0) {
  console.log("Sin violaciones de CSP.");
} else {
  console.log(`VIOLACIONES DE CSP (${violaciones.length}):`);
  violaciones.slice(0, 6).forEach((v) => console.log(`  - ${v}`));
  fallos++;
}

if (rotas.size === 0) {
  console.log("Sin peticiones fallidas.");
} else {
  console.log(`PETICIONES FALLIDAS (${rotas.size}):`);
  [...rotas].slice(0, 10).forEach((r) => console.log(`  - ${r}`));
  fallos++;
}

await navegador.close();
process.exit(fallos === 0 ? 0 : 1);

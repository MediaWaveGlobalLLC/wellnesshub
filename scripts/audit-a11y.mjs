#!/usr/bin/env node
/**
 * Auditoría de accesibilidad WCAG 2.1 AA (docs/06).
 *
 * Inyecta axe-core en cada página de un build de producción. axe-core ya está
 * en el árbol de dependencias, así que no añade nada al stack: se carga desde
 * `node_modules` y se ejecuta dentro de la página.
 *
 * Qué NO cubre, dicho de frente: axe detecta en torno a un tercio de los
 * problemas reales. No juzga si el orden de tabulación tiene sentido, si un
 * texto alternativo describe de verdad la imagen, ni si la página se entiende
 * con un lector de pantalla. Cero incidencias aquí no es lo mismo que
 * accesible.
 *
 * Uso: node scripts/audit-a11y.mjs [baseUrl]
 */
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://localhost:3101";
const AXE = path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js");

const RUTAS = [
  "/",
  "/menu",
  "/comunidad",
  "/gift-cards",
  "/registro",
  "/iniciar-sesion",
  "/recuperar",
  "/terminos",
  "/privacidad",
];

const navegador = await chromium.launch();
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await contexto.newPage();

let total = 0;
const detalle = [];

for (const ruta of RUTAS) {
  await page.goto(`${BASE}${ruta}`, { waitUntil: "load" });
  await page.waitForTimeout(600);
  await page.addScriptTag({ path: AXE });

  const { violations } = await page.evaluate(async () =>
    window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    })
  );

  const cuenta = violations.reduce((n, v) => n + v.nodes.length, 0);
  total += cuenta;
  console.log(`${ruta.padEnd(17)} ${cuenta === 0 ? "sin incidencias" : `${cuenta} incidencias`}`);

  for (const v of violations) {
    detalle.push({
      ruta,
      id: v.id,
      impacto: v.impact,
      descripcion: v.help,
      nodos: v.nodes.slice(0, 3).map((n) => n.html.slice(0, 120)),
    });
  }
}

if (detalle.length > 0) {
  console.log("\nDETALLE:");
  for (const d of detalle) {
    console.log(`\n  [${d.impacto}] ${d.id} — ${d.ruta}`);
    console.log(`  ${d.descripcion}`);
    d.nodos.forEach((n) => console.log(`    · ${n}`));
  }
}

console.log(`\nTotal: ${total} incidencias en ${RUTAS.length} páginas.`);

await navegador.close();
process.exit(total === 0 ? 0 : 1);

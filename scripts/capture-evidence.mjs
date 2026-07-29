#!/usr/bin/env node
/**
 * Captura la evidencia visual de la fase — CLAUDE.md §8 exige capturas desktop y
 * mobile en cada entrega.
 *
 * NO es el gate visual: los baselines de Playwright (tests/visual) se congelan solo
 * tras aprobación humana y deben generarse en el contenedor oficial (docs/07).
 * Esto es únicamente material de revisión.
 *
 * Uso: node scripts/capture-evidence.mjs [baseUrl]
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.argv[2] ?? 'http://localhost:3000';
const fase = process.env.FASE ?? '1';
const outDir = path.join(process.cwd(), 'evidencia', `fase-${fase}`);
fs.mkdirSync(outDir, { recursive: true });

const RUTAS_POR_FASE = {
  1: ['/design-system', '/', '/menu', '/visitanos'],
  2: ['/registro', '/iniciar-sesion', '/recuperar', '/registro/confirmar'],
};
const RUTAS = RUTAS_POR_FASE[fase] ?? RUTAS_POR_FASE[1];
const VIEWPORTS = [
  { label: 'desktop', width: 1440, height: 1000 },
  { label: 'mobile', width: 390, height: 844 },
];

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    reducedMotion: 'reduce',
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  for (const ruta of RUTAS) {
    const nombre = ruta === '/' ? 'home' : ruta.replace(/\//g, '');
    await page.goto(`${baseUrl}${ruta}`, { waitUntil: 'networkidle' });
    // Recorre la página para disparar las animaciones de entrada y que nada
    // quede capturado en opacidad 0.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(500);
    const file = path.join(outDir, `${nombre}-${vp.label}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`✓ ${path.relative(process.cwd(), file)}`);
  }

  await context.close();
}

await browser.close();

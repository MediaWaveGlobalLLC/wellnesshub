#!/usr/bin/env node
/**
 * SIEMBRA — generador de tokens
 *
 * Única fuente de verdad de los VALORES: config/design-tokens.json (archivo protegido
 * por SHA-256, idéntico al Brand Book p3–p4).
 *
 * Este script reescribe el bloque delimitado por SIEMBRA-TOKENS:START/END dentro de
 * src/app/globals.css. Todo lo que está fuera de esos marcadores se conserva intacto.
 *
 * Nomenclatura: los nombres de variable siguen las etiquetas oficiales del Brand Book
 * p3 (Terracota, Avena, Leche, Tea Tree, Light Matcha…), no las claves inglesas del
 * JSON. `CLAUDE.md` §1 asigna la identidad de marca al Brand Book; el JSON aporta los
 * valores. Así el CSS habla el idioma de la marca.
 *
 * Uso:  node scripts/generate-tokens.mjs [--check]
 *       --check  no escribe; sale con 1 si globals.css está desincronizado.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const tokensPath = path.join(root, 'config', 'design-tokens.json');
const cssPath = path.join(root, 'src', 'app', 'globals.css');

const START = '/* SIEMBRA-TOKENS:START';
const END = '/* SIEMBRA-TOKENS:END */';

/** Clave del JSON -> nombre oficial del Brand Book p3. */
const BRAND_COLOR_NAMES = {
  terracotta: 'terracota',
  mustard: 'mustard',
  oat: 'avena',
  milk: 'leche',
  espresso: 'espresso',
  teaTree: 'teatree',
  matcha: 'matcha',
  olive: 'olive',
  lightMatcha: 'lightmatcha',
  forest: 'forest',
};

/** Comentario por color, tomado del uso descrito en docs/01. */
const COLOR_NOTES = {
  terracota: 'Primario — CTAs y bloques de energía',
  mustard: 'Acento cálido — avisos y highlights',
  avena: 'Texto sobre oscuro, fondos suaves',
  leche: 'Fondo base de la marca',
  espresso: 'Texto principal',
  teatree: 'Fondos suaves de sección matcha',
  matcha: 'Acento matcha',
  olive: 'Membresía y acentos verdes',
  lightmatcha: 'Acento verde claro',
  forest: 'Membresía, footer y módulos de balance',
};

const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));

/** Resuelve referencias tipo "{colors.milk}" a su hex literal. */
function resolveRef(value) {
  const match = /^\{colors\.(\w+)\}$/.exec(String(value));
  return match ? tokens.colors[match[1]] : value;
}

function kebab(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

const lines = [];
const push = (line = '') => lines.push(line);

push(`${START} — generado por scripts/generate-tokens.mjs. NO EDITAR A MANO.`);
push(`   Fuente: config/design-tokens.json (Brand Book p3–p4). Regenerar: npm run tokens */`);
push('@theme {');
push('  /* ── Paleta oficial · Brand Book p3 ─────────────────────────────── */');
for (const [key, hex] of Object.entries(tokens.colors)) {
  const name = BRAND_COLOR_NAMES[key] ?? kebab(key);
  push(`  --color-${name}: ${hex}; /* ${COLOR_NOTES[name] ?? ''} */`);
}

push('');
push('  /* ── Roles semánticos ───────────────────────────────────────────── */');
for (const [key, value] of Object.entries(tokens.semantic)) {
  push(`  --color-${kebab(key)}: ${resolveRef(value)};`);
}

push('');
push('  /* ── Tipografía · Brand Book p4 ─────────────────────────────────── */');
/** Entrecomilla familias con espacios, como pide la sintaxis CSS. */
const family = (list) => list.map((f) => (f.includes(' ') ? `"${f}"` : f)).join(', ');
push('  /* The Seasons es de licencia comercial y no viene en el kit. Mientras no exista');
push('     el .woff2, --font-seasons queda sin definir y cae al fallback contractual');
push('     Droid Serif (docs/01), nunca a otra fuente. */');
push(`  --font-display: var(--font-seasons, var(--font-droid)), ${family(tokens.typography.display.slice(1))};`);
push(`  --font-serif: var(--font-droid), ${family(tokens.typography.heading.slice(1))};`);
push(`  --font-sans: var(--font-poppins), ${family(tokens.typography.body.slice(1))};`);
for (const [key, weight] of Object.entries(tokens.typography.weights)) {
  push(`  --font-weight-${key}: ${weight};`);
}

push('');
push('  /* ── Radios · máximo aprobado 24px, normal 16px ─────────────────── */');
for (const [key, value] of Object.entries(tokens.radius)) {
  push(`  --radius-${kebab(key)}: ${value}px;`);
}

push('');
push('  /* ── Layout ─────────────────────────────────────────────────────── */');
push(`  --container-content: ${tokens.layout.contentMax}px;`);

push('');
push('  /* ── Sombras cálidas · docs/01: suaves, nunca glow ──────────────── */');
push('  /* Espresso en canal RGB para poder modular alfa. SIEMBRA-ALLOW-COLOR */');
push('  --shadow-warm: 0 20px 50px -20px rgb(69 32 10 / 0.35); /* SIEMBRA-ALLOW-COLOR */');
push('  --shadow-soft: 0 8px 30px -12px rgb(69 32 10 / 0.2); /* SIEMBRA-ALLOW-COLOR */');
push('  --shadow-card: 0 2px 12px -6px rgb(69 32 10 / 0.16); /* SIEMBRA-ALLOW-COLOR */');

push('');
push('  /* ── Movimiento ─────────────────────────────────────────────────── */');
push(`  --animate-marquee: marquee 36s linear infinite;`);
push(`  --animate-spin-slow: spin 24s linear infinite;`);
push('}');

push('');
push(':root {');
push('  /* Valores fuera de los namespaces de Tailwind v4, expuestos como custom props. */');
push(`  --spacing-unit: ${tokens.spacing.unit}px;`);
push(`  --section-desktop: ${tokens.spacing.sectionDesktop}px;`);
push(`  --section-mobile: ${tokens.spacing.sectionMobile}px;`);
push(`  --gutter-desktop: ${tokens.layout.desktopGutter}px;`);
push(`  --gutter-tablet: ${tokens.layout.tabletGutter}px;`);
push(`  --gutter-mobile: ${tokens.layout.mobileGutter}px;`);
push(`  --control-height: ${tokens.controls.height}px;`);
push(`  --button-min-height: ${tokens.controls.buttonMinHeight}px;`);
push(`  --motion-fast: ${tokens.motion.fastMs}ms;`);
push(`  --motion-normal: ${tokens.motion.normalMs}ms;`);
push(`  --motion-slow: ${tokens.motion.slowMs}ms;`);
push('}');
push(END);

const generated = lines.join('\n');

const css = fs.readFileSync(cssPath, 'utf8');
const startIndex = css.indexOf(START);
const endIndex = css.indexOf(END);

if (startIndex === -1 || endIndex === -1) {
  console.error(
    `Missing ${START} … ${END} markers in src/app/globals.css.\n` +
      'Add them once so the generator knows which block it owns.'
  );
  process.exit(1);
}

const head = css.slice(0, startIndex);
const tail = css.slice(endIndex + END.length);
const next = `${head}${generated}${tail}`;

if (process.argv.includes('--check')) {
  if (next !== css) {
    console.error('globals.css is out of sync with config/design-tokens.json. Run: npm run tokens');
    process.exit(1);
  }
  console.log('SIEMBRA tokens in sync.');
  process.exit(0);
}

fs.writeFileSync(cssPath, next);
console.log(`SIEMBRA tokens written to src/app/globals.css (${Object.keys(tokens.colors).length} colors).`);

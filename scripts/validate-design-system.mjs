#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execSync } from 'node:child_process';

const root = process.cwd();
const tokensPath = path.join(root, 'config', 'design-tokens.json');
if (!fs.existsSync(tokensPath)) {
  console.error('Missing config/design-tokens.json');
  process.exit(1);
}

const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
const tokenText = JSON.stringify(tokens);
const allowedHex = new Set(
  (tokenText.match(/#[0-9a-fA-F]{6}/g) ?? []).map((x) => x.toUpperCase())
);
const scanExt = new Set(['.css', '.scss', '.sass', '.less', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const ignored = new Set([
  'node_modules', '.next', '.git', 'design-references', 'brand-reference',
  'public/brand/originals', 'playwright-report', 'test-results', 'coverage', 'dist', 'build'
]);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (scanExt.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

function changedFiles() {
  const commands = [
    'git diff --name-only --diff-filter=ACMR',
    'git diff --cached --name-only --diff-filter=ACMR',
    'git ls-files --others --exclude-standard',
  ];
  const names = new Set();
  for (const command of commands) {
    try {
      for (const file of execSync(command, { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean)) {
        names.add(path.resolve(root, file));
      }
    } catch {
      // A fresh folder may not be a Git repository yet. Full scan remains available.
    }
  }
  return names;
}

let files = walk(root);
if (process.argv.includes('--changed-only')) {
  const changed = changedFiles();
  if (changed.size > 0) files = files.filter((file) => changed.has(file));
}

const violations = [];
const remoteHostPatterns = tokens.forbidden.remoteImageHosts.map(
  (host) => new RegExp(host.replaceAll('.', '\\.'), 'i')
);
const forbiddenCss = tokens.forbidden.cssFeatures.map(
  (term) => new RegExp(term.replace('-', '[-:]?'), 'i')
);
// DEC-004: anclado con \b. Sin límites de palabra, un nombre de fuente corto coincide
// dentro de palabras normales (CSS y copy en español) y hace el validador inejecutable.
const forbiddenFonts = tokens.forbidden.fontFamilies.map(
  (font) => new RegExp(`\\b${font.replaceAll(' ', '\\s*')}\\b`, 'i')
);
// DEC-004 (endurecimiento): las utilidades de gradiente de Tailwind no contienen la
// cadena CSS literal, así que `forbidden.cssFeatures` nunca las detectaba.
const forbiddenGradientUtilities = /\bbg-(?:gradient|linear|radial|conic)-/;
const forbiddenColors = tokens.forbidden.tailwindColorFamilies.map(
  (family) => new RegExp(`(?:bg|text|border|ring|outline|shadow|fill|stroke|from|to|via)-${family}-`, 'i')
);

for (const file of files) {
  const rel = path.relative(root, file).replaceAll('\\', '/');
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const lineNo = index + 1;
    const foundHex = line.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    for (const rawHex of foundHex) {
      const hex = rawHex.toUpperCase();
      if (hex.length !== 7 || !allowedHex.has(hex)) {
        violations.push(`${rel}:${lineNo} unauthorized color ${rawHex}; use a CSS variable from SIEMBRA tokens`);
      }
    }
    if (/\b(?:rgb|rgba|hsl|hsla|oklch|lab|lch)\s*\(/i.test(line) && !/SIEMBRA-ALLOW-COLOR/.test(line)) {
      violations.push(`${rel}:${lineNo} raw color function; use an approved SIEMBRA CSS variable`);
    }
    for (const rx of remoteHostPatterns) if (rx.test(line)) violations.push(`${rel}:${lineNo} remote/placeholder image host`);
    for (const rx of forbiddenCss) if (rx.test(line)) violations.push(`${rel}:${lineNo} forbidden visual feature`);
    for (const rx of forbiddenFonts) if (rx.test(line)) violations.push(`${rel}:${lineNo} unauthorized font`);
    for (const rx of forbiddenColors) if (rx.test(line)) violations.push(`${rel}:${lineNo} unauthorized Tailwind color family`);
    if (/rounded-(?:3xl|full)/.test(line) && !/avatar|pill|badge|circle|icon/i.test(line)) {
      violations.push(`${rel}:${lineNo} excessive radius outside an approved circular/pill component`);
    }
    if (forbiddenGradientUtilities.test(line)) {
      violations.push(`${rel}:${lineNo} forbidden gradient utility; use a flat SIEMBRA color block`);
    }
    // DEC-004: un `data:` URI es un asset local aunque su SVG declare el namespace del
    // W3C; y el constructor `new URL(...)` de JS no es la función CSS de fondo.
    const referencesAsset = /(?:<img|Image\s|src=)/i.test(line) || /\burl\(/.test(line);
    const isInlineDataUri = /data:image\//i.test(line);
    if (
      /https?:\/\//i.test(line) &&
      referencesAsset &&
      !isInlineDataUri &&
      !/SIEMBRA-ALLOW-REMOTE-ASSET/.test(line)
    ) {
      violations.push(`${rel}:${lineNo} remote visual asset; use local SIEMBRA assets`);
    }
  });
}

const required = [
  'design-references/01-registro-reference.png',
  'design-references/02-perfil-reference.png',
  'design-references/03-wallet-giftcards-reference.png',
  'design-references/04-home-brand-direction-reference.png',
  'brand-reference/Siembra-Brand-Book-Official.pdf',
];
for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) violations.push(`Missing protected reference: ${rel}`);
}

if (violations.length) {
  console.error('\nSIEMBRA DESIGN LOCK FAILED\n');
  for (const violation of violations) console.error(`- ${violation}`);
  console.error('\nUse only approved tokens/assets or document and obtain approval for a design-system change.');
  process.exit(1);
}

console.log(`SIEMBRA design validation passed (${files.length} files scanned).`);

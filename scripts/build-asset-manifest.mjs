#!/usr/bin/env node
/**
 * SIEMBRA — registro de assets de marca
 *
 * docs/11:
 *   · No sobrescribir los originales.
 *   · Crear derivados optimizados en public/brand/optimized/.
 *   · Registrar cada derivado en un manifest generado.
 *
 * Este script SOLO LEE public/brand/originals/ (archivos protegidos por SHA-256) y
 * las fotos oficiales, y SOLO ESCRIBE en public/brand/optimized/ y en el manifest
 * generado. Nunca modifica un original.
 *
 * Además normaliza los nombres a slugs: los archivos oficiales traen espacios,
 * acentos y un "&" que rompen rutas de URL (p. ej. "Siembra Coffee & Matcha.webp").
 *
 * Uso:  node scripts/build-asset-manifest.mjs [--check]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const root = process.cwd();
const brandDir = path.join(root, 'public', 'brand');
const outDir = path.join(brandDir, 'optimized');
const manifestPath = path.join(root, 'src', 'lib', 'brand-assets.generated.ts');

/**
 * Carpetas de entrada.
 *  · `originals` son los PNG protegidos del kit: se derivan a optimized/ y NUNCA
 *    se sirven directamente.
 *  · `fotos` y `logos` ya vienen en webp optimizado desde el branding oficial: se
 *    registran en su sitio, sin duplicarlos.
 */
const SOURCES = [
  { dir: 'originals', group: 'producto', derivar: true },
  { dir: 'fotos', group: 'fotografia', derivar: false },
  { dir: 'logos', group: 'logo', derivar: false },
];

/** Nombre de archivo -> slug estable y legible en URL. */
function slugify(basename) {
  return basename
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' y ')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/** Clave TypeScript válida a partir del slug. */
function toKey(slug) {
  return slug.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

const check = process.argv.includes('--check');
const entries = [];

fs.mkdirSync(outDir, { recursive: true });

for (const { dir, group, derivar } of SOURCES) {
  const full = path.join(brandDir, dir);
  if (!fs.existsSync(full)) continue;

  for (const file of fs.readdirSync(full).sort()) {
    const ext = path.extname(file).toLowerCase();
    if (!['.png', '.webp', '.jpg', '.jpeg'].includes(ext)) continue;

    const slug = slugify(path.basename(file, ext));
    const source = path.join(full, file);

    // Los originales protegidos se derivan; el resto se registra donde ya está.
    const target = derivar ? path.join(outDir, `${slug}.webp`) : source;
    const src = derivar ? `/brand/optimized/${slug}.webp` : `/brand/${dir}/${file}`;

    if (derivar && !check) {
      const stale = !fs.existsSync(target) || fs.statSync(source).mtimeMs > fs.statSync(target).mtimeMs;
      if (stale) {
        await sharp(source)
          .resize({ width: 1600, withoutEnlargement: true })
          .webp({ quality: 82, effort: 5 })
          .toFile(target);
      }
    }

    const meta = fs.existsSync(target) ? await sharp(target).metadata() : { width: 0, height: 0 };
    entries.push({
      key: toKey(slug),
      slug,
      group,
      src,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      origin: `public/brand/${dir}/${file}`,
    });
  }
}

// El logo vectorial oficial se sirve tal cual: no se rasteriza.
const logoSvg = path.join(brandDir, 'logos', 'logo-beige.svg');
if (fs.existsSync(logoSvg)) {
  entries.push({
    key: 'logoVector',
    slug: 'logo-beige',
    group: 'logo',
    src: '/brand/logos/logo-beige.svg',
    width: 0,
    height: 0,
    origin: 'public/brand/logos/logo-beige.svg',
  });
}

const body = `// GENERADO por scripts/build-asset-manifest.mjs — NO EDITAR A MANO.
// Regenerar: npm run assets
//
// Cada entrada es un derivado optimizado. Los originales de public/brand/originals/
// están protegidos por SHA-256 (docs/11) y jamás se sirven directamente.

export type BrandAsset = {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly group: "producto" | "fotografia" | "logo";
  /** Archivo oficial del que deriva. */
  readonly origin: string;
};

export const BRAND_ASSETS = {
${entries
  .map(
    (e) =>
      `  ${e.key}: {\n` +
      `    src: ${JSON.stringify(e.src)},\n` +
      `    width: ${e.width},\n` +
      `    height: ${e.height},\n` +
      `    group: ${JSON.stringify(e.group)},\n` +
      `    origin: ${JSON.stringify(e.origin)},\n` +
      `  },`
  )
  .join('\n')}
} as const satisfies Record<string, BrandAsset>;

export type BrandAssetKey = keyof typeof BRAND_ASSETS;
`;

if (check) {
  const current = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, 'utf8') : '';
  if (current !== body) {
    console.error('Asset manifest out of date. Run: npm run assets');
    process.exit(1);
  }
  console.log('SIEMBRA asset manifest in sync.');
  process.exit(0);
}

fs.writeFileSync(manifestPath, body);
console.log(`SIEMBRA asset manifest written (${entries.length} assets).`);

/**
 * Iconos de aplicación (favicon, icono de pestaña, icono de iOS).
 *
 *   node scripts/build-app-icons.mjs
 *
 * Deriva TODO del logo vectorial oficial `public/brand/logos/logo-beige.svg`.
 * No hay ningún PNG dibujado a mano en el repo: se cambia el logo, se vuelve a
 * ejecutar esto y los iconos salen solos.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ NO SE USA EL LOGO ENTERO
 *
 * `docs/11` dice «no recortar logos», y esto encuadra el sol con el grano —el
 * isotipo— dejando fuera la palabra SIEMBRA. Es una desviación consciente,
 * aprobada por el dueño y documentada en DEC-012, por un motivo medible: el
 * logotipo completo mide 2483 × 1164, o sea 2,13 a 1. Metido en el cuadrado de
 * una pestaña de navegador, «SIEMBRA» ocupa 32 × 15 píxeles y las letras dejan
 * de ser letras. No sería el logo pequeño: sería una mancha.
 *
 * El encuadre NO se escribe a ojo: se mide sobre el propio SVG rasterizado
 * (`medirIsotipo`), así que si el arte cambia, el recorte cambia con él.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ EL DE 16 PÍXELES LLEVA SOLO EL GRANO
 *
 * Los rayos del sol son líneas de menos de un píxel a ese tamaño. No se ven
 * finas: desaparecen y dejan un borrón. El grano es macizo y sí sobrevive, así
 * que a 16 se pinta el grano solo. Un .ico admite arte distinto por tamaño
 * justamente para esto; a 32 y 48 vuelve el sol entero.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOGO = path.join(raiz, "public/brand/logos/logo-beige.svg");
const APP = path.join(raiz, "src/app");

/* Paleta oficial (`config/design-tokens.json`). El logo beige sobre espresso es
   pareja del Brand Book; además el cuadrado macizo se ve igual de bien sobre
   una barra de pestañas clara que sobre una oscura, que es más de lo que puede
   decir un icono con fondo transparente. */
const ESPRESSO = "#45200A";
const OAT = "#FFD89E";
/** El relleno del SVG oficial. Se sustituye para poder pintarlo en otro color. */
const OAT_EN_EL_SVG = /fill:\s*#ffd89e/gi;

const svgOriginal = fs.readFileSync(LOGO, "utf8");

/**
 * El mismo arte, con otro encuadre y —si se pide— otro color. Nada se redibuja.
 *
 * Sin `color` se deja el relleno oficial tal cual. Es lo que usan las medidas,
 * que solo leen el canal alfa: teñir el SVG para medirlo sería meter un color
 * suelto en el repo para nada, y el validador de diseño tendría razón al
 * quejarse.
 */
function reencuadrar({ x, y, w, h }, color) {
  const encuadrado = svgOriginal.replace(/viewBox="[^"]*"/, `viewBox="${x} ${y} ${w} ${h}"`);
  return color ? encuadrado.replace(OAT_EN_EL_SVG, `fill: ${color}`) : encuadrado;
}

/** Mapa de opacidad del SVG rasterizado a `ancho` píxeles. */
async function opacidad(svg, ancho) {
  const { data, info } = await sharp(Buffer.from(svg), { density: 600 })
    .resize({ width: ancho })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  return {
    width,
    height,
    opaco: (x, y) =>
      x >= 0 && y >= 0 && x < width && y < height && data[(y * width + x) * channels + 3] > 20,
  };
}

/**
 * Mide el isotipo (sol + grano) y el grano suelto, en unidades del viewBox.
 *
 * El isotipo es la primera banda de filas con tinta: entre él y la palabra
 * SIEMBRA hay un hueco de filas vacías. El grano es la componente conexa que
 * toca el punto más bajo de la columna central — los rayos no lo tocan, hay un
 * anillo de aire alrededor.
 */
async function medirIsotipo() {
  const completo = await opacidad(svgOriginal, 2483);
  const filaConTinta = [];
  for (let y = 0; y < completo.height; y++) {
    let hay = false;
    for (let x = 0; x < completo.width && !hay; x++) hay = completo.opaco(x, y);
    filaConTinta.push(hay);
  }

  let fin = filaConTinta.indexOf(true);
  if (fin < 0) throw new Error("el logo no tiene tinta: ¿se movió el fichero?");
  const inicio = fin;
  while (fin + 1 < filaConTinta.length && filaConTinta[fin + 1]) fin++;

  let x0 = completo.width;
  let x1 = -1;
  for (let y = inicio; y <= fin; y++) {
    for (let x = 0; x < completo.width; x++) {
      if (!completo.opaco(x, y)) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
    }
  }

  // El viewBox original manda: se lee de ahí en vez de darlo por sabido.
  const vb = svgOriginal.match(/viewBox="([\d.\-\s]+)"/);
  if (!vb) throw new Error("el logo no declara viewBox");
  const [, , anchoVb] = vb[1].trim().split(/\s+/).map(Number);
  const k = anchoVb / completo.width;

  const sol = {
    x: x0 * k,
    y: inicio * k,
    w: (x1 - x0 + 1) * k,
    h: (fin - inicio + 1) * k,
  };

  // Grano: componente conexa desde el punto de tinta más bajo del eje central.
  const soloSol = await opacidad(reencuadrar(sol), 1012);
  const cx = Math.floor(soloSol.width / 2);
  let semilla = null;
  for (let y = soloSol.height - 1; y >= 0 && !semilla; y--) {
    if (soloSol.opaco(cx, y)) semilla = [cx, y];
  }
  if (!semilla) throw new Error("no se encuentra el grano en el eje del sol");

  const visto = new Uint8Array(soloSol.width * soloSol.height);
  const pila = [semilla];
  let gx0 = soloSol.width;
  let gx1 = -1;
  let gy0 = soloSol.height;
  let gy1 = -1;
  while (pila.length) {
    const [x, y] = pila.pop();
    const i = y * soloSol.width + x;
    if (visto[i] || !soloSol.opaco(x, y)) continue;
    visto[i] = 1;
    if (x < gx0) gx0 = x;
    if (x > gx1) gx1 = x;
    if (y < gy0) gy0 = y;
    if (y > gy1) gy1 = y;
    pila.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  const g = sol.w / soloSol.width;
  return {
    sol,
    grano: {
      x: sol.x + gx0 * g,
      y: sol.y + gy0 * g,
      w: (gx1 - gx0 + 1) * g,
      h: (gy1 - gy0 + 1) * g,
    },
  };
}

/** Cuadrado espresso con la marca centrada, en PNG. */
async function cuadrado(lado, encuadre, relleno) {
  const ancho = Math.max(1, Math.round(lado * relleno));
  /* Se rasteriza el vector directamente al tamaño final. Reducir un PNG grande
     emborrona los rayos; el rasterizador vectorial los resuelve mejor. */
  const marca = await sharp(Buffer.from(reencuadrar(encuadre, OAT)), { density: 900 })
    .resize({ width: ancho })
    .png()
    .toBuffer();
  const { height } = await sharp(marca).metadata();

  return sharp({
    create: { width: lado, height: lado, channels: 4, background: ESPRESSO },
  })
    .composite([
      { input: marca, left: Math.round((lado - ancho) / 2), top: Math.round((lado - height) / 2) },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Empaqueta varios PNG en un .ico.
 *
 * El formato es una cabecera de 6 bytes, una entrada de 16 por imagen y luego
 * los datos. PNG dentro de ICO lo entiende cualquier navegador desde Vista; no
 * hace falta escribir mapas de bits DIB a mano.
 */
function empaquetarIco(imagenes) {
  const cabecera = Buffer.alloc(6);
  cabecera.writeUInt16LE(0, 0); // reservado
  cabecera.writeUInt16LE(1, 2); // 1 = icono
  cabecera.writeUInt16LE(imagenes.length, 4);

  let desplazamiento = 6 + imagenes.length * 16;
  const entradas = [];
  for (const { lado, png } of imagenes) {
    const e = Buffer.alloc(16);
    e.writeUInt8(lado >= 256 ? 0 : lado, 0); // 0 significa 256
    e.writeUInt8(lado >= 256 ? 0 : lado, 1);
    e.writeUInt8(0, 2); // paleta
    e.writeUInt8(0, 3); // reservado
    e.writeUInt16LE(1, 4); // planos
    e.writeUInt16LE(32, 6); // bits por píxel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(desplazamiento, 12);
    entradas.push(e);
    desplazamiento += png.length;
  }

  return Buffer.concat([cabecera, ...entradas, ...imagenes.map((i) => i.png)]);
}

function escribir(rel, datos) {
  const destino = path.join(APP, rel);
  fs.writeFileSync(destino, datos);
  const sha = crypto.createHash("sha256").update(datos).digest("hex").slice(0, 12);
  console.log(`  src/app/${rel}  ${String(datos.length).padStart(7)} B  sha ${sha}`);
}

const { sol, grano } = await medirIsotipo();
console.log("isotipo medido sobre el SVG oficial:");
console.log(`  sol   x ${sol.x.toFixed(1)} y ${sol.y.toFixed(1)} ${sol.w.toFixed(1)}×${sol.h.toFixed(1)}`);
console.log(`  grano x ${grano.x.toFixed(1)} y ${grano.y.toFixed(1)} ${grano.w.toFixed(1)}×${grano.h.toFixed(1)}`);
console.log("escribiendo:");

/* 16 px lleva el grano; a partir de 32 cabe el sol entero. El relleno del grano
   es menor porque es una forma maciza: al 90 % parecería un sello, no un icono. */
escribir(
  "favicon.ico",
  empaquetarIco([
    { lado: 16, png: await cuadrado(16, grano, 0.6) },
    { lado: 32, png: await cuadrado(32, sol, 0.9) },
    { lado: 48, png: await cuadrado(48, sol, 0.9) },
  ])
);

// `icon.png` y `apple-icon.png` los enlaza Next solo por estar aquí.
escribir("icon.png", await cuadrado(512, sol, 0.9));
// iOS no respeta la transparencia y recorta las esquinas él mismo: fondo macizo
// y sin redondear nada por nuestra cuenta.
escribir("apple-icon.png", await cuadrado(180, sol, 0.86));

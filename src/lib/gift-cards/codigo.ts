import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Generación y verificación de códigos de gift card — `docs/06`.
 *
 * Reglas que se cumplen aquí:
 *  · al menos 128 bits de entropía criptográfica;
 *  · formato amigable por bloques, para leerlo y copiarlo sin errores;
 *  · en la base solo vive el HMAC-SHA256 con un pepper server-only, nunca el
 *    código completo (`docs/04`, invariante 2);
 *  · `code_last4` es solo para que soporte pueda identificar una tarjeta sin
 *    conocerla.
 *
 * El código en claro existe una sola vez: se devuelve al emitir para enviarlo
 * por correo y no se vuelve a poder derivar desde la base.
 */

/**
 * Alfabeto Crockford base32 sin I, L, O ni U: evita confundir 1/I/L, 0/O y
 * palabras accidentales. 32 símbolos = 5 bits por carácter.
 */
const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const BYTES_ENTROPIA = 16; // 128 bits
const LONGITUD = 26; // ceil(128 / 5)
const TAMANO_BLOQUE = 5;

/** Genera un código nuevo. El valor devuelto no vuelve a estar disponible. */
export function generarCodigo(): { codigo: string; last4: string } {
  const bytes = randomBytes(BYTES_ENTROPIA);

  // BigInt para no perder bits al trocear: 128 bits no caben en un número.
  let valor = 0n;
  for (const b of bytes) valor = (valor << 8n) | BigInt(b);

  let crudo = "";
  for (let i = 0; i < LONGITUD; i++) {
    crudo = ALFABETO[Number(valor & 31n)] + crudo;
    valor >>= 5n;
  }

  const bloques: string[] = [];
  for (let i = 0; i < crudo.length; i += TAMANO_BLOQUE) {
    bloques.push(crudo.slice(i, i + TAMANO_BLOQUE));
  }

  return { codigo: `SMB-${bloques.join("-")}`, last4: crudo.slice(-4) };
}

/**
 * Normaliza lo que escriba la persona: quita guiones, espacios y el prefijo,
 * pasa a mayúsculas y corrige las confusiones típicas del alfabeto.
 *
 * Así "smb-1a2b3 c4d5e…" y "1A2B3C4D5E…" son el mismo código.
 */
export function normalizarCodigo(entrada: string): string {
  // Primero se limpia todo lo que no sea alfanumérico: así el prefijo se detecta
  // igual venga "SMB-…", "smb …" o con espacios sobrantes al principio.
  const limpio = entrada
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0")
    .replace(/U/g, "V");

  /*
    El prefijo se quita SOLO por longitud, nunca porque empiece por "SMB".
    El alfabeto incluye S, M y B, de modo que un código legítimo puede empezar
    justamente por esas tres letras; recortarlas a ciegas lo invalidaría y la
    persona vería "código inválido" con un código bueno en la mano.

    Un código normalizado mide 26; con prefijo, 29.
  */
  if (limpio.length === LONGITUD + 3 && limpio.startsWith("SMB")) {
    return limpio.slice(3);
  }
  return limpio;
}

/** Un código normalizado tiene exactamente 26 símbolos del alfabeto. */
export function pareceCodigoValido(normalizado: string): boolean {
  if (normalizado.length !== LONGITUD) return false;
  for (const c of normalizado) if (!ALFABETO.includes(c)) return false;
  return true;
}

function pepper(): string {
  const valor = process.env.GIFT_CARD_PEPPER;
  if (!valor || valor.length < 32) {
    throw new Error(
      "GIFT_CARD_PEPPER no está configurada o es demasiado corta (mínimo 32 caracteres). " +
        "Ver docs/13_ENVIRONMENT.md. Rotarla invalida los códigos ya emitidos."
    );
  }
  return valor;
}

/**
 * HMAC-SHA256 del código normalizado con el pepper.
 *
 * HMAC y no un hash a secas: sin conocer el pepper no se puede construir una
 * tabla de códigos aunque se filtre la base entera.
 */
export function hashCodigo(codigo: string): string {
  return createHmac("sha256", pepper()).update(normalizarCodigo(codigo)).digest("hex");
}

/** Comparación en tiempo constante, por si el hash llegara desde fuera. */
export function hashesIguales(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function pepperConfigurado(): boolean {
  const valor = process.env.GIFT_CARD_PEPPER;
  return Boolean(valor && valor.length >= 32);
}

/**
 * Presentación de teléfonos.
 *
 * En la base se guardan en E.164 (`+19398350044`) porque es el formato que
 * necesitan los envíos automatizados. Enseñarlo así en un formulario es hostil:
 * nadie escribe su número de esa forma. Se muestra como en la tarjeta oficial
 * —(939) 835-0044— y el schema Zod vuelve a normalizarlo al guardar.
 */
export function formatearTelefono(e164: string | null | undefined): string {
  if (!e164) return "";
  const digitos = e164.replace(/\D/g, "");
  const local = digitos.length === 11 && digitos.startsWith("1") ? digitos.slice(1) : digitos;
  if (local.length !== 10) return e164;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

/**
 * Qué puede hacer cada rol.
 *
 * Una tabla literal, no una cadena de `if`. Así se lee de un vistazo quién
 * puede qué, se prueba entera en un test, y añadir un permiso obliga a decidir
 * explícitamente qué pasa con el empleado en vez de heredar el `else`.
 *
 * ESTO NO ES LA AUTORIZACIÓN. Es lo que decide qué se pinta en pantalla y qué
 * responde un endpoint antes de trabajar. La barrera de verdad está en SQL:
 * `admin_ajustar_wallet` y `admin_ajustar_puntos` exigen rol de dueña dentro de
 * la propia función (`0012_roles_admin.sql`). Si alguien olvidara comprobar
 * aquí, la base de datos seguiría diciendo que no.
 *
 * Sin `server-only`: los componentes de cliente también necesitan saber si
 * pintar un botón. No hay ningún secreto en esta tabla.
 */

export type Rol = "duena" | "empleado";

export type Permiso =
  | "ver_usuarios"
  | "ver_ledger"
  | "ajustar_saldo"
  | "ver_auditoria"
  | "ver_gift_cards"
  | "operar_gift_cards"
  | "ver_negocio"
  | "marcar_agotado"
  | "editar_catalogo"
  | "ver_eventos"
  | "gestionar_eventos"
  | "marcar_asistencia"
  | "ver_newsletter"
  | "gestionar_admins";

const MATRIZ: Record<Permiso, readonly Rol[]> = {
  // El mostrador necesita responder «¿cuánto tengo?» sin llamar a la dueña.
  ver_usuarios: ["duena", "empleado"],
  // Pero el historial de movimientos de una persona es otra cosa: dice dónde y
  // cuándo gasta. No hace falta para atender en barra.
  ver_ledger: ["duena"],
  ajustar_saldo: ["duena"],
  ver_auditoria: ["duena"],
  ver_gift_cards: ["duena"],
  // Anular o cambiar el código de una tarjeta es tocar dinero ya cobrado.
  operar_gift_cards: ["duena"],
  ver_negocio: ["duena"],
  // Lo único que el empleado escribe en la carta: se acabó la mallorca, se apaga.
  marcar_agotado: ["duena", "empleado"],
  editar_catalogo: ["duena"],
  /*
    Los eventos se parten en dos a propósito.

    Programar un taller es decisión de negocio. Pero marcar quién entró por la
    puerta es la tarea de la puerta, con la lista delante: si hay que llamar a
    la dueña para marcar una casilla, la lista no se marca y los estados
    'asistio'/'ausente' vuelven a quedarse sin escribir, que es donde llevaban
    desde 0005.
  */
  ver_eventos: ["duena", "empleado"],
  gestionar_eventos: ["duena"],
  marcar_asistencia: ["duena", "empleado"],
  // Una lista de correos es un fichero de datos personales, no una herramienta
  // de mostrador.
  ver_newsletter: ["duena"],
  gestionar_admins: ["duena"],
};

export function puede(rol: Rol, permiso: Permiso): boolean {
  return MATRIZ[permiso].includes(rol);
}

/** Etiqueta para pantalla. La clave va en ASCII; el acento, aquí. */
export const ETIQUETA_ROL: Record<Rol, string> = {
  duena: "Dueña",
  empleado: "Empleado",
};

export const ROLES: readonly Rol[] = ["duena", "empleado"];

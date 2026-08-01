import "server-only";

import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Servicio de wallet — `docs/03`.
 *
 * Solo LEE. Ninguna ruta de cliente puede mover saldo: los movimientos pasan
 * siempre por `apply_wallet_transaction`, que está revocada para `anon` y
 * `authenticated` y solo la puede ejecutar el servidor con `service_role`
 * (`docs/04`, invariante 5).
 *
 * La lectura usa la sesión del usuario, así que RLS garantiza que nadie vea el
 * saldo ajeno sin que este código tenga que filtrar a mano.
 */

/** Tipos de movimiento del ledger — enum de `0001_siembra_core.sql`. */
export const ETIQUETA_MOVIMIENTO: Record<string, string> = {
  gift_card_redemption: "Canje de gift card",
  purchase: "Compra",
  refund: "Devolución",
  promotion: "Promoción",
  admin_adjustment: "Ajuste de servicio",
  expiration: "Crédito expirado",
  correction: "Corrección",
};

export type MovimientoWallet = {
  id: string;
  amountCents: number;
  balanceAfterCents: number;
  tipo: string;
  etiqueta: string;
  descripcion: string | null;
  fecha: string;
};

export type ResumenWallet = {
  balanceCents: number;
  moneda: string;
  movimientos: MovimientoWallet[];
  /** Hay más páginas por detrás de las devueltas. */
  hayMas: boolean;
  total: number;
};

export const MOVIMIENTOS_POR_PAGINA = 20;

export async function obtenerWallet(
  pagina = 0,
  porPagina = MOVIMIENTOS_POR_PAGINA
): Promise<ResumenWallet | null> {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const desde = pagina * porPagina;

  const [walletRes, movimientosRes] = await Promise.all([
    supabase.from("wallets").select("balance_cents, currency").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("wallet_transactions")
      .select("id, amount_cents, balance_after_cents, transaction_type, description, created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range(desde, desde + porPagina - 1),
  ]);

  // El wallet lo crea el trigger al dar de alta. Si falta, el alta se rompió y
  // es mejor enterarse que mostrar un saldo inventado de cero.
  if (!walletRes.data) return null;

  const total = movimientosRes.count ?? 0;

  return {
    balanceCents: Number(walletRes.data.balance_cents),
    moneda: walletRes.data.currency,
    movimientos: (movimientosRes.data ?? []).map((m) => ({
      id: m.id,
      amountCents: Number(m.amount_cents),
      balanceAfterCents: Number(m.balance_after_cents),
      tipo: m.transaction_type,
      etiqueta: ETIQUETA_MOVIMIENTO[m.transaction_type] ?? "Movimiento",
      descripcion: m.description,
      fecha: m.created_at,
    })),
    hayMas: desde + porPagina < total,
    total,
  };
}

/**
 * ¿Es la primera recarga de esta persona? — `0024_recarga_saldo.sql`.
 *
 * Decide si se le anuncia el café de bienvenida. Solo eso: quién lo recibe de
 * verdad lo decide `confirmar_recarga` dentro de la transacción del pago, con
 * la fila bloqueada. Aquí un resultado desactualizado enseñaría un cartel de
 * más, no regalaría nada.
 *
 * Lee con la sesión del usuario, así que RLS ya limita a sus propias filas.
 */
export async function esPrimeraRecarga(): Promise<boolean> {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { count } = await supabase
    .from("wallet_topups")
    .select("id", { count: "exact", head: true })
    .eq("status", "pagada");

  return (count ?? 0) === 0;
}

"use client";

import { createBrowserClient } from "@supabase/ssr";
import { exigirConfigSupabase } from "./env";

/**
 * Cliente de Supabase para el navegador.
 *
 * Solo usa la clave publicable. Ninguna operación financiera pasa por aquí:
 * wallet, puntos, gift cards y ajustes se ejecutan server-side (docs/06).
 */
export function crearClienteNavegador() {
  const { url, key } = exigirConfigSupabase();
  return createBrowserClient(url, key);
}

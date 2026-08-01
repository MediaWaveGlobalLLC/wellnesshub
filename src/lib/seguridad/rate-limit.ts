import { createHash } from "node:crypto";
import { headers } from "next/headers";

import { crearClienteServidor } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/env";

/**
 * Límite de intentos para los formularios de autenticación (docs/06).
 *
 * El contador vive en Postgres (`0010_rate_limits.sql`) porque la aplicación
 * corre en funciones serverless: un contador en memoria se pierde en cuanto la
 * petición cae en otra instancia, que es tanto como no tener límite.
 *
 * Los umbrales están en la base de datos y no se pasan desde aquí. Ver la
 * migración: dejarlos en manos de quien llama permitiría anularlos.
 */

export type Accion =
  | "login"
  | "registro"
  | "reset"
  | "password"
  | "admin_ajuste"
  | "admin_catalogo"
  | "admin_operaciones"
  | "canje_recompensa"
  | "crear_pedido";

export type Veredicto = { permitido: true } | { permitido: false; reintentarEn: number };

/**
 * IP del cliente.
 *
 * En Vercel llega en `x-forwarded-for`, cuyo primer valor es el cliente real;
 * el resto son los proxies intermedios. Se toma solo el primero.
 */
async function ipCliente(): Promise<string> {
  const h = await headers();
  const reenviada = h.get("x-forwarded-for");
  if (reenviada) return reenviada.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "desconocida";
}

/**
 * Construye la clave del contador.
 *
 * Se hashea antes de guardarla: la tabla necesita distinguir intentos, no saber
 * de quién son. Guardar IPs y correos en claro sería acumular datos personales
 * sin ningún motivo.
 */
function hashear(accion: Accion, identidad: string): string {
  return createHash("sha256").update(`${accion}|${identidad.toLowerCase()}`).digest("hex");
}

/**
 * Cuenta un intento y dice si se permite.
 *
 * Falla ABIERTO: si la base de datos no responde, se deja pasar. Es una decisión
 * consciente — un fallo de infraestructura no debe dejar a todo el mundo sin
 * poder entrar en su cuenta. El coste es que durante una caída no hay límite;
 * frente a bloquear el login entero, se prefiere esto.
 */
export async function limitar(accion: Accion, identidad?: string): Promise<Veredicto> {
  if (!supabaseConfigurado()) return { permitido: true };

  const ip = await ipCliente();
  // El correo entra en la clave cuando lo hay: así un atacante que rota IPs
  // sigue topando con el límite de la cuenta que ataca, y a la vez un local con
  // IP compartida no bloquea a sus vecinos por intentos ajenos.
  const clave = hashear(accion, identidad ? `${ip}|${identidad}` : ip);

  try {
    const supabase = await crearClienteServidor();
    const { data, error } = await supabase
      .rpc("consumir_rate_limit", { p_accion: accion, p_clave_hash: clave })
      .single<{ permitido: boolean; restantes: number; reintentar_en: number }>();

    if (error || !data) {
      console.error("[rate-limit] no se pudo consultar:", error?.message);
      return { permitido: true };
    }

    return data.permitido
      ? { permitido: true }
      : { permitido: false, reintentarEn: data.reintentar_en };
  } catch (e) {
    console.error("[rate-limit] excepción:", e);
    return { permitido: true };
  }
}

/** Minutos redondeados hacia arriba, para el mensaje al usuario. */
export function enMinutos(segundos: number): number {
  return Math.max(1, Math.ceil(segundos / 60));
}

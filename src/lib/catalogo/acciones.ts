"use server";

import { revalidatePath } from "next/cache";

import { crearClienteServicio } from "@/lib/supabase/admin";
import { actorPuede, exigirAdmin, exigirDuena } from "@/lib/services/admin-service";
import { enMinutos, limitar } from "@/lib/seguridad/rate-limit";
import { nuevoRequestId } from "@/lib/api/respuesta";
import {
  archivarSchema,
  crearProductoSchema,
  disponibilidadSchema,
  editarProductoSchema,
  precioSchema,
  reordenarSchema,
} from "@/lib/validation/catalogo";
import { slugDeItem } from "@/lib/menu";

/**
 * Edición del catálogo desde el panel.
 *
 * Son server actions y no endpoints REST porque esto son formularios: siguen el
 * patrón de `src/lib/perfil/acciones.ts` y ahorran el `fetch` a mano.
 *
 * Toda acción hace lo mismo, en este orden:
 *   1. Autoriza (rol correcto).
 *   2. Consume cupo de rate limit.
 *   3. Valida con Zod y devuelve errores por campo.
 *   4. Llama a la función SQL, que vuelve a comprobar el rol y escribe la
 *      auditoría en la misma transacción.
 *   5. Revalida `/menu`.
 *
 * El paso 5 no es opcional: `/menu` es estática con revalidación de 5 minutos
 * (`src/app/menu/page.tsx`). Sin revalidar, alguien cambia un precio, se va a
 * mirar la carta pública y sigue viendo el viejo. Parece que no se guardó.
 */

export type Resultado =
  | { ok: true; mensaje: string }
  | { ok: false; error: string; campos?: Record<string, string[]> };

function deZod(error: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } }): Resultado {
  const { fieldErrors } = error.flatten();
  const campos: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(fieldErrors)) {
    if (v?.length) campos[k] = v;
  }
  return { ok: false, error: "Revisa los campos marcados.", campos };
}

/** Traduce las excepciones de las funciones SQL a algo que se pueda leer. */
function traducir(mensaje: string): string {
  const mapa: [string, string][] = [
    ["no_autorizado", "No tienes permisos para esta operación."],
    ["motivo_obligatorio", "El motivo es obligatorio."],
    ["precio_invalido", "El precio no es válido."],
    ["slug_duplicado", "Ya existe un producto con ese nombre."],
    ["slug_invalido", "El nombre no genera un identificador válido."],
    ["sin_variantes", "Hace falta al menos un precio."],
    ["ultima_variante", "No puedes quitar el último tamaño: el producto se quedaría sin precio."],
    ["producto_no_encontrado", "Ese producto ya no existe."],
    ["variante_no_encontrada", "Ese tamaño ya no existe."],
    ["nombre_obligatorio", "El nombre es obligatorio."],
    ["tipo_invalido", "Tipo de elemento no válido."],
  ];
  for (const [clave, texto] of mapa) {
    if (mensaje.includes(clave)) return texto;
  }
  return "No pudimos guardar el cambio.";
}

/** Refresca la carta pública Y la pantalla de administración. */
function revalidar() {
  revalidatePath("/menu");
  revalidatePath("/admin/catalogo");
}

/**
 * Autorización + cupo, común a todas. `soloDuena` para lo que no toca el
 * mostrador.
 *
 * Unión discriminada por `ok` y no por la presencia de `error`: con `"error" in
 * ctx` TypeScript no estrecha bien y el mensaje acaba siendo `string |
 * undefined` en la rama de fallo.
 */
type Contexto =
  | { ok: true; actor: Awaited<ReturnType<typeof exigirAdmin>> & object; requestId: string }
  | { ok: false; error: string };

async function preparar(soloDuena: boolean): Promise<Contexto> {
  const actor = soloDuena ? await exigirDuena() : await exigirAdmin();
  if (!actor) return { ok: false, error: "No tienes permisos para esta operación." };

  const veredicto = await limitar("admin_catalogo", actor.id);
  if (!veredicto.permitido) {
    return {
      ok: false,
      error: `Demasiados cambios seguidos. Espera ${enMinutos(veredicto.reintentarEn)} minutos.`,
    };
  }

  return { ok: true, actor, requestId: nuevoRequestId() };
}

export async function cambiarPrecio(datos: unknown): Promise<Resultado> {
  const parsed = precioSchema.safeParse(datos);
  if (!parsed.success) return deZod(parsed.error);

  const ctx = await preparar(true);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { error } = await crearClienteServicio().rpc("admin_catalogo_precio", {
    p_actor_id: ctx.actor.id,
    p_variante_id: parsed.data.varianteId,
    p_precio_cents: parsed.data.precioCents,
    p_reason: parsed.data.reason,
    p_request_id: ctx.requestId,
  });

  if (error) return { ok: false, error: traducir(error.message) };

  revalidar();
  return { ok: true, mensaje: "Precio actualizado." };
}

export async function cambiarDisponibilidad(datos: unknown): Promise<Resultado> {
  const parsed = disponibilidadSchema.safeParse(datos);
  if (!parsed.success) return deZod(parsed.error);

  // Lo único que puede escribir el mostrador.
  const ctx = await preparar(false);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  if (!actorPuede(ctx.actor, "marcar_agotado")) {
    return { ok: false, error: "No tienes permisos para esta operación." };
  }

  const { error } = await crearClienteServicio().rpc("admin_catalogo_disponibilidad", {
    p_actor_id: ctx.actor.id,
    p_producto_id: parsed.data.productoId,
    p_disponible: parsed.data.disponible,
    p_reason: parsed.data.reason,
    p_request_id: ctx.requestId,
  });

  if (error) return { ok: false, error: traducir(error.message) };

  revalidar();
  return {
    ok: true,
    mensaje: parsed.data.disponible ? "Vuelve a estar disponible." : "Marcado como agotado.",
  };
}

export async function editarProducto(datos: unknown): Promise<Resultado> {
  const parsed = editarProductoSchema.safeParse(datos);
  if (!parsed.success) return deZod(parsed.error);

  const ctx = await preparar(true);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { error } = await crearClienteServicio().rpc("admin_catalogo_producto_editar", {
    p_actor_id: ctx.actor.id,
    p_producto_id: parsed.data.productoId,
    p_nombre: parsed.data.nombre,
    p_nota_es: parsed.data.nota ?? null,
    p_destacado: parsed.data.destacado,
    p_reason: parsed.data.reason,
    p_request_id: ctx.requestId,
  });

  if (error) return { ok: false, error: traducir(error.message) };

  revalidar();
  return { ok: true, mensaje: "Producto actualizado." };
}

export async function archivarProducto(datos: unknown): Promise<Resultado> {
  const parsed = archivarSchema.safeParse(datos);
  if (!parsed.success) return deZod(parsed.error);

  const ctx = await preparar(true);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { data, error } = await crearClienteServicio().rpc("admin_catalogo_producto_archivar", {
    p_actor_id: ctx.actor.id,
    p_producto_id: parsed.data.productoId,
    p_archivar: parsed.data.archivar,
    p_reason: parsed.data.reason,
    p_request_id: ctx.requestId,
  });

  if (error) return { ok: false, error: traducir(error.message) };

  revalidar();

  // Se dice a cuánta gente afectó. Retirar de la carta algo que veinte personas
  // tienen guardado no es lo mismo que retirar algo que no ha guardado nadie.
  const favoritos = Array.isArray(data) ? Number(data[0]?.favoritos ?? 0) : 0;
  const nota =
    parsed.data.archivar && favoritos > 0
      ? ` ${favoritos} persona${favoritos === 1 ? " lo tenía" : "s lo tenían"} en favoritos.`
      : "";

  return {
    ok: true,
    mensaje: (parsed.data.archivar ? "Retirado de la carta." : "Vuelve a la carta.") + nota,
  };
}

export async function crearProducto(datos: unknown): Promise<Resultado> {
  const parsed = crearProductoSchema.safeParse(datos);
  if (!parsed.success) return deZod(parsed.error);

  const ctx = await preparar(true);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  /*
    El slug se deriva del nombre con la MISMA función que usan los favoritos
    (`slugDeItem`). Es el contrato que bloquea `catalogo-fidelidad.test.ts`: si
    aquí se generara de otra forma, un favorito guardado sobre este producto
    nunca resolvería.
  */
  const slug = slugDeItem(parsed.data.nombre);

  const { error } = await crearClienteServicio().rpc("admin_catalogo_producto_crear", {
    p_actor_id: ctx.actor.id,
    p_categoria_id: parsed.data.categoriaId,
    p_slug: slug,
    p_nombre: parsed.data.nombre,
    p_nota_es: parsed.data.nota ?? null,
    p_destacado: parsed.data.destacado,
    p_variantes: parsed.data.variantes.map((v) => ({
      etiqueta: v.etiqueta ?? null,
      precio_cents: v.precioCents,
    })),
    p_reason: parsed.data.reason,
    p_request_id: ctx.requestId,
  });

  if (error) return { ok: false, error: traducir(error.message) };

  revalidar();
  return { ok: true, mensaje: "Producto creado." };
}

export async function reordenar(datos: unknown): Promise<Resultado> {
  const parsed = reordenarSchema.safeParse(datos);
  if (!parsed.success) return deZod(parsed.error);

  const ctx = await preparar(true);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { error } = await crearClienteServicio().rpc("admin_catalogo_reordenar", {
    p_actor_id: ctx.actor.id,
    p_tipo: parsed.data.tipo,
    p_ids: parsed.data.ids,
    p_reason: parsed.data.reason,
    p_request_id: ctx.requestId,
  });

  if (error) return { ok: false, error: traducir(error.message) };

  revalidar();
  return { ok: true, mensaje: "Orden actualizado." };
}

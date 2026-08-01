"use server";

import { revalidatePath } from "next/cache";

import { crearClienteServidor } from "@/lib/supabase/server";
import { crearClienteServicio, servicioDisponible } from "@/lib/supabase/admin";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { enMinutos, limitar } from "@/lib/seguridad/rate-limit";
import { revisarAvatar, rutaDeAvatar, rutaDesdeUrl } from "./avatar";

/**
 * Foto de perfil.
 *
 * El archivo NO se sube desde el navegador. El bucket `avatares` se creó con
 * lectura pública y **cero políticas de escritura**, así que ni `anon` ni
 * `authenticated` pueden dejar nada dentro: todo pasa por aquí, donde hay
 * sesión comprobada, cupo, tope de tamaño y una revisión de los bytes.
 *
 * La alternativa —subir desde el cliente con su propia sesión— habría exigido
 * políticas sobre `storage.objects`, y una política mal escrita en un bucket
 * público es la diferencia entre «cada cual su carpeta» y «cualquiera escribe
 * en la de cualquiera».
 */

const BUCKET = "avatares";

export type ResultadoAvatar = { ok: true; url: string | null } | { ok: false; error: string };

async function sesion() {
  if (!supabaseConfigurado()) return null;
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

/** Borra el objeto anterior. Si falla no se interrumpe nada: sobra un archivo. */
async function borrarAnterior(
  servicio: ReturnType<typeof crearClienteServicio>,
  urlAnterior: string | null
) {
  const ruta = rutaDesdeUrl(urlAnterior, BUCKET);
  if (!ruta) return;
  const { error } = await servicio.storage.from(BUCKET).remove([ruta]);
  if (error) console.error("[avatar] no se pudo borrar el anterior:", error.message);
}

export async function subirAvatar(formData: FormData): Promise<ResultadoAvatar> {
  const ctx = await sesion();
  if (!ctx) return { ok: false, error: "Inicia sesión para cambiar tu foto." };

  if (!servicioDisponible()) {
    console.error("[avatar] SUPABASE_SERVICE_ROLE_KEY no configurada");
    return { ok: false, error: "No podemos guardar la foto ahora mismo." };
  }

  /*
    Cupo. Cada subida escribe un objeto en el bucket y borra el anterior; sin
    tope, un bucle llena el almacenamiento del proyecto. Se reutiliza el de
    `crear_pedido` por no inventar una regla para algo que se hace una vez.
  */
  const veredicto = await limitar("crear_pedido", ctx.user.id);
  if (!veredicto.permitido) {
    return {
      ok: false,
      error: `Demasiados intentos seguidos. Espera ${enMinutos(veredicto.reintentarEn)} minutos.`,
    };
  }

  const archivo = formData.get("foto");
  if (!(archivo instanceof File)) return { ok: false, error: "No llegó ninguna imagen." };

  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const revision = revisarAvatar(bytes, archivo.type);
  if (!revision.ok) return { ok: false, error: revision.error };

  const servicio = crearClienteServicio();
  const ruta = rutaDeAvatar(ctx.user.id, revision.tipo.extension, crypto.randomUUID());

  const { error: errorSubida } = await servicio.storage.from(BUCKET).upload(ruta, bytes, {
    // El tipo que se sirve es el que decidieron los BYTES, no el que declaró el
    // navegador: así nada se entrega con un `Content-Type` que no le toca.
    contentType: revision.tipo.mime,
    upsert: false,
  });

  if (errorSubida) {
    console.error("[avatar] subida fallida:", errorSubida.message);
    return { ok: false, error: "No pudimos guardar la foto. Inténtalo de nuevo." };
  }

  const { data: publica } = servicio.storage.from(BUCKET).getPublicUrl(ruta);
  const url = publica.publicUrl;

  // Con la sesión de la persona, no con `service_role`: la escritura del perfil
  // sigue pasando por RLS, que es quien impide tocar el de otra.
  const { data: previo } = await ctx.supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", ctx.user.id)
    .maybeSingle();

  const { error } = await ctx.supabase
    .from("profiles")
    .update({ avatar_url: url })
    .eq("id", ctx.user.id);

  if (error) {
    // La fila manda. Si no se pudo apuntar, el archivo recién subido sobra.
    await servicio.storage.from(BUCKET).remove([ruta]);
    return { ok: false, error: "No pudimos guardar la foto. Inténtalo de nuevo." };
  }

  await borrarAnterior(servicio, previo?.avatar_url ?? null);

  revalidatePath("/perfil");
  revalidatePath("/perfil/editar");
  return { ok: true, url };
}

export async function quitarAvatar(): Promise<ResultadoAvatar> {
  const ctx = await sesion();
  if (!ctx) return { ok: false, error: "Inicia sesión para cambiar tu foto." };

  const { data: previo } = await ctx.supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", ctx.user.id)
    .maybeSingle();

  const { error } = await ctx.supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", ctx.user.id);

  if (error) return { ok: false, error: "No pudimos quitar la foto. Inténtalo de nuevo." };

  // Primero la fila, después el archivo: si el borrado del objeto fallara, lo
  // que queda es un archivo huérfano y no una foto que sigue saliendo.
  if (servicioDisponible()) await borrarAnterior(crearClienteServicio(), previo?.avatar_url ?? null);

  revalidatePath("/perfil");
  revalidatePath("/perfil/editar");
  return { ok: true, url: null };
}

"use server";

import { revalidatePath } from "next/cache";

import { crearClienteServicio } from "@/lib/supabase/admin";
import { actorPuede, exigirAdmin, exigirDuena } from "@/lib/services/admin-service";
import { enMinutos, limitar } from "@/lib/seguridad/rate-limit";
import { nuevoRequestId } from "@/lib/api/respuesta";
import { generarCodigo, hashCodigo, pepperConfigurado } from "@/lib/gift-cards/codigo";
import { formatearDolares } from "@/lib/loyalty";
import {
  anularGiftCardSchema,
  aplicarReglaSchema,
  asistenciaSchema,
  borrarEventoSchema,
  concederAdminSchema,
  crearEventoSchema,
  editarEventoSchema,
  editarNivelSchema,
  editarReglaSchema,
  entregarCanjeSchema,
  publicarEventoSchema,
  reactivarGiftCardSchema,
  recargaGiftCardSchema,
  recompensaSchema,
  revocarAdminSchema,
  rotarCodigoSchema,
  slugDeEvento,
} from "@/lib/validation/operaciones";

/**
 * Server actions de las operaciones del panel — `0017_operaciones_admin.sql`.
 *
 * Mismo guion que `src/lib/catalogo/acciones.ts`: autoriza, consume cupo,
 * valida con Zod, llama a la función SQL —que vuelve a comprobar el rol y
 * escribe la auditoría en la misma transacción— y revalida.
 */

export type Resultado =
  | { ok: true; mensaje: string }
  | { ok: false; error: string; campos?: Record<string, string[]> };

/** Como `Resultado`, pero devolviendo el código nuevo UNA vez. */
export type ResultadoCodigo =
  | { ok: true; mensaje: string; codigo: string; last4: string }
  | { ok: false; error: string; campos?: Record<string, string[]> };

function deZod(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
}): { ok: false; error: string; campos: Record<string, string[]> } {
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
    // Gift cards.
    ["tarjeta_no_encontrada", "Esa tarjeta ya no existe."],
    [
      "ya_canjeada",
      "Esa tarjeta ya se canjeó: el dinero está en el saldo de alguien. Si hay que revertirlo, hazlo con un ajuste de saldo.",
    ],
    ["ya_anulada", "Esa tarjeta ya estaba anulada."],
    ["no_estaba_anulada", "Esa tarjeta no está anulada."],
    ["tarjeta_no_activa", "Solo se puede cambiar el código de una tarjeta activa."],
    ["hash_invalido", "El código no se generó correctamente. Vuelve a intentarlo."],
    ["last4_invalido", "El código no se generó correctamente. Vuelve a intentarlo."],
    // Recompensas.
    ["recompensa_no_encontrada", "Esa recompensa ya no existe."],
    ["nombre_obligatorio", "El nombre es obligatorio."],
    ["costo_excesivo", "Una recompensa no puede costar más de 100.000 puntos."],
    ["costo_invalido", "El coste tiene que ser mayor que cero."],
    ["existencias_invalidas", "Las existencias no pueden ser negativas."],
    ["canje_no_encontrado", "Ese canje ya no existe."],
    ["ya_entregada", "Ese canje ya se entregó."],
    ["canje_cancelado", "Ese canje está cancelado."],
    ["tarjeta_anulada", "Esa tarjeta está anulada. Reactívala antes de recargarla."],
    ["tarjeta_caducada", "Esa tarjeta caducó: recargarla no la haría canjeable."],
    ["importe_excesivo", "Una sola recarga no puede superar $5.000."],
    ["importe_invalido", "El importe tiene que ser mayor que cero."],
    // Eventos.
    ["evento_no_encontrado", "Ese evento ya no existe."],
    ["slug_duplicado", "Ya hay un evento con ese título."],
    ["slug_invalido", "El título no genera una dirección válida."],
    ["titulo_obligatorio", "El título es obligatorio."],
    ["fecha_obligatoria", "La fecha de inicio es obligatoria."],
    ["fin_antes_del_inicio", "El evento no puede terminar antes de empezar."],
    ["aforo_invalido", "El aforo tiene que ser mayor que cero."],
    ["aforo_menor_que_reservas", "No puedes bajar el aforo por debajo de las plazas ya reservadas."],
    ["evento_con_reservas", "Ese evento tiene gente apuntada. Despublícalo en vez de borrarlo."],
    ["reserva_no_encontrada", "Esa reserva ya no existe."],
    ["reserva_cancelada", "Esa persona canceló su plaza. Vuelve a confirmársela antes de marcarla."],
    ["estado_invalido", "Estado de asistencia no válido."],
    // Equipo.
    ["usuario_no_encontrado", "No hay ninguna cuenta con ese correo."],
    ["rol_invalido", "Rol no válido."],
    ["no_puedes_revocarte", "No puedes quitarte a ti misma el acceso."],
    ["no_era_admin", "Esa persona ya no está en el equipo."],
    [
      "ultima_duena",
      "No puedes dejar el negocio sin ninguna dueña: nadie podría volver a entrar al panel.",
    ],
    // Lealtad.
    ["regla_no_encontrada", "Esa regla ya no existe."],
    ["regla_inactiva", "Esa regla está desactivada."],
    [
      "regla_no_manual",
      "Esa regla no se da a mano: o la aplica el sistema sola, o todavía no se puede aplicar.",
    ],
    ["nivel_no_encontrado", "Ese nivel ya no existe."],
    ["puntos_invalidos", "Los puntos tienen que estar entre 1 y 100.000."],
    ["minimo_invalido", "El mínimo no puede ser negativo."],
    ["etiqueta_obligatoria", "El nombre es obligatorio."],
    [
      "umbrales_desordenados",
      "Cada nivel tiene que pedir más puntos que el anterior. Con este cambio quedarían cruzados y el nivel de todo el mundo se calcularía mal.",
    ],
    [
      "primer_nivel_no_empieza_en_cero",
      "El primer nivel tiene que empezar en 0: si no, quien tenga pocos puntos se quedaría sin ningún nivel.",
    ],
  ];
  for (const [clave, texto] of mapa) {
    if (mensaje.includes(clave)) return texto;
  }
  return "No pudimos guardar el cambio.";
}

type Contexto =
  | { ok: true; actor: NonNullable<Awaited<ReturnType<typeof exigirAdmin>>>; requestId: string }
  | { ok: false; error: string };

async function preparar(soloDuena: boolean): Promise<Contexto> {
  const actor = soloDuena ? await exigirDuena() : await exigirAdmin();
  if (!actor) return { ok: false, error: "No tienes permisos para esta operación." };

  const veredicto = await limitar("admin_operaciones", actor.id);
  if (!veredicto.permitido) {
    return {
      ok: false,
      error: `Demasiadas operaciones seguidas. Espera ${enMinutos(veredicto.reintentarEn)} minutos.`,
    };
  }

  return { ok: true, actor, requestId: nuevoRequestId() };
}

/* ── Gift cards ──────────────────────────────────────────────────────────── */

export async function anularGiftCard(datos: unknown): Promise<Resultado> {
  const parsed = anularGiftCardSchema.safeParse(datos);
  if (!parsed.success) return deZod(parsed.error);

  const ctx = await preparar(true);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { error } = await crearClienteServicio().rpc("admin_gift_card_anular", {
    p_actor_id: ctx.actor.id,
    p_gift_card_id: parsed.data.giftCardId,
    p_reason: parsed.data.reason,
    p_request_id: ctx.requestId,
  });

  if (error) return { ok: false, error: traducir(error.message) };

  revalidatePath("/admin/gift-cards");
  return { ok: true, mensaje: "Tarjeta anulada. El código deja de funcionar." };
}

export async function reactivarGiftCard(datos: unknown): Promise<Resultado> {
  const parsed = reactivarGiftCardSchema.safeParse(datos);
  if (!parsed.success) return deZod(parsed.error);

  const ctx = await preparar(true);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { error } = await crearClienteServicio().rpc("admin_gift_card_reactivar", {
    p_actor_id: ctx.actor.id,
    p_gift_card_id: parsed.data.giftCardId,
    p_reason: parsed.data.reason,
    p_request_id: ctx.requestId,
  });

  if (error) return { ok: false, error: traducir(error.message) };

  revalidatePath("/admin/gift-cards");
  return { ok: true, mensaje: "Tarjeta reactivada. Su código vuelve a servir." };
}

/**
 * Genera un código nuevo para una tarjeta y lo devuelve UNA vez.
 *
 * El código en claro existe durante esta función y en la respuesta que va a la
 * pantalla. No se guarda en la base —solo su HMAC—, no se escribe en la
 * auditoría y no se registra en ningún log. Si se cierra la ventana sin
 * copiarlo, no hay forma de recuperarlo: hay que rotarlo otra vez.
 *
 * Es incómodo a propósito. La alternativa —guardar el código para poder
 * enseñarlo luego— convertiría la base de datos en una lista de códigos
 * canjeables, que es justo lo que `docs/04` prohíbe.
 */
export async function rotarCodigoGiftCard(datos: unknown): Promise<ResultadoCodigo> {
  const parsed = rotarCodigoSchema.safeParse(datos);
  if (!parsed.success) return deZod(parsed.error);

  if (!pepperConfigurado()) {
    return {
      ok: false,
      error:
        "Falta GIFT_CARD_PEPPER en el servidor. Sin ella no se puede generar un código nuevo.",
    };
  }

  const ctx = await preparar(true);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { codigo, last4 } = generarCodigo();

  const { error } = await crearClienteServicio().rpc("admin_gift_card_rotar_codigo", {
    p_actor_id: ctx.actor.id,
    p_gift_card_id: parsed.data.giftCardId,
    p_code_hash: hashCodigo(codigo),
    p_code_last4: last4,
    p_reason: parsed.data.reason,
    p_request_id: ctx.requestId,
  });

  if (error) return { ok: false, error: traducir(error.message) };

  revalidatePath("/admin/gift-cards");
  return {
    ok: true,
    mensaje: "Código nuevo generado. El anterior ya no sirve.",
    codigo,
    last4,
  };
}

/**
 * Añade saldo a una tarjeta.
 *
 * Crea crédito sin ningún cobro detrás, así que va por el mismo carril que un
 * ajuste de wallet: solo la dueña, motivo obligatorio y tope por operación. La
 * función SQL vuelve a comprobar las tres cosas.
 *
 * Sobre una agotada, la revive: el código de siempre vuelve a servir.
 */
export async function recargarGiftCard(datos: unknown): Promise<Resultado> {
  const parsed = recargaGiftCardSchema.safeParse(datos);
  if (!parsed.success) return deZod(parsed.error);

  const ctx = await preparar(true);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { data, error } = await crearClienteServicio().rpc("admin_gift_card_recargar", {
    p_actor_id: ctx.actor.id,
    p_gift_card_id: parsed.data.giftCardId,
    p_amount_cents: parsed.data.amountCents,
    p_reason: parsed.data.reason,
    p_request_id: ctx.requestId,
  });

  if (error) return { ok: false, error: traducir(error.message) };

  revalidatePath("/admin/gift-cards");

  const fila = Array.isArray(data) ? data[0] : null;
  const saldo = Number(fila?.saldo_cents ?? 0);

  return {
    ok: true,
    mensaje: `Recargada. La tarjeta tiene ahora ${formatearDolares(saldo)} y su código vuelve a servir.`,
  };
}

/* ── Recompensas ─────────────────────────────────────────────────────────── */

/**
 * Alta y edición del catálogo de recompensas.
 *
 * Poner precio a un premio es configurar el programa de lealtad, así que es de
 * dueña, igual que editar las reglas y los niveles. La función SQL lo vuelve a
 * comprobar.
 */
export async function guardarRecompensa(datos: unknown): Promise<Resultado> {
  const parsed = recompensaSchema.safeParse(datos);
  if (!parsed.success) return deZod(parsed.error);

  const ctx = await preparar(true);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { error } = await crearClienteServicio().rpc("admin_recompensa_guardar", {
    p_actor_id: ctx.actor.id,
    p_reward_id: parsed.data.rewardId ?? null,
    p_nombre: parsed.data.nombre,
    p_descripcion: parsed.data.descripcion,
    p_costo_puntos: parsed.data.costoPuntos,
    p_imagen_clave: parsed.data.imagenClave,
    p_existencias: parsed.data.existencias,
    p_orden: parsed.data.orden,
    p_activa: parsed.data.activa,
    p_reason: parsed.data.reason,
    p_request_id: ctx.requestId,
  });

  if (error) return { ok: false, error: traducir(error.message) };

  revalidatePath("/admin/recompensas");
  // Lo que ve el cliente cambia en el momento.
  revalidatePath("/puntos");

  return {
    ok: true,
    mensaje: parsed.data.rewardId ? "Recompensa actualizada." : "Recompensa creada.",
  };
}

/**
 * Entregar en mostrador.
 *
 * Lo hace quien está delante de la persona, así que el empleado también puede.
 * No devuelve puntos: entregar solo cierra el canje. Revertir uno es un ajuste
 * de puntos aparte, con su propio motivo.
 */
export async function entregarCanje(datos: unknown): Promise<Resultado> {
  const parsed = entregarCanjeSchema.safeParse(datos);
  if (!parsed.success) return deZod(parsed.error);

  const ctx = await preparar(false);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  if (!actorPuede(ctx.actor, "entregar_recompensa")) {
    return { ok: false, error: "No tienes permisos para esta operación." };
  }

  const { error } = await crearClienteServicio().rpc("admin_recompensa_entregar", {
    p_actor_id: ctx.actor.id,
    p_redemption_id: parsed.data.redemptionId,
    p_request_id: ctx.requestId,
  });

  if (error) return { ok: false, error: traducir(error.message) };

  revalidatePath("/admin/recompensas");
  return { ok: true, mensaje: "Entregada." };
}

/* ── Eventos ─────────────────────────────────────────────────────────────── */

export async function crearEvento(datos: unknown): Promise<Resultado> {
  const parsed = crearEventoSchema.safeParse(datos);
  if (!parsed.success) return deZod(parsed.error);

  const ctx = await preparar(true);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const slug = slugDeEvento(parsed.data.titulo);
  if (!slug) {
    return { ok: false, error: "Ese título no genera una dirección válida. Usa letras o números." };
  }

  const { error } = await crearClienteServicio().rpc("admin_evento_crear", {
    p_actor_id: ctx.actor.id,
    p_slug: slug,
    p_titulo: parsed.data.titulo,
    p_descripcion: parsed.data.descripcion ?? null,
    p_inicia_at: parsed.data.iniciaAt,
    p_termina_at: parsed.data.terminaAt,
    p_lugar: parsed.data.lugar ?? null,
    p_aforo: parsed.data.aforo,
    p_publicado: parsed.data.publicado,
    p_reason: parsed.data.reason,
    p_request_id: ctx.requestId,
  });

  if (error) return { ok: false, error: traducir(error.message) };

  revalidarEventos();
  return {
    ok: true,
    mensaje: parsed.data.publicado ? "Evento creado y publicado." : "Evento creado como borrador.",
  };
}

export async function editarEvento(datos: unknown): Promise<Resultado> {
  const parsed = editarEventoSchema.safeParse(datos);
  if (!parsed.success) return deZod(parsed.error);

  const ctx = await preparar(true);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { error } = await crearClienteServicio().rpc("admin_evento_editar", {
    p_actor_id: ctx.actor.id,
    p_evento_id: parsed.data.eventoId,
    p_titulo: parsed.data.titulo,
    p_descripcion: parsed.data.descripcion ?? null,
    p_inicia_at: parsed.data.iniciaAt,
    p_termina_at: parsed.data.terminaAt,
    p_lugar: parsed.data.lugar ?? null,
    p_aforo: parsed.data.aforo,
    p_reason: parsed.data.reason,
    p_request_id: ctx.requestId,
  });

  if (error) return { ok: false, error: traducir(error.message) };

  revalidarEventos();
  return { ok: true, mensaje: "Evento actualizado." };
}

export async function publicarEvento(datos: unknown): Promise<Resultado> {
  const parsed = publicarEventoSchema.safeParse(datos);
  if (!parsed.success) return deZod(parsed.error);

  const ctx = await preparar(true);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { data, error } = await crearClienteServicio().rpc("admin_evento_publicar", {
    p_actor_id: ctx.actor.id,
    p_evento_id: parsed.data.eventoId,
    p_publicado: parsed.data.publicado,
    p_reason: parsed.data.reason,
    p_request_id: ctx.requestId,
  });

  if (error) return { ok: false, error: traducir(error.message) };

  revalidarEventos();

  // Al despublicar se dice a cuánta gente afecta: las reservas siguen ahí, pero
  // esas personas dejan de ver el evento en su perfil.
  const reservas = Array.isArray(data) ? Number(data[0]?.reservas ?? 0) : 0;
  const nota =
    !parsed.data.publicado && reservas > 0
      ? ` ${reservas} persona${reservas === 1 ? " tenía" : "s tenían"} plaza reservada.`
      : "";

  return {
    ok: true,
    mensaje: (parsed.data.publicado ? "Evento publicado." : "Evento fuera de la web.") + nota,
  };
}

export async function borrarEvento(datos: unknown): Promise<Resultado> {
  const parsed = borrarEventoSchema.safeParse(datos);
  if (!parsed.success) return deZod(parsed.error);

  const ctx = await preparar(true);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { error } = await crearClienteServicio().rpc("admin_evento_borrar", {
    p_actor_id: ctx.actor.id,
    p_evento_id: parsed.data.eventoId,
    p_reason: parsed.data.reason,
    p_request_id: ctx.requestId,
  });

  if (error) return { ok: false, error: traducir(error.message) };

  revalidarEventos();
  return { ok: true, mensaje: "Evento borrado." };
}

/** Marcar asistencia. Lo puede hacer el mostrador: es la tarea de la puerta. */
export async function marcarAsistencia(datos: unknown): Promise<Resultado> {
  const parsed = asistenciaSchema.safeParse(datos);
  if (!parsed.success) return deZod(parsed.error);

  const ctx = await preparar(false);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  if (!actorPuede(ctx.actor, "marcar_asistencia")) {
    return { ok: false, error: "No tienes permisos para esta operación." };
  }

  const { error } = await crearClienteServicio().rpc("admin_evento_asistencia", {
    p_actor_id: ctx.actor.id,
    p_reserva_id: parsed.data.reservaId,
    p_estado: parsed.data.estado,
    p_request_id: ctx.requestId,
  });

  if (error) return { ok: false, error: traducir(error.message) };

  revalidatePath("/admin/eventos", "layout");
  const dicho = {
    asistio: "Marcada como asistió.",
    ausente: "Marcada como ausente.",
    confirmada: "Vuelve a estar solo confirmada.",
  } as const;
  return { ok: true, mensaje: dicho[parsed.data.estado] };
}

/**
 * `/comunidad` y `/perfil/eventos` leen la tabla directamente, así que
 * publicar o cambiar la fecha de un evento tiene que refrescar las dos. Sin
 * esto, alguien publica un taller, va a mirar la web y sigue sin verlo.
 */
function revalidarEventos() {
  revalidatePath("/admin/eventos", "layout");
  revalidatePath("/comunidad");
  revalidatePath("/perfil/eventos");
}

/* ── Administradoras ─────────────────────────────────────────────────────── */

export async function concederAdmin(datos: unknown): Promise<Resultado> {
  const parsed = concederAdminSchema.safeParse(datos);
  if (!parsed.success) return deZod(parsed.error);

  const ctx = await preparar(true);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const servicio = crearClienteServicio();

  /*
    Se busca por correo en `profiles` porque `admin_users.user_id` apunta a
    `auth.users`: solo se puede nombrar a alguien que YA tiene cuenta en la web.
    No se crea la cuenta desde aquí, y decirlo así evita la pregunta obvia.
  */
  const { data: encontrada, error: errorBusqueda } = await servicio.rpc(
    "admin_buscar_para_conceder",
    { p_email: parsed.data.email }
  );

  if (errorBusqueda) return { ok: false, error: "No pudimos buscar esa cuenta." };

  const persona = (Array.isArray(encontrada) ? encontrada[0] : encontrada) as
    | { user_id: string; nombre: string; rol_actual: string | null }
    | undefined;

  if (!persona) {
    return {
      ok: false,
      error: "No hay ninguna cuenta con ese correo. La persona tiene que registrarse primero.",
      campos: { email: ["Sin cuenta en SIEMBRA."] },
    };
  }

  const { error } = await servicio.rpc("admin_conceder", {
    p_actor_id: ctx.actor.id,
    p_target_id: persona.user_id,
    p_rol: parsed.data.rol,
    p_nota: parsed.data.nota ?? null,
    p_request_id: ctx.requestId,
  });

  if (error) return { ok: false, error: traducir(error.message) };

  revalidatePath("/admin/equipo");
  const etiqueta = parsed.data.rol === "duena" ? "dueña" : "empleado";
  return {
    ok: true,
    mensaje: persona.rol_actual
      ? `${persona.nombre} pasa a ${etiqueta}.`
      : `${persona.nombre} entra al equipo como ${etiqueta}.`,
  };
}

/* ── Lealtad ─────────────────────────────────────────────────────────────── */

export async function editarRegla(datos: unknown): Promise<Resultado> {
  const parsed = editarReglaSchema.safeParse(datos);
  if (!parsed.success) return deZod(parsed.error);

  const ctx = await preparar(true);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { error } = await crearClienteServicio().rpc("admin_lealtad_regla_editar", {
    p_actor_id: ctx.actor.id,
    p_clave: parsed.data.clave,
    p_puntos: parsed.data.puntos,
    p_etiqueta: parsed.data.etiqueta,
    p_activa: parsed.data.activa,
    p_reason: parsed.data.reason,
    p_request_id: ctx.requestId,
  });

  if (error) return { ok: false, error: traducir(error.message) };

  revalidarLealtad();
  return { ok: true, mensaje: "Regla actualizada." };
}

export async function editarNivel(datos: unknown): Promise<Resultado> {
  const parsed = editarNivelSchema.safeParse(datos);
  if (!parsed.success) return deZod(parsed.error);

  const ctx = await preparar(true);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { error } = await crearClienteServicio().rpc("admin_lealtad_nivel_editar", {
    p_actor_id: ctx.actor.id,
    p_clave: parsed.data.clave,
    p_etiqueta: parsed.data.etiqueta,
    p_minimo: parsed.data.minimo,
    p_descripcion: parsed.data.descripcion ?? null,
    p_reason: parsed.data.reason,
    p_request_id: ctx.requestId,
  });

  if (error) return { ok: false, error: traducir(error.message) };

  revalidarLealtad();
  return {
    ok: true,
    mensaje: "Nivel actualizado. El nivel de cada persona se recalcula solo, sin tocar sus puntos.",
  };
}

/**
 * Dar los puntos de una regla manual a alguien. Lo puede hacer el mostrador.
 *
 * No admite ni importe ni motivo: los pone la regla. Un empleado no puede
 * regalar mil puntos porque no hay ningún campo donde escribir mil.
 */
export async function aplicarRegla(datos: unknown): Promise<Resultado> {
  const parsed = aplicarReglaSchema.safeParse(datos);
  if (!parsed.success) return deZod(parsed.error);

  const ctx = await preparar(false);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  if (!actorPuede(ctx.actor, "aplicar_regla")) {
    return { ok: false, error: "No tienes permisos para esta operación." };
  }

  const { data, error } = await crearClienteServicio().rpc("admin_aplicar_regla_lealtad", {
    p_actor_id: ctx.actor.id,
    p_target_id: parsed.data.userId,
    p_clave: parsed.data.clave,
    p_request_id: ctx.requestId,
  });

  if (error) return { ok: false, error: traducir(error.message) };

  revalidatePath(`/admin/usuarios/${parsed.data.userId}`);

  const fila = Array.isArray(data) ? data[0] : null;
  const puntos = Number(fila?.puntos ?? 0);
  const saldo = Number(fila?.nuevo_saldo ?? 0);

  return { ok: true, mensaje: `+${puntos} puntos. Ahora tiene ${saldo}.` };
}

/**
 * `/perfil` pinta el nivel y el progreso desde `loyalty_tiers`, así que cambiar
 * un umbral tiene que refrescarlo. Sin esto, la dueña baja el mínimo de Brote,
 * va a mirar un perfil y sigue viendo el nivel viejo.
 */
function revalidarLealtad() {
  revalidatePath("/admin/lealtad");
  revalidatePath("/perfil");
}

export async function revocarAdmin(datos: unknown): Promise<Resultado> {
  const parsed = revocarAdminSchema.safeParse(datos);
  if (!parsed.success) return deZod(parsed.error);

  const ctx = await preparar(true);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { error } = await crearClienteServicio().rpc("admin_revocar", {
    p_actor_id: ctx.actor.id,
    p_target_id: parsed.data.userId,
    p_reason: parsed.data.reason,
    p_request_id: ctx.requestId,
  });

  if (error) return { ok: false, error: traducir(error.message) };

  revalidatePath("/admin/equipo");
  return { ok: true, mensaje: "Acceso retirado." };
}

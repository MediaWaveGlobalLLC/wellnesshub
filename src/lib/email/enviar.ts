import "server-only";

import { Resend } from "resend";
import { formatearDolares } from "@/lib/loyalty";

/**
 * Correos transaccionales — Resend.
 *
 * El código completo de la gift card viaja aquí y en ningún otro sitio: no se
 * guarda en claro ni se escribe en logs (`docs/06`). Si el envío falla, se
 * registra el fallo sin el código.
 */
function resend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

function remitente(): string {
  return process.env.RESEND_FROM_EMAIL ?? "SIEMBRA <hola@siembra.test>";
}

export function emailConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

/** Escapa para HTML: el mensaje personal lo escribe una persona (`docs/06`). */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function enviarGiftCard(datos: {
  para: string;
  nombre: string;
  mensaje: string | null;
  codigo: string;
  centavos: number;
}): Promise<{ ok: boolean; motivo?: string }> {
  const cliente = resend();
  if (!cliente) {
    // No es un error del usuario: la tarjeta existe igual y soporte puede
    // reenviarla. Se deja constancia sin filtrar el código.
    console.warn("RESEND_API_KEY sin configurar: gift card emitida pero no enviada por correo.");
    return { ok: false, motivo: "email_no_configurado" };
  }

  const html = `
    <div style="font-family:Georgia,serif;background:#F4ECE3;padding:32px;color:#45200A">
      <div style="max-width:520px;margin:0 auto;background:#FFF9F2;border:1px solid #DFD0C2;border-radius:16px;padding:32px">
        <p style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#6D523F;margin:0">
          SIEMBRA · Wellness Hub
        </p>
        <h1 style="font-size:28px;margin:16px 0 8px">Tienes una gift card</h1>
        <p style="margin:0 0 24px;line-height:1.6">
          Hola ${escapar(datos.nombre)}, te regalaron
          <strong>${formatearDolares(datos.centavos)}</strong> para disfrutar en SIEMBRA.
        </p>
        ${
          datos.mensaje
            ? `<blockquote style="margin:0 0 24px;padding:16px;background:#F8EFE5;border-left:3px solid #CB3700;font-style:italic">${escapar(
                datos.mensaje
              )}</blockquote>`
            : ""
        }
        <div style="background:#0E3117;color:#FFD89E;border-radius:12px;padding:24px;text-align:center">
          <p style="margin:0 0 8px;font-size:11px;letter-spacing:.14em;text-transform:uppercase">Tu código</p>
          <p style="margin:0;font-size:20px;letter-spacing:.08em;font-family:monospace">${datos.codigo}</p>
        </div>
        <p style="margin:24px 0 0;line-height:1.6;font-size:14px;color:#6D523F">
          Canjéalo desde tu cuenta y el saldo entra directo a tus créditos.
          No tiene fecha de vencimiento.
        </p>
      </div>
    </div>`;

  try {
    const { error } = await cliente.emails.send({
      from: remitente(),
      to: datos.para,
      subject: "Tienes una gift card de SIEMBRA",
      html,
    });
    if (error) {
      console.error("Resend rechazó el envío:", error.message);
      return { ok: false, motivo: "envio_rechazado" };
    }
    return { ok: true };
  } catch (causa) {
    // Nunca se registra el código en el log de errores.
    console.error("fallo enviando gift card:", causa instanceof Error ? causa.message : causa);
    return { ok: false, motivo: "excepcion" };
  }
}

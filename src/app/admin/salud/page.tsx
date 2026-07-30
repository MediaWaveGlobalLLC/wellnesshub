import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Alert, Badge, Card } from "@/components/ui/Surface";
import { Celda, Fila, Tabla } from "@/components/admin/ui/Tabla";
import { TarjetaMetrica } from "@/components/admin/TarjetaMetrica";
import { actorPuede, exigirDuena } from "@/lib/services/admin-service";
import { obtenerSalud, webhooksRecientes } from "@/lib/services/lealtad-admin";
import { formatearPuntos } from "@/lib/loyalty";
import { BellIcon, CardIcon, LockIcon, QrIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Salud · Administración",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function fecha(iso: string | null): string {
  if (!iso) return "nunca";
  return new Intl.DateTimeFormat("es-PR", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Puerto_Rico",
  }).format(new Date(iso));
}

const TONO_WEBHOOK: Record<string, "exito" | "aviso" | "peligro" | "neutro"> = {
  processed: "exito",
  processing: "aviso",
  failed: "peligro",
  ignored: "neutro",
};

/**
 * /admin/salud — las tres tablas que se llenaban solas y no miraba nadie.
 *
 * `stripe_webhook_events`, `gift_card_redeem_attempts` y `rate_limit_hits` se
 * escriben desde las Fases 2 y 5 y no se leían desde ninguna pantalla. La
 * pregunta que responde esto no es «cuántas filas hay» sino «¿hay algo roto
 * ahora mismo?».
 */
export default async function SaludPage() {
  const actor = await exigirDuena();
  if (!actor) notFound();
  if (!actorPuede(actor, "ver_salud")) notFound();

  const [s, webhooks] = await Promise.all([obtenerSalud(), webhooksRecientes(20)]);

  const hayProblema =
    s.webhooksFallidos > 0 || s.webhooksProcesando > 0 || s.canjesPersonasAtascadas > 0;

  return (
    <>
      <div>
        <h1 className="font-display text-2xl text-espresso">Salud</h1>
        <p className="mt-1 text-sm text-text-muted">
          Si algo está roto, sale aquí. Si esta pantalla está en cero, no hay nada que hacer.
        </p>
      </div>

      {hayProblema ? (
        <Alert tono="error" titulo="Hay algo que mirar">
          <ul className="space-y-1">
            {s.webhooksFallidos > 0 && (
              <li>
                <strong>{s.webhooksFallidos} aviso{s.webhooksFallidos === 1 ? "" : "s"} de pago sin
                procesar.</strong>{" "}
                Cada uno puede ser una gift card cobrada y no entregada: dinero cobrado sin producto.
                Compruébalo en Stripe y emite la tarjeta a mano si hace falta.
              </li>
            )}
            {s.webhooksProcesando > 0 && (
              <li>
                <strong>{s.webhooksProcesando} se quedó a medias.</strong> Lleva más de cinco minutos
                sin cerrarse; normalmente significa que el servidor se cortó durante la entrega.
              </li>
            )}
            {s.canjesPersonasAtascadas > 0 && (
              <li>
                <strong>
                  {s.canjesPersonasAtascadas} persona{s.canjesPersonasAtascadas === 1 ? "" : "s"} no
                  consigue{s.canjesPersonasAtascadas === 1 ? "" : "n"} canjear su gift card.
                </strong>{" "}
                Tres intentos o más en una semana sin acertar ninguno. Suele ser un código mal
                copiado; desde Gift cards puedes generarle uno nuevo.
              </li>
            )}
          </ul>
        </Alert>
      ) : (
        <Alert titulo="Todo en orden">
          <p>
            Ningún aviso de pago pendiente, nadie atascado canjeando y nadie bloqueado en el acceso.
          </p>
        </Alert>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaMetrica
          etiqueta="Avisos de pago"
          valor={formatearPuntos(s.webhooksTotal)}
          nota={`${s.webhooksFallidos} fallidos en total, ${s.webhooksFallidos7d} en la última semana. Último: ${fecha(s.webhookUltimo)}.`}
          icono={<CardIcon size={18} />}
        />

        <TarjetaMetrica
          etiqueta="Tiempo de proceso"
          valor={s.webhookLatenciaMediaMs === 0 ? "—" : `${formatearPuntos(s.webhookLatenciaMediaMs)} ms`}
          nota="Lo que tarda la web en emitir la tarjeta desde que Stripe confirma el pago. Media de los últimos 30 días."
          icono={<BellIcon size={18} />}
        />

        <TarjetaMetrica
          etiqueta="Canjes fallidos"
          valor={formatearPuntos(s.canjesFallidos)}
          nota={`${s.canjesFallidos7d} en la última semana, sobre ${formatearPuntos(s.canjesIntentos)} intentos. Un fallo suelto es teclear mal.`}
          icono={<QrIcon size={18} />}
        />

        <TarjetaMetrica
          etiqueta="Bloqueados ahora"
          valor={formatearPuntos(s.bloqueosActivos)}
          nota={
            s.bloqueosActivos === 0
              ? "Nadie está bloqueado por intentarlo demasiadas veces."
              : `${s.bloqueosLoginActivos} en el inicio de sesión. Se desbloquean solos al acabar su ventana; no hay que hacer nada.`
          }
          icono={<LockIcon size={18} />}
        />
      </div>

      <Card className="mt-5 p-5 sm:p-6">
        <h2 className="font-display text-xl text-espresso">Últimos avisos de Stripe</h2>
        <p className="mt-1 text-sm leading-relaxed text-text-muted">
          Lo fallido primero: si hay un error entre cien entregas buenas, es lo único que hay que
          mirar. Cada línea es un aviso de que alguien pagó.
        </p>

        <div className="mt-5">
          {webhooks.length === 0 ? (
            <p className="text-sm text-text-muted">
              Todavía no ha llegado ninguno. Llegarán con la primera gift card que se pague.
            </p>
          ) : (
            <Tabla
              descripcion="Avisos de pago recibidos de Stripe"
              columnas={[
                { clave: "evento", titulo: "Evento" },
                { clave: "tipo", titulo: "Tipo", secundaria: true },
                { clave: "cuando", titulo: "Cuándo", secundaria: true },
                { clave: "estado", titulo: "Estado", numerica: true },
              ]}
            >
              {webhooks.map((w) => (
                <Fila key={w.eventoId}>
                  <Celda principal>
                    <span className="font-mono text-xs">{w.eventoId}</span>
                    {w.error && (
                      <span className="block text-xs font-normal text-danger">{w.error}</span>
                    )}
                  </Celda>
                  <Celda secundaria>{w.tipo}</Celda>
                  <Celda secundaria>{fecha(w.creadoAt)}</Celda>
                  <Celda numerica>
                    <Badge tono={TONO_WEBHOOK[w.estado] ?? "neutro"}>{w.estado}</Badge>
                  </Celda>
                </Fila>
              ))}
            </Tabla>
          )}
        </div>
      </Card>

      <Card tono="avena" className="mt-5 p-5">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-espresso">
          De dónde sale esto
        </p>
        <p className="mt-2 text-sm leading-relaxed text-espresso/80">
          De tres tablas que el sistema llena solo desde hace meses y que hasta ahora no se leían en
          ninguna pantalla: los avisos de pago de Stripe, los intentos de canje de gift cards y los
          bloqueos por demasiados intentos. La auditoría lleva {formatearPuntos(s.auditoriaEntradas)}{" "}
          entrada{s.auditoriaEntradas === 1 ? "" : "s"}; la última, {fecha(s.auditoriaUltima)}.
        </p>
      </Card>
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge, Card } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { CheckIcon, LapizIcon } from "@/components/icons";
import {
  anularGiftCard,
  reactivarGiftCard,
  recargarGiftCard,
  rotarCodigoGiftCard,
  type Resultado,
  type ResultadoCodigo,
} from "@/lib/admin/acciones";
import { formatearDolares } from "@/lib/loyalty";

/**
 * Un pedido de gift card, con lo que se puede hacerle.
 *
 * Las cuatro acciones son de las que no se deshacen solas, así que las cuatro
 * piden motivo escrito y ninguna se dispara con un solo clic.
 */

type Accion = "anular" | "reactivar" | "rotar" | "recargar";

export type Tarjeta = {
  id: string | null;
  pedidoId: string;
  estadoPedido: string;
  estadoTarjeta: string | null;
  /** Lo que se emitió y se cobró. No cambia nunca. */
  centavos: number;
  /** Lo que queda por gastar. `null` si el pedido no llegó a emitir tarjeta. */
  saldoCents: number | null;
  formato: string;
  destinatario: string;
  correoDestinatario: string | null;
  compradorEmail: string | null;
  last4: string | null;
  creado: string;
  pagado: string | null;
  canjeadoAt: string | null;
};

const TONO_PEDIDO: Record<string, "exito" | "aviso" | "peligro" | "neutro"> = {
  paid: "exito",
  pending: "aviso",
  failed: "peligro",
  cancelled: "peligro",
  refunded: "neutro",
};

const TONO_TARJETA: Record<string, "exito" | "aviso" | "peligro" | "neutro"> = {
  active: "exito",
  redeemed: "neutro",
  cancelled: "peligro",
  expired: "peligro",
};

const NOMBRE_TARJETA: Record<string, string> = {
  active: "Activa",
  // Desde 0019 una tarjeta se gasta por partes: 'redeemed' es quedarse sin
  // saldo, no haberla usado una vez.
  redeemed: "Sin saldo",
  cancelled: "Anulada",
  expired: "Caducada",
};

const NOMBRE_PEDIDO: Record<string, string> = {
  paid: "Pagado",
  pending: "Sin pagar",
  failed: "Pago fallido",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

function fecha(iso: string): string {
  return new Intl.DateTimeFormat("es-PR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Puerto_Rico",
  }).format(new Date(iso));
}

export function FilaTarjeta({ tarjeta, puedeOperar }: { tarjeta: Tarjeta; puedeOperar: boolean }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [abierto, setAbierto] = useState<Accion | null>(null);
  const [aviso, setAviso] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);
  /* El código nuevo vive AQUÍ y en ningún otro sitio. Ver el aviso de abajo. */
  const [codigoNuevo, setCodigoNuevo] = useState<{ codigo: string; last4: string } | null>(null);

  function ejecutar(fn: () => Promise<Resultado | ResultadoCodigo>) {
    setAviso(null);
    iniciar(async () => {
      const r = await fn();
      if (r.ok) {
        setAviso({ tono: "ok", texto: r.mensaje });
        setAbierto(null);
        if ("codigo" in r) setCodigoNuevo({ codigo: r.codigo, last4: r.last4 });
        router.refresh();
      } else {
        setAviso({ tono: "error", texto: r.error });
      }
    });
  }

  const activa = tarjeta.estadoTarjeta === "active";
  const anulada = tarjeta.estadoTarjeta === "cancelled";
  const agotada = tarjeta.estadoTarjeta === "redeemed";
  const caducada = tarjeta.estadoTarjeta === "expired";
  const hayTarjeta = tarjeta.id !== null;
  // Recargar una anulada daría saldo a un código que no sirve, y una caducada
  // no se canjea aunque tenga dinero. En ambos casos hay un paso previo.
  const puedeRecargar = activa || agotada;
  // Emitida por $50 y con $30 dentro: el importe de arriba ya no cuenta la
  // historia completa.
  const gastada = tarjeta.saldoCents !== null && tarjeta.saldoCents !== tarjeta.centavos;

  return (
    <li>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-display text-lg text-espresso">
              {formatearDolares(tarjeta.centavos)}
              <span className="ml-3 text-sm font-normal text-text-muted">
                {tarjeta.formato === "digital" ? "Digital" : "Física"}
              </span>
            </p>
            {gastada && (
              <p className="mt-0.5 text-sm text-espresso">
                Saldo <strong>{formatearDolares(tarjeta.saldoCents!)}</strong>
                <span className="text-text-muted">
                  {" "}
                  · emitida por {formatearDolares(tarjeta.centavos)}
                </span>
              </p>
            )}
            <p className="mt-1 text-sm text-text-muted">
              Para {tarjeta.destinatario}
              {tarjeta.correoDestinatario ? ` · ${tarjeta.correoDestinatario}` : ""}
            </p>
            {tarjeta.compradorEmail && (
              <p className="mt-0.5 text-xs text-text-muted">Compró {tarjeta.compradorEmail}</p>
            )}
            <p className="mt-1 text-xs text-text-muted">
              Creado {fecha(tarjeta.creado)}
              {tarjeta.pagado ? ` · Pagado ${fecha(tarjeta.pagado)}` : ""}
              {tarjeta.canjeadoAt ? ` · Canjeado ${fecha(tarjeta.canjeadoAt)}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Badge tono={TONO_PEDIDO[tarjeta.estadoPedido] ?? "neutro"}>
              {NOMBRE_PEDIDO[tarjeta.estadoPedido] ?? tarjeta.estadoPedido}
            </Badge>
            {tarjeta.estadoTarjeta && (
              <Badge tono={TONO_TARJETA[tarjeta.estadoTarjeta] ?? "neutro"}>
                {NOMBRE_TARJETA[tarjeta.estadoTarjeta] ?? tarjeta.estadoTarjeta}
              </Badge>
            )}
            {tarjeta.last4 && (
              <span className="font-display text-sm text-text-muted">····{tarjeta.last4}</span>
            )}
          </div>
        </div>

        {puedeOperar && hayTarjeta && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
            {activa && (
              <>
                <Button
                  type="button"
                  size="md"
                  variant="secundario"
                  onClick={() => setAbierto(abierto === "rotar" ? null : "rotar")}
                  aria-expanded={abierto === "rotar"}
                >
                  <LapizIcon size={14} />
                  Código nuevo
                </Button>
                <Button
                  type="button"
                  size="md"
                  variant="terciario"
                  onClick={() => setAbierto(abierto === "anular" ? null : "anular")}
                  aria-expanded={abierto === "anular"}
                >
                  Anular
                </Button>
              </>
            )}

            {puedeRecargar && (
              <Button
                type="button"
                size="md"
                variant="secundario"
                onClick={() => setAbierto(abierto === "recargar" ? null : "recargar")}
                aria-expanded={abierto === "recargar"}
              >
                Recargar
              </Button>
            )}

            {anulada && (
              <Button
                type="button"
                size="md"
                variant="forest"
                onClick={() => setAbierto(abierto === "reactivar" ? null : "reactivar")}
                aria-expanded={abierto === "reactivar"}
              >
                Reactivar
              </Button>
            )}

            {agotada && (
              <p className="text-xs leading-relaxed text-text-muted">
                Se gastó entera: lo que tenía está en el saldo de quien la usó. Recargarla la
                devuelve a la vida con el mismo código. Para revertir un canje, en cambio, se
                ajusta el saldo desde la ficha de esa persona, no desde aquí.
              </p>
            )}

            {caducada && (
              <p className="text-xs leading-relaxed text-text-muted">
                Caducó. Recargarla no la haría canjeable.
              </p>
            )}
          </div>
        )}

        {abierto && (
          <FormularioMotivo
            accion={abierto}
            pendiente={pendiente}
            onCancelar={() => setAbierto(null)}
            onEnviar={(reason, importeCents) =>
              ejecutar(() => {
                const datos = { giftCardId: tarjeta.id!, reason };
                if (abierto === "anular") return anularGiftCard(datos);
                if (abierto === "reactivar") return reactivarGiftCard(datos);
                if (abierto === "recargar")
                  return recargarGiftCard({ ...datos, amountCents: importeCents });
                return rotarCodigoGiftCard(datos);
              })
            }
          />
        )}

        {codigoNuevo && (
          <CodigoUnaVez
            codigo={codigoNuevo.codigo}
            onCerrar={() => setCodigoNuevo(null)}
          />
        )}

        {aviso && (
          <p
            role={aviso.tono === "error" ? "alert" : "status"}
            className={`mt-2 flex items-start gap-1.5 text-xs ${aviso.tono === "error" ? "text-danger" : "text-olive"}`}
          >
            {aviso.tono === "ok" && <CheckIcon size={14} />}
            {aviso.texto}
          </p>
        )}
      </Card>
    </li>
  );
}

const TITULO: Record<Accion, string> = {
  anular: "¿Por qué se anula?",
  reactivar: "¿Por qué se reactiva?",
  rotar: "¿Por qué hace falta un código nuevo?",
  recargar: "¿Por qué se recarga?",
};

const BOTON: Record<Accion, string> = {
  anular: "Anular tarjeta",
  reactivar: "Reactivar",
  rotar: "Generar código",
  recargar: "Recargar",
};

/**
 * Motivo obligatorio para todas; importe solo para la recarga.
 *
 * El importe se valida aquí para poder señalar el campo, en la server action
 * con Zod y otra vez en SQL. Lo de aquí es cortesía; lo de SQL es lo que de
 * verdad no se puede saltar.
 */
function FormularioMotivo({
  accion,
  pendiente,
  onEnviar,
  onCancelar,
}: {
  accion: Accion;
  pendiente: boolean;
  onEnviar: (reason: string, importeCents: number) => void;
  onCancelar: () => void;
}) {
  const [errorImporte, setErrorImporte] = useState<string | null>(null);
  const esRecarga = accion === "recargar";

  function enviar(fd: FormData) {
    setErrorImporte(null);

    let centavos = 0;
    if (esRecarga) {
      const escrito = String(fd.get("importe") ?? "").trim();
      const dolares = Number(escrito.replace(",", "."));
      if (!escrito || !Number.isFinite(dolares) || dolares <= 0) {
        setErrorImporte("Escribe cuánto saldo añadir.");
        return;
      }
      centavos = Math.round(dolares * 100);
    }

    onEnviar(String(fd.get("motivo") ?? ""), centavos);
  }

  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-3 rounded-lg bg-surface-muted p-3"
      action={enviar}
    >
      {esRecarga && (
        <div className="w-40">
          <Field
            label="Cuánto añadir"
            name="importe"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="25.00"
            error={errorImporte ?? undefined}
          />
        </div>
      )}
      <div className="min-w-[16rem] flex-1">
        <Field
          label={TITULO[accion]}
          name="motivo"
          required
          minLength={6}
          placeholder="Queda en la auditoría"
        />
      </div>
      <Button type="submit" size="md" cargando={pendiente}>
        {BOTON[accion]}
      </Button>
      <Button type="button" size="md" variant="terciario" onClick={onCancelar}>
        Cancelar
      </Button>
    </form>
  );
}

/**
 * El código nuevo, una sola vez.
 *
 * No está guardado en ninguna parte: en la base solo vive su HMAC, y la
 * auditoría registra los últimos cuatro. Si se cierra esto sin copiarlo, la
 * única salida es generar otro.
 *
 * Es incómodo a propósito. Guardarlo para poder volver a enseñarlo convertiría
 * la base de datos en una lista de códigos canjeables.
 */
function CodigoUnaVez({ codigo, onCerrar }: { codigo: string; onCerrar: () => void }) {
  return (
    <div
      role="status"
      className="mt-3 border-l-2 border-terracota bg-surface-muted p-4"
    >
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-terracota">
        Cópialo ahora
      </p>
      <p className="mt-2 break-all font-display text-xl tracking-wide text-espresso">{codigo}</p>
      <p className="mt-2 text-xs leading-relaxed text-text-muted">
        Este código <strong>no se puede volver a ver</strong>. No se guarda en ninguna parte: en la
        base solo queda su huella. Si lo pierdes, hay que generar otro y el de ahora dejará de
        servir.
      </p>
      <div className="mt-3">
        <Button type="button" size="md" variant="terciario" onClick={onCerrar}>
          Ya lo copié
        </Button>
      </div>
    </div>
  );
}

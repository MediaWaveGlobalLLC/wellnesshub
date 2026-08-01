"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge, Card } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/states";
import { CheckIcon } from "@/components/icons";
import { avanzarPedido, type Resultado } from "@/lib/admin/acciones";
import { formatearDolares } from "@/lib/loyalty";
import type { PedidoEnCola } from "@/lib/services/operaciones";

/**
 * La cola del mostrador.
 *
 * Un pedido pagado entra como «Pagado», se marca «Preparando» cuando alguien lo
 * empieza y «Entregado» cuando sale por la barra. Solo hacia delante.
 */

const TONO: Record<PedidoEnCola["estado"], "exito" | "aviso"> = {
  pagado: "aviso",
  preparando: "exito",
};

const NOMBRE: Record<PedidoEnCola["estado"], string> = {
  pagado: "Pagado",
  preparando: "Preparando",
};

const METODO: Record<string, string> = {
  wallet: "saldo",
  stripe: "tarjeta",
};

function hora(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("es-PR", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Puerto_Rico",
  }).format(new Date(iso));
}

export function ColaPedidos({ pedidos }: { pedidos: PedidoEnCola[] }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);

  function ejecutar(fn: () => Promise<Resultado>) {
    setAviso(null);
    iniciar(async () => {
      const r = await fn();
      if (r.ok) {
        setAviso({ tono: "ok", texto: r.mensaje });
        router.refresh();
      } else {
        setAviso({ tono: "error", texto: r.error });
      }
    });
  }

  return (
    <>
      {aviso && (
        <p
          role={aviso.tono === "error" ? "alert" : "status"}
          className={`mt-5 flex items-start gap-1.5 text-sm ${
            aviso.tono === "error" ? "text-danger" : "text-olive"
          }`}
        >
          {aviso.tono === "ok" && <CheckIcon size={15} />}
          {aviso.texto}
        </p>
      )}

      {pedidos.length === 0 ? (
        <Card className="mt-6 p-8">
          <EmptyState
            titulo="Nada en cola"
            descripcion="Cuando alguien pague un pedido desde la web, aparecerá aquí con su número y lo que lleva."
          />
        </Card>
      ) : (
        <ul className="mt-6 space-y-3">
          {pedidos.map((p) => (
            <li key={p.id}>
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-display text-xl text-espresso">
                      {p.numero}
                      <span className="ml-3 text-sm font-normal text-text-muted">
                        {formatearDolares(p.totalCents)}
                        {p.metodoPago && ` · ${METODO[p.metodoPago] ?? p.metodoPago}`}
                        {p.pagado && ` · ${hora(p.pagado)}`}
                      </span>
                    </p>

                    {p.lineas && (
                      <p className="mt-1.5 leading-snug text-espresso">{p.lineas}</p>
                    )}

                    <p className="mt-1 text-sm text-text-muted">
                      {p.persona ?? p.email ?? "Sin nombre"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Badge tono={TONO[p.estado]}>{NOMBRE[p.estado]}</Badge>

                    {p.estado === "pagado" && (
                      <Button
                        type="button"
                        size="md"
                        variant="secundario"
                        cargando={pendiente}
                        onClick={() =>
                          ejecutar(() => avanzarPedido({ orderId: p.id, estado: "preparando" }))
                        }
                      >
                        Preparando
                      </Button>
                    )}

                    <Button
                      type="button"
                      size="md"
                      variant="forest"
                      cargando={pendiente}
                      onClick={() =>
                        ejecutar(() => avanzarPedido({ orderId: p.id, estado: "entregado" }))
                      }
                    >
                      Entregado
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

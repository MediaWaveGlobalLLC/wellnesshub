import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card, Badge, Alert } from "@/components/ui/Surface";
import { EmptyState } from "@/components/states";
import { exigirDuena } from "@/lib/services/admin-service";
import { listarPedidos } from "@/lib/services/admin-consultas";
import { formatearDolares } from "@/lib/loyalty";

export const metadata: Metadata = {
  title: "Gift cards · Administración",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

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

/** /admin/gift-cards — pedidos y estados (`docs/00`). */
export default async function AdminGiftCardsPage() {
  // Los pedidos llevan nombre y correo de quien recibe el regalo: es sección de
  // dueña, no de mostrador.
  if (!(await exigirDuena())) notFound();

  const pedidos = await listarPedidos();

  return (
    <>
      <Alert titulo="Sobre los códigos">
        <p>
          El código completo de una gift card <strong>no se puede recuperar</strong>: en la base
          solo vive su hash. Se muestran los últimos cuatro para identificarla al hablar con la
          persona.
        </p>
        {/*
          Este párrafo decía que se puede «anular la tarjeta y emitir otra». No
          se puede: esa función no existe todavía. Prometer en la interfaz algo
          que el sistema no hace es peor que no decir nada, porque alguien se lo
          promete a un cliente. Llega en una fase posterior.
        */}
        <p className="mt-2">
          Todavía <strong>no se puede anular ni reemitir</strong> una tarjeta desde aquí. Si alguien
          perdió su código, hoy hay que resolverlo por Stripe.
        </p>
      </Alert>

      {pedidos.length === 0 ? (
        <Card className="mt-6 p-8">
          <EmptyState
            titulo="Todavía no hay pedidos"
            descripcion="Aquí aparecerán las compras de gift cards en cuanto se realicen."
          />
        </Card>
      ) : (
        <ul className="mt-6 space-y-3">
          {pedidos.map((p) => (
            <li key={p.id}>
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-display text-lg text-espresso">
                      {formatearDolares(p.centavos)}
                      <span className="ml-3 text-sm font-normal text-text-muted">
                        {p.formato === "digital" ? "Digital" : "Física"}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-text-muted">
                      Para {p.destinatario}
                      {p.correoDestinatario ? ` · ${p.correoDestinatario}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      Creado {fecha(p.creado)}
                      {p.pagado ? ` · Pagado ${fecha(p.pagado)}` : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Badge tono={TONO_PEDIDO[p.estado] ?? "neutro"}>{p.estado}</Badge>
                    {p.estadoTarjeta && (
                      <Badge tono={TONO_TARJETA[p.estadoTarjeta] ?? "neutro"}>
                        {p.estadoTarjeta}
                      </Badge>
                    )}
                    {p.last4 && (
                      <span className="font-display text-sm text-text-muted">····{p.last4}</span>
                    )}
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

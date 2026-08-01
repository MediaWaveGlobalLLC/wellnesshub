import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Alert } from "@/components/ui/Surface";
import { ColaPedidos } from "@/components/admin/pedidos/ColaPedidos";
import { actorPuede, exigirAdmin } from "@/lib/services/admin-service";
import { listarColaPedidos } from "@/lib/services/operaciones";

export const metadata: Metadata = {
  title: "Pedidos · Administración",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * /admin/pedidos — la cola de la barra.
 *
 * Solo lo pagado y sin entregar, lo más viejo primero: es el orden en el que la
 * gente pidió. Lo que ya se entregó vive en el historial de cada persona, no
 * aquí; esta pantalla es para trabajar, no para consultar.
 */
export default async function PedidosPage() {
  const actor = await exigirAdmin();
  if (!actor) notFound();
  if (!actorPuede(actor, "despachar_pedidos")) notFound();

  const pedidos = await listarColaPedidos();

  return (
    <>
      <div>
        <h1 className="font-display text-2xl text-espresso">Pedidos</h1>
        <p className="mt-1 text-sm text-text-muted">
          Lo pagado y sin entregar. El más antiguo primero.
        </p>
      </div>

      <Alert titulo="Solo aparece lo que ya está cobrado">
        <p>
          Un pedido sin pagar no entra aquí. Da igual si se abandonó a medias o si el pago se
          quedó en el aire: hasta que el cobro no está confirmado, no hay nada que preparar.
        </p>
        <p className="mt-2">
          Los estados solo avanzan. Si algo sale mal después de entregar, se arregla con un ajuste
          de saldo o de puntos desde la ficha de esa persona — un movimiento nuevo y con su motivo,
          nunca borrando el anterior.
        </p>
      </Alert>

      <ColaPedidos pedidos={pedidos} />
    </>
  );
}

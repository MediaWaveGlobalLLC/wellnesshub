import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Alert } from "@/components/ui/Surface";
import { PanelEquipo } from "@/components/admin/equipo/PanelEquipo";
import { actorPuede, exigirDuena } from "@/lib/services/admin-service";
import { listarAdmins } from "@/lib/services/operaciones";

export const metadata: Metadata = {
  title: "Equipo · Administración",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** /admin/equipo — quién entra al panel y con qué rol. */
export default async function EquipoPage() {
  const actor = await exigirDuena();
  if (!actor) notFound();
  if (!actorPuede(actor, "gestionar_admins")) notFound();

  const admins = await listarAdmins();

  return (
    <>
      <div>
        <h1 className="font-display text-2xl text-espresso">Equipo</h1>
        <p className="mt-1 text-sm text-text-muted">
          Quién puede entrar aquí. Dar y quitar acceso queda auditado.
        </p>
      </div>

      <Alert titulo="Qué puede hacer cada rol">
        <p>
          <strong>Dueña</strong>: todo. Ajustar saldos y puntos, cambiar precios, programar eventos,
          operar gift cards, ver la lista de correo, la auditoría y este mismo panel.
        </p>
        <p className="mt-2">
          <strong>Empleado</strong>: consultar a un cliente para decirle su saldo, marcar productos
          agotados y pasar lista en un evento. No ve el dinero del negocio, ni el historial de
          movimientos de una persona, ni la lista de correo.
        </p>
        <p className="mt-2">
          No puedes quitarte el acceso a ti misma, y el sistema tampoco deja que el negocio se
          quede sin ninguna dueña: nadie podría volver a entrar.
        </p>
      </Alert>

      <PanelEquipo admins={admins} actorId={actor.id} />
    </>
  );
}

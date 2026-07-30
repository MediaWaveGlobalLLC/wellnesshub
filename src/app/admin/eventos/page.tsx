import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Alert } from "@/components/ui/Surface";
import { PanelEventos } from "@/components/admin/eventos/PanelEventos";
import { actorPuede, exigirAdmin } from "@/lib/services/admin-service";
import { listarEventos } from "@/lib/services/operaciones";

export const metadata: Metadata = {
  title: "Eventos · Administración",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * /admin/eventos — la agenda.
 *
 * `events` y `event_bookings` existen desde `0005`. Hasta ahora un evento solo
 * se creaba escribiendo SQL a mano (`scripts/seed-dev.mjs:89`), así que la
 * sección de comunidad de la web pública dependía de que alguien con acceso a
 * la base se acordara.
 */
export default async function EventosPage() {
  const actor = await exigirAdmin();
  if (!actor) notFound();

  // El mostrador entra para pasar lista, no para programar la agenda.
  if (!actorPuede(actor, "ver_eventos")) notFound();

  const puedeGestionar = actorPuede(actor, "gestionar_eventos");

  // El reparto entre próximos y pasados viene decidido del servicio: mirar el
  // reloj durante un render es impuro y el corte bailaría.
  const { proximos, pasados } = await listarEventos();

  return (
    <>
      <div>
        <h1 className="font-display text-2xl text-espresso">Eventos</h1>
        <p className="mt-1 text-sm text-text-muted">
          {puedeGestionar
            ? "Lo que se publique aquí aparece en Comunidad y en el perfil de cada socia."
            : "Entra en un evento para pasar lista."}
        </p>
      </div>

      {puedeGestionar && (
        <Alert titulo="Quitar de la web no cancela las reservas">
          <p>
            Un evento <strong>despublicado</strong> desaparece de la web, pero quien tenía plaza la
            sigue teniendo. <strong>Borrarlo</strong> solo se puede si no se apuntó nadie: si hay
            reservas, borrar las eliminaría en silencio y esas personas verían desaparecer su plaza
            sin que nadie se lo diga.
          </p>
        </Alert>
      )}

      <PanelEventos proximos={proximos} pasados={pasados} puedeGestionar={puedeGestionar} />
    </>
  );
}

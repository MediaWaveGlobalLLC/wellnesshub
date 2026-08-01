import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Alert } from "@/components/ui/Surface";
import { PanelRecompensas } from "@/components/admin/recompensas/PanelRecompensas";
import { actorPuede, exigirAdmin } from "@/lib/services/admin-service";
import { listarCanjesPendientes, listarRecompensasAdmin } from "@/lib/services/lealtad-admin";
import { BRAND_ASSETS } from "@/lib/brand-assets.generated";

export const metadata: Metadata = {
  title: "Recompensas · Administración",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * /admin/recompensas — lo que se puede pedir con puntos.
 *
 * Hasta `0020` los puntos solo subían: `loyalty_transactions` admitía el tipo
 * 'redeem' desde la Fase 1 y nadie lo escribía nunca. Aquí se decide en qué se
 * gastan, y aquí se despacha la cola del mostrador.
 */
export default async function RecompensasPage() {
  const actor = await exigirAdmin();
  if (!actor) notFound();
  if (!actorPuede(actor, "ver_recompensas")) notFound();

  const puedeConfigurar = actorPuede(actor, "configurar_recompensas");
  const puedeEntregar = actorPuede(actor, "entregar_recompensa");

  const [recompensas, pendientes] = await Promise.all([
    listarRecompensasAdmin(),
    listarCanjesPendientes(),
  ]);

  /*
    Fotos elegibles: solo las del manifiesto, y solo producto o fotografía —los
    logos no son ilustración de un premio—. `docs/01` prohíbe imágenes remotas o
    inventadas, así que la única forma de poner foto es escoger una que ya está
    aprobada y versionada en el repo. Si mañana falta una, se añade al
    manifiesto, no al formulario.
  */
  const fotos = Object.entries(BRAND_ASSETS)
    .filter(([, a]) => a.group === "producto" || a.group === "fotografia")
    .map(([clave, a]) => ({ clave, src: a.src }));

  return (
    <>
      <div>
        <h1 className="font-display text-2xl text-espresso">Recompensas</h1>
        <p className="mt-1 text-sm text-text-muted">
          {puedeConfigurar
            ? "En qué se pueden gastar los puntos. Se cambia aquí, sin desplegar."
            : "Lo que se puede pedir con puntos. El catálogo lo cambia la dueña."}
        </p>
      </div>

      <Alert titulo="Los puntos no son dinero">
        <p>
          Canjear entrega un producto y descuenta puntos: <strong>no toca el saldo</strong> de
          nadie. Son dos cosas separadas a propósito y así lo fija <code>docs/00</code>.
        </p>
        <p className="mt-2">
          Entregar cierra el canje y tampoco devuelve puntos. Si hay que revertir uno, se hace con
          un ajuste de puntos desde la ficha de esa persona, que es un movimiento nuevo y con su
          propio motivo.
        </p>
      </Alert>

      <PanelRecompensas
        recompensas={recompensas}
        pendientes={pendientes}
        fotos={fotos}
        puedeConfigurar={puedeConfigurar}
        puedeEntregar={puedeEntregar}
      />
    </>
  );
}

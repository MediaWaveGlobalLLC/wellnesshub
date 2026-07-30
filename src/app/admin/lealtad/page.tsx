import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Alert } from "@/components/ui/Surface";
import { PanelLealtad } from "@/components/admin/lealtad/PanelLealtad";
import { actorPuede, exigirAdmin } from "@/lib/services/admin-service";
import { listarNiveles, listarReglas } from "@/lib/services/lealtad-admin";

export const metadata: Metadata = {
  title: "Lealtad · Administración",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * /admin/lealtad — las reglas del programa, por fin vivas.
 *
 * `loyalty_rules` se sembró en `0005` con las siete reglas del Brand Book y
 * ningún archivo de `src/` la leía: siete filas que describían cómo se ganan
 * puntos y no daban un punto a nadie.
 */
export default async function LealtadPage() {
  const actor = await exigirAdmin();
  if (!actor) notFound();
  if (!actorPuede(actor, "ver_lealtad")) notFound();

  const puedeConfigurar = actorPuede(actor, "configurar_lealtad");
  const [reglas, niveles] = await Promise.all([listarReglas(), listarNiveles()]);

  const bloqueadas = reglas.filter((r) => r.aplicacion === "bloqueada");

  return (
    <>
      <div>
        <h1 className="font-display text-2xl text-espresso">Lealtad</h1>
        <p className="mt-1 text-sm text-text-muted">
          {puedeConfigurar
            ? "Cuánto vale cada cosa y qué hace falta para cada nivel. Se cambia aquí, sin desplegar."
            : "Cuánto vale cada cosa. Los cambios los hace la dueña."}
        </p>
      </div>

      {bloqueadas.length > 0 && (
        <Alert titulo={`${bloqueadas.length} de estas reglas todavía no se pueden aplicar`}>
          <p>
            No es que estén apagadas: es que <strong>falta la pieza que las dispara</strong>. Las de
            compras necesitan el punto de venta conectado —hoy la web no ve lo que se cobra en el
            mostrador—, la de cumpleaños necesita que el registro pida la fecha, y la de referidos,
            un sistema de referidos.
          </p>
          <p className="mt-2">
            Se enseñan igualmente para que se sepa qué falta, en vez de esconderlas y que parezca
            que el programa está completo.
          </p>
        </Alert>
      )}

      <PanelLealtad reglas={reglas} niveles={niveles} puedeConfigurar={puedeConfigurar} />
    </>
  );
}

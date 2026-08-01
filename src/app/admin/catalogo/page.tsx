import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Alert, Badge, Card } from "@/components/ui/Surface";
import { EmptyState } from "@/components/states";
import { FilaProducto } from "@/components/admin/catalogo/FilaProducto";
import { actorPuede, exigirAdmin } from "@/lib/services/admin-service";
import { obtenerCatalogoAdmin } from "@/lib/catalogo/service";
import { BRAND_ASSETS } from "@/lib/brand-assets.generated";

export const metadata: Metadata = {
  title: "Catálogo · Administración",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * /admin/catalogo — la carta, editable.
 *
 * `0011` sacó el menú del código prometiendo que se apagaría un producto «desde
 * administración sin tocar el catálogo ni desplegar». Esta es esa
 * administración.
 *
 * El mostrador entra aquí: marcar agotado es lo único que puede escribir un
 * empleado, y es justamente la tarea del día a día.
 */
export default async function CatalogoPage() {
  const actor = await exigirAdmin();
  if (!actor) redirect("/");

  const puedeEditar = actorPuede(actor, "editar_catalogo");

  /*
    Fotos elegibles: solo del manifiesto, y solo producto o fotografía —un logo
    no ilustra una bebida—. Es la única forma de asignar imagen, así que no hay
    manera de meter una URL suelta en la carta.
  */
  const fotos = Object.entries(BRAND_ASSETS)
    .filter(([, a]) => a.group === "producto" || a.group === "fotografia")
    .map(([clave, a]) => ({ clave, src: a.src }));
  const categorias = await obtenerCatalogoAdmin();

  const activos = categorias.filter((c) => c.productos.some((p) => !p.archivado));
  const archivados = categorias
    .flatMap((c) => c.productos.filter((p) => p.archivado).map((p) => ({ ...p, categoria: c.nombre })));

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-espresso">Catálogo</h1>
          <p className="mt-1 text-sm text-text-muted">
            {puedeEditar
              ? "Los cambios entran en la carta pública en unos minutos. Cada uno queda auditado."
              : "Puedes marcar productos agotados. El resto lo cambia la dueña."}
          </p>
        </div>
      </div>

      <Alert titulo="Agotado no es lo mismo que retirar">
        <p>
          <strong>Agotado</strong> se usa para hoy: el producto sigue en la carta, tachado, y vuelve
          cuando lo repongas. <strong>Retirar</strong> lo saca de la carta hasta nuevo aviso; no se
          borra, porque hay gente que lo tiene guardado en favoritos.
        </p>
      </Alert>

      <div className="mt-6 space-y-5">
        {activos.map((c) => (
          <Card key={c.id} className="p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-3">
              <h2 className="font-display text-xl text-espresso">{c.nombre}</h2>
              <div className="flex items-center gap-2">
                {c.etiquetaTamanos && (
                  <span className="text-xs uppercase tracking-wider text-text-muted">
                    {c.etiquetaTamanos}
                  </span>
                )}
                <Badge tono={c.estado === "hoy" ? "exito" : "aviso"}>
                  {c.estado === "hoy" ? "En carta" : "Próximamente"}
                </Badge>
              </div>
            </div>

            <ul className="mt-1">
              {c.productos
                .filter((p) => !p.archivado)
                .map((p) => (
                  <FilaProducto key={p.id} producto={p} puedeEditar={puedeEditar}
                fotos={fotos} />
                ))}
            </ul>
          </Card>
        ))}
      </div>

      {archivados.length > 0 && puedeEditar && (
        <Card className="mt-6 p-5 sm:p-6">
          <h2 className="font-display text-xl text-espresso">Fuera de la carta</h2>
          <p className="mt-1 text-sm text-text-muted">
            Retirados, no borrados. Siguen resolviendo para quien los tenga en favoritos.
          </p>
          <ul className="mt-3">
            {archivados.map((p) => (
              <FilaProducto key={p.id} producto={p} puedeEditar={puedeEditar}
                fotos={fotos} />
            ))}
          </ul>
        </Card>
      )}

      {activos.length === 0 && (
        <Card className="mt-6 p-8">
          <EmptyState
            titulo="La carta está vacía"
            descripcion="No hay productos activos. Revisa la sección de retirados o crea uno nuevo."
          />
        </Card>
      )}
    </>
  );
}

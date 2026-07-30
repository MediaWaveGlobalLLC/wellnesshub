import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Alert, Card } from "@/components/ui/Surface";
import { EmptyState } from "@/components/states";
import { Paginacion } from "@/components/admin/ui/Paginacion";
import { FilaTarjeta } from "@/components/admin/giftcards/FilaTarjeta";
import { actorPuede, exigirDuena } from "@/lib/services/admin-service";
import { listarPedidosGiftCard } from "@/lib/services/operaciones";
import { pepperConfigurado } from "@/lib/gift-cards/codigo";
import { LupaIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Gift cards · Administración",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const POR_PAGINA = 25;

/** /admin/gift-cards — pedidos, estados y las tres operaciones reales. */
export default async function AdminGiftCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pagina?: string }>;
}) {
  // Los pedidos llevan nombre y correo de quien recibe el regalo: es sección de
  // dueña, no de mostrador.
  const actor = await exigirDuena();
  if (!actor) notFound();

  const { q, pagina } = await searchParams;
  const consulta = (q ?? "").trim();
  const n = Number(pagina ?? 1);

  const puedeOperar = actorPuede(actor, "operar_gift_cards");
  const { pedidos, total } = await listarPedidosGiftCard(
    consulta,
    Number.isFinite(n) && n > 0 ? n : 1,
    POR_PAGINA
  );

  const paginaActual = Number.isFinite(n) && n > 0 ? Math.trunc(n) : 1;

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-espresso">Gift cards</h1>
          <p className="mt-1 text-sm text-text-muted">
            {total} pedido{total === 1 ? "" : "s"} en total.
          </p>
        </div>
      </div>

      {/* Búsqueda por GET: la URL guarda el filtro y se puede compartir. */}
      <form method="get" className="mt-5 flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <label
            htmlFor="q"
            className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-muted"
          >
            Buscar por destinatario o correo
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
              <LupaIcon size={16} />
            </span>
            <input
              id="q"
              name="q"
              defaultValue={consulta}
              placeholder="Nombre o correo"
              className="min-h-[var(--control-height)] w-full rounded-lg border border-border bg-surface pl-11 pr-4 text-espresso placeholder:text-text-muted/60 transition-colors duration-200 focus:border-terracota focus:outline-none"
            />
          </div>
        </div>
        <button
          type="submit"
          className="min-h-[var(--control-height)] rounded-lg bg-terracota px-6 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-surface transition-colors hover:bg-primary-hover"
        >
          Buscar
        </button>
      </form>

      <Alert titulo="Sobre los códigos">
        <p>
          El código completo <strong>no se puede recuperar</strong>: en la base solo vive su huella.
          Se muestran los últimos cuatro para identificar la tarjeta al hablar con la persona.
        </p>
        <p className="mt-2">
          Si alguien perdió su código, <strong>genera uno nuevo</strong>: el anterior deja de
          funcionar en el momento y el importe es el mismo. El código nuevo aparece{" "}
          <strong>una sola vez</strong> en pantalla y hay que copiarlo entonces.
        </p>
      </Alert>

      {!pepperConfigurado() && (
        <div className="mt-4">
          <Alert tono="error" titulo="No se pueden generar códigos">
            <p>
              Falta <code>GIFT_CARD_PEPPER</code> en el servidor. Anular y reactivar sí funcionan;
              generar un código nuevo, no. Ver <code>docs/13_ENVIRONMENT.md</code>.
            </p>
          </Alert>
        </div>
      )}

      {pedidos.length === 0 ? (
        <Card className="mt-6 p-8">
          <EmptyState
            titulo={consulta ? "Sin resultados" : "Todavía no hay pedidos"}
            descripcion={
              consulta
                ? "No hay ningún pedido que coincida con esa búsqueda."
                : "Aquí aparecerán las compras de gift cards en cuanto se realicen."
            }
          />
        </Card>
      ) : (
        <>
          <ul className="mt-6 space-y-3">
            {pedidos.map((p) => (
              <FilaTarjeta key={p.pedidoId} tarjeta={p} puedeOperar={puedeOperar} />
            ))}
          </ul>

          <Paginacion
            pagina={paginaActual}
            porPagina={POR_PAGINA}
            total={total}
            base="/admin/gift-cards"
            parametros={consulta ? { q: consulta } : {}}
          />
        </>
      )}
    </>
  );
}

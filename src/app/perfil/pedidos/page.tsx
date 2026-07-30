import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SubpaginaShell } from "@/components/perfil/SubpaginaShell";
import { Card, Badge } from "@/components/ui/Surface";
import { EmptyState } from "@/components/states";
import { crearClienteServidor } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { formatearDolares } from "@/lib/loyalty";

export const metadata: Metadata = {
  title: "Mis pedidos",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ETIQUETA_ESTADO: Record<string, { texto: string; tono: "exito" | "aviso" | "peligro" }> = {
  completado: { texto: "Completado", tono: "exito" },
  en_camino: { texto: "En camino", tono: "aviso" },
  cancelado: { texto: "Cancelado", tono: "peligro" },
};

function fecha(iso: string): string {
  return new Intl.DateTimeFormat("es-PR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Puerto_Rico",
  }).format(new Date(iso));
}

export default async function PedidosPage() {
  if (!supabaseConfigurado()) redirect("/iniciar-sesion?siguiente=%2Fperfil%2Fpedidos");

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/iniciar-sesion?siguiente=%2Fperfil%2Fpedidos");

  const { data: pedidos } = await supabase
    .from("orders")
    .select("id, order_number, status, total_cents, channel, placed_at")
    .order("placed_at", { ascending: false })
    .limit(50);

  return (
    <SubpaginaShell
      titulo="Mis pedidos"
      descripcion="El historial de lo que has pedido en SIEMBRA."
    >
      {!pedidos || pedidos.length === 0 ? (
        /*
          Estado vacío honesto. Todavía no hay punto de venta conectado que
          registre las compras, así que aquí no habrá nada hasta que exista esa
          fuente. Se prefiere decirlo a inventar pedidos de ejemplo.
        */
        <Card className="p-8">
          <EmptyState
            titulo="Todavía no hay pedidos"
            descripcion="Cuando conectemos la caja de la tienda, tus compras aparecerán aquí automáticamente y sumarán puntos."
            accion={{ href: "/menu", texto: "Ver el menú" }}
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {pedidos.map((p) => {
            const estado = ETIQUETA_ESTADO[p.status] ?? { texto: p.status, tono: "aviso" as const };
            return (
              <li key={p.id}>
                <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div>
                    <p className="font-display text-lg text-espresso">#{p.order_number}</p>
                    <p className="mt-0.5 text-sm text-text-muted">
                      {fecha(p.placed_at)} · {p.channel === "linea" ? "En línea" : "En tienda"}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge tono={estado.tono}>{estado.texto}</Badge>
                    <p className="font-display text-lg text-espresso">
                      {formatearDolares(Number(p.total_cents))}
                    </p>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </SubpaginaShell>
  );
}

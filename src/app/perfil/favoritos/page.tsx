import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SubpaginaShell } from "@/components/perfil/SubpaginaShell";
import { BotonFavorito } from "@/components/perfil/BotonFavorito";
import { Card } from "@/components/ui/Surface";
import { EmptyState } from "@/components/states";
import { MasIcon } from "@/components/icons";
import { crearClienteServidor } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { obtenerCatalogo } from "@/lib/catalogo/service";
import {
  precioDeCarta,
  soloDisponibles,
  type CategoriaCatalogo,
  type ProductoCatalogo,
} from "@/lib/catalogo/tipos";

export const metadata: Metadata = {
  title: "Mis favoritos",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Mis favoritos.
 *
 * Lee el catálogo de la BASE, no la carta transcrita de `site.ts`. Desde la
 * fase C los precios se editan desde administración, así que la copia estática
 * puede estar vieja: enseñar aquí $6.00 y cobrar $6.50 en `/pedir` sería
 * mentirle a la clienta con dos pantallas del mismo sitio. Y sin la base
 * tampoco se sabría qué está agotado ni qué se retiró de la carta, que es justo
 * lo que decide si el botón de pedir puede aparecer.
 */
export default async function FavoritosPage() {
  if (!supabaseConfigurado()) redirect("/iniciar-sesion?siguiente=%2Fperfil%2Ffavoritos");

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/iniciar-sesion?siguiente=%2Fperfil%2Ffavoritos");

  const [{ data: filas }, { categorias }] = await Promise.all([
    supabase.from("favorites").select("item_slug").order("created_at", { ascending: false }),
    obtenerCatalogo(),
  ]);

  /*
    Índice slug → producto Y su categoría. `indexarProductos` del servicio no
    sirve aquí porque pierde la categoría, y la ficha del favorito la rotula.
  */
  const porSlug = new Map<string, { producto: ProductoCatalogo; categoria: CategoriaCatalogo }>();
  for (const categoria of categorias) {
    for (const producto of categoria.productos) {
      if (!porSlug.has(producto.slug)) porSlug.set(producto.slug, { producto, categoria });
    }
  }

  const guardados = new Set((filas ?? []).map((f) => f.item_slug));

  // Se conserva el orden de la consulta —el último guardado primero— y se
  // descarta lo que ya no está en la carta: un favorito puede quedar huérfano.
  const favoritos = [...guardados]
    .map((slug) => porSlug.get(slug))
    .filter((x): x is { producto: ProductoCatalogo; categoria: CategoriaCatalogo } => x !== undefined);

  return (
    <SubpaginaShell
      titulo="Mis favoritos"
      descripcion="Guarda lo que más te gusta del menú para encontrarlo rápido."
    >
      {favoritos.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            titulo="Aún no marcaste favoritos"
            descripcion="Usa el botón Guardar en cualquier producto de la lista de abajo."
          />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {favoritos.map(({ producto, categoria }) => {
            /*
              Pedible = está hoy y tiene precio. Un producto sin variantes no
              se puede cobrar, así que tampoco se puede ofrecer: el botón
              desaparece en vez de llevar a un pedido que fallaría.
            */
            const pedible = producto.disponible && producto.variantes.length > 0;

            return (
              <li key={producto.slug}>
                <Card className="flex h-full flex-col justify-between p-5">
                  <div>
                    <p className="font-display text-lg text-espresso">{producto.nombre}</p>
                    <p className="mt-0.5 text-xs uppercase tracking-[0.1em] text-text-muted">
                      {categoria.nombre}
                    </p>
                    <p className="mt-2 text-sm text-terracota">
                      ${precioDeCarta(producto.variantes)}
                    </p>
                    {!producto.disponible && (
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">
                        Agotado hoy
                      </p>
                    )}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {pedible && (
                      /*
                        Lleva a `/pedir` con el producto ya en el carrito. No
                        hay carrito compartido entre páginas —vive dentro del
                        componente de `/pedir`— y montar uno global para esto
                        sería mover el estado del pedido a un sitio donde nadie
                        más lo necesita. El enlace hace el mismo trabajo.

                        Se manda el SLUG, no el precio ni la variante: el
                        servidor resuelve cuál es la más barata y cuánto vale.
                      */
                      <Link
                        href={`/pedir?anadir=${encodeURIComponent(producto.slug)}`}
                        className="inline-flex items-center gap-2 rounded-sm border border-forest bg-forest px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-avena transition-opacity hover:opacity-90"
                      >
                        <MasIcon size={15} />
                        Añadir al pedido
                      </Link>
                    )}
                    <BotonFavorito slug={producto.slug} activo />
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {/*
        Esta lista es la carta, así que enseña lo mismo que `/menu`: lo apagado
        no aparece. Arriba sí sale un favorito agotado —es suyo y merece saber
        que hoy no está— pero aquí no se puede guardar algo que no se sirve.
      */}
      <section className="mt-14">
        <h2 className="font-display text-2xl text-espresso">Todo el menú</h2>
        <p className="mt-1 text-sm text-text-muted">Precios en USD, tomados del menú oficial.</p>

        <div className="mt-6 space-y-8">
          {soloDisponibles(categorias).map((categoria) => (
            <div key={categoria.id}>
              <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
                {categoria.nombre}
              </h3>
              <ul className="mt-3 space-y-2">
                {categoria.productos.map((producto) => (
                  <li
                    key={producto.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2.5 last:border-0"
                  >
                    <span className="text-sm font-medium text-espresso">
                      {producto.nombre}
                      <span className="ml-2 text-text-muted">
                        ${precioDeCarta(producto.variantes)}
                      </span>
                    </span>
                    <BotonFavorito slug={producto.slug} activo={guardados.has(producto.slug)} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </SubpaginaShell>
  );
}

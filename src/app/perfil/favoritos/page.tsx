import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SubpaginaShell } from "@/components/perfil/SubpaginaShell";
import { BotonFavorito } from "@/components/perfil/BotonFavorito";
import { Card } from "@/components/ui/Surface";
import { EmptyState } from "@/components/states";
import { crearClienteServidor } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { resolverItems, todosLosItems } from "@/lib/menu";

export const metadata: Metadata = {
  title: "Mis favoritos",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FavoritosPage() {
  if (!supabaseConfigurado()) redirect("/iniciar-sesion?siguiente=%2Fperfil%2Ffavoritos");

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/iniciar-sesion?siguiente=%2Fperfil%2Ffavoritos");

  const { data: filas } = await supabase
    .from("favorites")
    .select("item_slug")
    .order("created_at", { ascending: false });

  const guardados = new Set((filas ?? []).map((f) => f.item_slug));
  const favoritos = resolverItems([...guardados]);

  // El menú completo, agrupado por sección, para poder añadir desde aquí.
  const catalogo = todosLosItems();
  const secciones = [...new Map(catalogo.map((i) => [i.seccionId, i.seccionTitulo])).entries()];

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
          {favoritos.map((item) => (
            <li key={item.slug}>
              <Card className="flex h-full flex-col justify-between p-5">
                <div>
                  <p className="font-display text-lg text-espresso">{item.nombre}</p>
                  <p className="mt-0.5 text-xs uppercase tracking-[0.1em] text-text-muted">
                    {item.seccionTitulo}
                  </p>
                  <p className="mt-2 text-sm text-terracota">${item.precio}</p>
                </div>
                <div className="mt-5">
                  <BotonFavorito slug={item.slug} activo />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <section className="mt-14">
        <h2 className="font-display text-2xl text-espresso">Todo el menú</h2>
        <p className="mt-1 text-sm text-text-muted">
          Precios en USD, tomados del menú oficial.
        </p>

        <div className="mt-6 space-y-8">
          {secciones.map(([id, titulo]) => (
            <div key={id}>
              <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
                {titulo}
              </h3>
              <ul className="mt-3 space-y-2">
                {catalogo
                  .filter((i) => i.seccionId === id)
                  .map((item) => (
                    <li
                      key={item.slug}
                      className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2.5 last:border-0"
                    >
                      <span className="text-sm font-medium text-espresso">
                        {item.nombre}
                        <span className="ml-2 text-text-muted">${item.precio}</span>
                      </span>
                      <BotonFavorito slug={item.slug} activo={guardados.has(item.slug)} />
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

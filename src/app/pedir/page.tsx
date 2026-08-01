import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Alert } from "@/components/ui/Surface";
import { Carrito } from "@/components/pedir/Carrito";
import { obtenerCatalogo } from "@/lib/catalogo/service";
import { crearClienteServidor } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/env";

/**
 * /pedir — pedir del menú para recoger en el local.
 *
 * `orders` existía desde `0005` y solo se leía: `/perfil/pedidos` pintaba un
 * historial que nadie escribía. Esta es la pantalla que faltaba.
 *
 * Con sesión, porque el pedido va atado a una cuenta: es lo que permite pagarlo
 * con saldo, darle puntos y que la barra sepa a quién llamar.
 */
export const metadata: Metadata = {
  title: "Pedir",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PedirPage({
  searchParams,
}: {
  searchParams: Promise<{ cancelado?: string }>;
}) {
  if (!supabaseConfigurado()) redirect("/iniciar-sesion?siguiente=%2Fpedir");

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/iniciar-sesion?siguiente=%2Fpedir");

  const { cancelado } = await searchParams;

  const [{ categorias }, saldo] = await Promise.all([
    obtenerCatalogo(),
    supabase.from("wallets").select("balance_cents").eq("user_id", user.id).maybeSingle(),
  ]);

  const saldoCents = Number(saldo.data?.balance_cents ?? 0);

  return (
    <div className="grain min-h-screen bg-leche pb-20 pt-28 sm:pt-32">
      <div className="mx-auto max-w-[var(--container-content)] px-5 sm:px-8">
        <header className="mb-8">
          <h1 className="font-display text-3xl leading-tight text-espresso sm:text-4xl">
            Pedir
          </h1>
          <p className="mt-2 leading-relaxed text-text-muted">
            Arma tu pedido y págalo aquí. Lo preparamos y lo recoges en SIEMBRA Condado.
          </p>
        </header>

        {cancelado && (
          <div className="mb-6">
            <Alert titulo="No se cobró nada">
              <p>
                Cancelaste el pago. Tu pedido sigue guardado sin pagar; puedes volver a intentarlo
                cuando quieras.
              </p>
            </Alert>
          </div>
        )}

        <Carrito categorias={categorias} saldoCents={saldoCents} />
      </div>
    </div>
  );
}

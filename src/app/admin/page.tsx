import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/Surface";
import { NotaDeDatoAusente, TarjetaMetrica } from "@/components/admin/TarjetaMetrica";
import { actorPuede, exigirAdmin } from "@/lib/services/admin-service";
import { obtenerResumen } from "@/lib/services/admin-consultas";
import { serie } from "@/lib/services/metricas";
import { formatearDolares, formatearPuntos } from "@/lib/loyalty";
import { CupIcon, GiftIcon, UserIcon, WalletIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Administración",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Porcentaje legible, sin decimales inútiles. */
function porcentaje(parte: number, total: number): string {
  if (total === 0) return "—";
  return `${Math.round((parte / total) * 100)}%`;
}

/** /admin — el estado del negocio de un vistazo. */
export default async function AdminPage() {
  // El layout ya autorizó, pero se repite: una página no debe depender de que
  // alguien más la haya protegido.
  const actor = await exigirAdmin();
  if (!actor) redirect("/");

  const r = await obtenerResumen();

  // Un empleado ve el resumen de miembros, no las cifras de dinero: cuánto
  // factura el negocio no es información de mostrador.
  const verNegocio = actorPuede(actor, "ver_negocio");

  // La tendencia solo se pide si se va a pintar.
  const altas = verNegocio ? await serie("altas", "30d") : null;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaMetrica
          etiqueta="Miembros"
          valor={formatearPuntos(r.miembros)}
          nota={`${r.miembros30d} en los últimos 30 días · ${porcentaje(r.conMarketing, r.miembros)} acepta marketing`}
          serie={altas ?? undefined}
          icono={<UserIcon size={18} />}
        />

        <TarjetaMetrica
          etiqueta="Activación"
          valor={porcentaje(r.perfilVisitado, r.miembros)}
          nota={`${r.perfilVisitado} de ${r.miembros} han entrado a su perfil alguna vez. ${r.correoConfirmado} confirmaron el correo.`}
          icono={<CupIcon size={18} />}
        />

        {verNegocio && (
          <TarjetaMetrica
            etiqueta="Crédito en circulación"
            valor={formatearDolares(r.saldoTotalCents)}
            nota={`Dinero que el negocio debe en producto, repartido en ${r.walletsConSaldo} cuenta${r.walletsConSaldo === 1 ? "" : "s"}.`}
            icono={<WalletIcon size={18} />}
          />
        )}

        {verNegocio && (
          <TarjetaMetrica
            etiqueta="Gift cards vendidas"
            valor={formatearDolares(r.giftcardsGmvCents)}
            nota={`${r.pedidosPagados} de ${r.pedidosTotales} pedidos llegaron a pagarse.`}
            icono={<GiftIcon size={18} />}
          />
        )}
      </div>

      {verNegocio && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <NotaDeDatoAusente titulo="Sin canjear">
            <p>
              Hay <strong>{formatearDolares(r.giftcardsBreakageCents)}</strong> en{" "}
              {r.giftcardsSinCanjear} gift card{r.giftcardsSinCanjear === 1 ? "" : "s"} que nadie ha
              usado todavía. Es dinero ya cobrado que sigue pendiente de servirse.
            </p>
          </NotaDeDatoAusente>

          {/*
            El cero más peligroso del panel. `orders` existe pero nadie la
            escribe: sin punto de venta conectado no hay ventas de cafetería que
            contar. Un «$0.00» sin esta explicación se lee como «no vendimos
            nada» en vez de «esto todavía no se mide».
          */}
          <NotaDeDatoAusente titulo="Ventas del local">
            <p>
              Todavía <strong>no se miden</strong>. La web no está conectada al punto de venta, así
              que aquí no aparece lo que se vende en el mostrador. El único ingreso que este panel
              ve son las gift cards.
            </p>
          </NotaDeDatoAusente>
        </div>
      )}

      <Card className="mt-6 p-6">
        <h2 className="font-display text-xl text-espresso">Cómo trabajar aquí</h2>
        <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-text-muted">
          <li>
            <strong className="text-espresso">Todo ajuste deja rastro.</strong> El motivo es
            obligatorio y queda en la auditoría con quién lo hizo, el antes y el después.
          </li>
          <li>
            <strong className="text-espresso">Puntos y crédito son distintos.</strong> Los puntos
            dan nivel y recompensas; el crédito es dinero de tienda.
          </li>
          <li>
            <strong className="text-espresso">El código de una gift card no se puede recuperar.</strong>{" "}
            En la base solo vive su hash. Se ven los últimos cuatro para identificarla.
          </li>
        </ul>

        <div className="mt-6 flex flex-wrap gap-5">
          <Link
            href="/admin/usuarios"
            className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-primary-hover underline underline-offset-4"
          >
            Buscar un usuario
          </Link>
          {verNegocio && (
            <Link
              href="/admin/metricas"
              className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-primary-hover underline underline-offset-4"
            >
              Ver todas las métricas
            </Link>
          )}
        </div>
      </Card>
    </>
  );
}

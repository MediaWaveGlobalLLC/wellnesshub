import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/Surface";
import { exigirAdmin } from "@/lib/services/admin-service";
import { obtenerResumen } from "@/lib/services/admin-consultas";
import { formatearDolares, formatearPuntos } from "@/lib/loyalty";

export const metadata: Metadata = {
  title: "Administración",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** /admin — resumen mínimo de `docs/02`. */
export default async function AdminPage() {
  // El layout ya autorizó, pero se repite: una página no debe depender de que
  // alguien más la haya protegido.
  if (!(await exigirAdmin())) redirect("/");

  const r = await obtenerResumen();

  const TARJETAS = [
    { titulo: "Miembros", valor: formatearPuntos(r.miembros), pie: "Cuentas registradas" },
    {
      titulo: "Crédito en circulación",
      valor: formatearDolares(r.saldoTotalCents),
      pie: "Suma de todos los wallets",
    },
    {
      titulo: "Gift cards",
      valor: `${r.pedidosPagados} / ${r.pedidosTotales}`,
      pie: "Pagadas sobre pedidos totales",
    },
    {
      titulo: "Auditoría",
      valor: formatearPuntos(r.entradasAuditoria),
      pie: "Movimientos con rastro",
    },
  ];

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TARJETAS.map((t) => (
          <li key={t.titulo}>
            <Card className="h-full p-6">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
                {t.titulo}
              </p>
              <p className="mt-3 font-display text-3xl text-espresso">{t.valor}</p>
              <p className="mt-1 text-xs text-text-muted">{t.pie}</p>
            </Card>
          </li>
        ))}
      </ul>

      <Card className="mt-6 p-6">
        <h2 className="font-display text-xl text-espresso">Cómo trabajar aquí</h2>
        <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-text-muted">
          <li>
            <strong className="text-espresso">Todo ajuste deja rastro.</strong> El motivo es
            obligatorio y queda en la auditoría con el antes y el después.
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
        <Link
          href="/admin/usuarios"
          className="mt-6 inline-block text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-terracota underline underline-offset-4"
        >
          Buscar un usuario
        </Link>
      </Card>
    </>
  );
}

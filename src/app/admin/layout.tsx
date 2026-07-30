import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { exigirAdmin } from "@/lib/services/admin-service";
import { servicioDisponible } from "@/lib/supabase/admin";
import { Alert } from "@/components/ui/Surface";

/**
 * Marco del panel administrativo.
 *
 * La autorización se comprueba AQUÍ, en el layout, así que cubre todas las
 * páginas hijas: ninguna puede olvidarse de verificar. Y cada página vuelve a
 * llamar a `exigirAdmin()` antes de leer datos, porque un layout no protege un
 * Server Action ni una petición directa a la ruta.
 *
 * `docs/06`: el rol se comprueba server-side contra `admin_users`, una tabla
 * que ningún rol de cliente puede leer.
 */
export const dynamic = "force-dynamic";

const SECCIONES = [
  { href: "/admin", texto: "Resumen" },
  { href: "/admin/usuarios", texto: "Usuarios" },
  { href: "/admin/gift-cards", texto: "Gift cards" },
  { href: "/admin/auditoria", texto: "Auditoría" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Sin service_role no hay panel posible: se dice por qué en vez de fallar raro.
  if (!servicioDisponible()) {
    return (
      <div className="grain min-h-screen bg-leche pt-32">
        <div className="mx-auto max-w-2xl px-5 sm:px-8">
          <Alert tono="error" titulo="Panel no disponible">
            <p>
              Falta <code>SUPABASE_SERVICE_ROLE_KEY</code>. El panel la necesita para consultar
              cuentas ajenas. Ver <code>docs/13_ENVIRONMENT.md</code>.
            </p>
          </Alert>
        </div>
      </div>
    );
  }

  const actor = await exigirAdmin();
  // 404 y no 403: quien no es administrador no debería ni saber que esto existe.
  if (!actor) redirect("/");

  return (
    <div className="grain min-h-screen bg-leche pb-20 pt-28 sm:pt-32">
      <div className="mx-auto max-w-[var(--container-content)] px-5 sm:px-8">
        <header className="border-b border-border pb-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-terracota">
                Administración
              </p>
              <h1 className="mt-1 font-display text-2xl text-espresso">SIEMBRA</h1>
            </div>
            <p className="text-xs text-text-muted">{actor.email}</p>
          </div>

          <nav aria-label="Secciones de administración" className="mt-5 flex flex-wrap gap-5">
            {SECCIONES.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-espresso transition-colors hover:text-terracota"
              >
                {s.texto}
              </Link>
            ))}
          </nav>
        </header>

        <main className="mt-8">{children}</main>
      </div>
    </div>
  );
}

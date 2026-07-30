import type { ReactNode } from "react";
import { SunBean } from "@/components/SunBean";

/**
 * Marco compartido de las pantallas de cuenta ligeras (login, recuperación,
 * confirmación).
 *
 * `docs/02` dice que estas pantallas se derivan del registro «sin rediseñar»:
 * mismo fondo Leche, misma card de superficie, mismo sello y misma tipografía.
 * Lo único que cambia es que van centradas, porque no tienen columna editorial.
 */
export function AuthShell({
  titulo,
  descripcion,
  children,
  pie,
}: {
  titulo: string;
  descripcion?: string;
  children: ReactNode;
  pie?: ReactNode;
}) {
  return (
    <section className="grain flex min-h-screen items-center justify-center bg-leche px-5 pb-20 pt-32 sm:px-8">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-border bg-surface p-6 shadow-warm sm:p-8">
          <div className="mb-6 text-center">
            <span className="inline-block text-terracota">
              <SunBean size={44} color="currentColor" />
            </span>
            <h1 className="mt-3 font-display text-2xl text-espresso sm:text-[1.75rem]">
              {titulo}
            </h1>
            {descripcion && (
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{descripcion}</p>
            )}
          </div>
          {children}
        </div>
        {pie && <div className="mt-5 text-center text-sm text-text-muted">{pie}</div>}
      </div>
    </section>
  );
}

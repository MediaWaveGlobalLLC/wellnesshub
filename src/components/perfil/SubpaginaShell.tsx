import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Marco de las subpáginas de perfil.
 *
 * Misma familia visual que `/perfil` —fondo Leche con grano, ancho de contenido
 * y tipografía editorial— con un encabezado sobrio y vuelta al perfil. `docs/02`
 * pide "módulos de perfil", no una sección con identidad propia.
 */
export function SubpaginaShell({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion?: string;
  children: ReactNode;
}) {
  return (
    <div className="grain min-h-screen bg-leche pb-20 pt-28 sm:pt-32">
      <div className="mx-auto max-w-[var(--container-content)] px-5 sm:px-8">
        <Link
          href="/perfil"
          className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-terracota underline underline-offset-4"
        >
          ← Volver al perfil
        </Link>

        <header className="mt-5 border-b border-border pb-6">
          <h1 className="font-display text-3xl text-espresso sm:text-4xl">{titulo}</h1>
          {descripcion && (
            <p className="mt-2 max-w-xl leading-relaxed text-text-muted">{descripcion}</p>
          )}
        </header>

        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}

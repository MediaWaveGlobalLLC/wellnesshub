"use client";

import { useTransition } from "react";
import { alternarFavorito } from "@/lib/perfil/acciones";
import { HeartIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * Alterna un producto en favoritos.
 *
 * El estado real vive en la base; tras la acción el servidor revalida la ruta.
 * Se deshabilita mientras dura la transición para no encadenar clics.
 */
export function BotonFavorito({ slug, activo }: { slug: string; activo: boolean }) {
  const [pendiente, iniciar] = useTransition();

  return (
    <button
      type="button"
      disabled={pendiente}
      aria-pressed={activo}
      aria-label={activo ? "Quitar de favoritos" : "Añadir a favoritos"}
      onClick={() => iniciar(() => void alternarFavorito(slug))}
      className={cn(
        "inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] transition-colors disabled:opacity-50",
        activo
          ? "border-terracota bg-terracota text-leche hover:bg-primary-hover"
          : "border-border bg-surface text-text-muted hover:border-terracota hover:text-terracota"
      )}
    >
      <HeartIcon size={15} />
      {activo ? "Guardado" : "Guardar"}
    </button>
  );
}

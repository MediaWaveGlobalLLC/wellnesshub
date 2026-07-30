import Link from "next/link";

import { RANGOS, type ClaveRango } from "@/lib/services/metricas";

/**
 * Selector de rango de fechas, compartido por `/admin/metricas` y
 * `/admin/visitas`.
 *
 * Son enlaces, no botones: cada rango tiene su propia URL, se puede compartir y
 * se puede volver atrás. No hay ni una línea de JavaScript en el navegador.
 *
 * `30d` es el defecto y su enlace va sin parámetro, para que la dirección
 * canónica de la pantalla sea la corta.
 */
export function SelectorRango({ base, actual }: { base: string; actual: ClaveRango }) {
  return (
    <nav aria-label="Rango de fechas" className="flex flex-wrap gap-4">
      {(Object.keys(RANGOS) as ClaveRango[]).map((r) => (
        <Link
          key={r}
          href={r === "30d" ? base : `${base}?rango=${r}`}
          aria-current={r === actual ? "page" : undefined}
          className={
            r === actual
              ? "text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-espresso underline decoration-terracota decoration-2 underline-offset-[6px]"
              : "text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-text-muted transition-colors hover:text-espresso"
          }
        >
          {RANGOS[r].etiqueta}
        </Link>
      ))}
    </nav>
  );
}

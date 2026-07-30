import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Superficies SIEMBRA — docs/01: «Cards con borde fino y sombra mínima».
 * Radio normal 16px; 24px solo donde el mockup lo exige.
 */

export function Card({
  children,
  className,
  tono = "claro",
}: {
  children: ReactNode;
  className?: string;
  tono?: "claro" | "avena" | "terracota" | "forest";
}) {
  const TONOS = {
    claro: "bg-surface border-border text-espresso",
    avena: "bg-avena border-mustard/30 text-espresso",
    terracota: "bg-terracota border-terracota text-leche",
    forest: "bg-forest border-forest text-avena",
  } as const;

  return (
    <div className={cn("rounded-lg border shadow-card", TONOS[tono], className)}>{children}</div>
  );
}

/** Etiqueta corta de estado — "Completado", "En camino", "Cancelado" (mockup 02). */
export function Badge({
  children,
  tono = "neutro",
}: {
  children: ReactNode;
  tono?: "neutro" | "exito" | "aviso" | "peligro";
}) {
  const TONOS = {
    neutro: "bg-surface-muted text-text-muted border-border",
    exito: "bg-forest text-avena border-forest",
    aviso: "bg-avena text-espresso border-mustard/40",
    peligro: "bg-surface text-danger border-danger/40",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.1em]",
        TONOS[tono]
      )}
    >
      {children}
    </span>
  );
}

/** Barra de progreso al siguiente nivel (mockup 02). */
export function ProgressBar({
  valor,
  total,
  etiqueta,
}: {
  valor: number;
  total: number;
  etiqueta?: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((valor / total) * 100)) : 0;
  return (
    <div>
      <div
        role="progressbar"
        aria-valuenow={valor}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={etiqueta ?? "Progreso"}
        className="h-1.5 w-full overflow-hidden rounded-sm bg-espresso/15"
      >
        <div className="h-full rounded-sm bg-avena" style={{ width: `${pct}%` }} />
      </div>
      {etiqueta && <p className="mt-2 text-xs tracking-wide opacity-80">{etiqueta}</p>}
    </div>
  );
}

/** Aviso en línea — error recuperable, éxito o información. */
export function Alert({
  children,
  tono = "info",
  titulo,
}: {
  children: ReactNode;
  tono?: "info" | "exito" | "error";
  titulo?: string;
}) {
  const TONOS = {
    info: "border-border bg-surface-muted text-espresso",
    exito: "border-forest/30 bg-teatree/30 text-forest",
    error: "border-danger/40 bg-surface text-danger",
  } as const;

  return (
    <div
      role={tono === "error" ? "alert" : "status"}
      className={cn("rounded-lg border px-4 py-3 text-sm", TONOS[tono])}
    >
      {titulo && <p className="mb-1 font-semibold">{titulo}</p>}
      {children}
    </div>
  );
}

/** Bloque de carga editorial — docs/02 prefiere skeleton a spinner genérico. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-sm bg-espresso/10", className)}
    />
  );
}

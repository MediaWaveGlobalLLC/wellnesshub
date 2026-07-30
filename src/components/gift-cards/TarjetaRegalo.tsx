import { SunBean } from "@/components/SunBean";
import { LeafIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * Arte de la gift card — mockup 03.
 *
 * Compuesta en código con el sello oficial de la marca sobre Forest o
 * Terracota, más el motivo botánico de los empaques. No existe un render de la
 * tarjeta entre los assets entregados; esto es aplicación de marca, no un
 * asset inventado (decisión D13 del plan aprobado).
 */
export function TarjetaRegalo({
  tono = "forest",
  className,
}: {
  tono?: "forest" | "terracota";
  className?: string;
}) {
  const esForest = tono === "forest";

  return (
    <div
      aria-hidden
      className={cn(
        "relative aspect-[1.6/1] w-full overflow-hidden rounded-lg shadow-warm",
        esForest ? "bg-forest text-avena" : "bg-terracota text-leche",
        className
      )}
    >
      {/* Motivo botánico, en el trazo de la marca */}
      <LeafIcon size={220} className="pointer-events-none absolute -right-10 -top-8 opacity-15" />
      <LeafIcon size={150} className="pointer-events-none absolute -bottom-6 -left-6 opacity-10" />

      <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
        <SunBean size={38} color="currentColor" />
        <p className="mt-2 font-display text-2xl tracking-[0.08em] sm:text-3xl">SIEMBRA</p>
        <p className="mt-1 text-[0.6rem] uppercase tracking-[0.14em] opacity-80">
          Wellness Hub | Coffee &amp; Matcha Bar
        </p>
        <p className="mt-4 text-[0.62rem] uppercase tracking-[0.3em] opacity-70">Gift Card</p>
      </div>
    </div>
  );
}

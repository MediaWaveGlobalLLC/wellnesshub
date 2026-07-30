import type { ReactNode } from "react";

import { Card } from "@/components/ui/Surface";
import { Sparkline } from "@/components/admin/graficas/Grafica";
import type { Punto } from "@/components/admin/graficas/escala";

/**
 * Un número grande con su contexto.
 *
 * El contexto es la parte que importa: «$68.40» no dice nada por sí solo. Al
 * lado va qué es, y debajo la nota que lo interpreta —cuántos de los miembros,
 * sobre qué periodo—.
 */
export function TarjetaMetrica({
  etiqueta,
  valor,
  nota,
  serie,
  icono,
}: {
  etiqueta: string;
  valor: string;
  /** La frase que evita malinterpretar el número. */
  nota?: string;
  /** Tendencia del periodo. Se omite si no hay suficientes datos. */
  serie?: Punto[];
  icono?: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
          {etiqueta}
        </p>
        {icono && <span className="shrink-0 text-terracota">{icono}</span>}
      </div>

      <p className="mt-2 font-display text-3xl leading-none text-espresso">{valor}</p>

      {nota && <p className="mt-2 text-xs leading-relaxed text-text-muted">{nota}</p>}

      {serie && serie.length >= 2 && (
        <div className="mt-3">
          <Sparkline serie={serie} titulo={`Tendencia de ${etiqueta}`} />
        </div>
      )}
    </Card>
  );
}

/**
 * Aviso de que un número NO significa lo que parece.
 *
 * Existe por un caso concreto: no hay ventas de cafetería porque no hay punto
 * de venta conectado, y un «$0.00» sin explicación se lee como «no vendimos
 * nada» en vez de «esto todavía no se mide». Un cero ambiguo en un panel de
 * negocio es peor que no enseñar el dato.
 */
export function NotaDeDatoAusente({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <Card tono="avena" className="p-5">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-espresso">
        {titulo}
      </p>
      <div className="mt-2 text-sm leading-relaxed text-espresso/80">{children}</div>
    </Card>
  );
}

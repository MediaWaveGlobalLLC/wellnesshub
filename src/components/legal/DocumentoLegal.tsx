import type { ReactNode } from "react";

import { PageHero } from "@/components/PageHero";

/*
  Envoltura de los documentos legales (/terminos y /privacidad).

  Existen porque el formulario de registro obliga a aceptarlos: hasta ahora
  ambos enlaces daban 404, de modo que se pedía el consentimiento de dos
  documentos que no existían.

  El contenido describe lo que el sistema hace de verdad —las tablas de
  `supabase/migrations`, los procesadores realmente conectados— y no una
  plantilla genérica. Aun así NO sustituye a una revisión legal: ver la nota de
  `docs/13` antes de abrir al público.
*/

export function DocumentoLegal({
  eyebrow,
  titulo,
  descripcion,
  actualizado,
  children,
}: {
  eyebrow: string;
  titulo: string;
  descripcion: string;
  actualizado: string;
  children: ReactNode;
}) {
  return (
    <>
      <PageHero eyebrow={eyebrow} title={titulo} subtitle={descripcion} />

      <section className="bg-leche pb-24">
        <div className="mx-auto max-w-3xl px-6">
          <p className="mb-10 border-b border-espresso/15 pb-6 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
            Última actualización: {actualizado}
          </p>

          <div className="space-y-10">{children}</div>
        </div>
      </section>
    </>
  );
}

/** Sección numerada de un documento legal. */
export function Clausula({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-2xl text-espresso">{titulo}</h2>
      {/*
        Los enlaces van en `primary-hover` y no en `terracota`: terracota sobre
        leche da 4.39:1 y AA pide 4.5:1 para texto normal. `primary-hover` es el
        mismo rojo un punto más oscuro, es token oficial, y llega a 5.83:1.
      */}
      <div className="mt-4 space-y-4 leading-relaxed text-text-muted [&_a]:font-semibold [&_a]:text-primary-hover [&_a]:underline [&_a]:underline-offset-2 [&_strong]:font-semibold [&_strong]:text-espresso">
        {children}
      </div>
    </section>
  );
}

/** Lista con viñetas de marca, para enumerar datos o condiciones. */
export function Lista({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          {/* `.dot-circle` es el marcador de listas del sistema y la forma que
              el design lock admite para un punto; un radio suelto lo rechaza. */}
          <span aria-hidden className="dot-circle mt-2.5 size-1.5 shrink-0 bg-terracota" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

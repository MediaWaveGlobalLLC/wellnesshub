import type { ReactNode } from "react";

/**
 * Tabla del panel de administración.
 *
 * Es la primera `<table>` de verdad del proyecto. Hasta ahora todo eran listas
 * de `<li>` con flex, y el patrón estaba copiado en tres sitios distintos
 * —la ficha de usuario, la auditoría y el wallet— cada uno con su propia idea
 * de espaciado.
 *
 * Se usa `<table>` y no `<div>` porque esto SON datos tabulares: un lector de
 * pantalla anuncia «columna 3 de 5, Saldo», y sin marcado de tabla lee una
 * ristra de números sin decir de qué son.
 *
 * VIVE EN `components/admin/ui/`, NO EN `components/ui/`. El baseline visual
 * cubre /registro, /perfil, /wallet y /gift-cards, y esas cuatro importan de
 * `components/ui/`. Tocar ese directorio pone en juego el gate visual por un
 * componente que hoy solo usa el panel. El precio es duplicar un par de clases;
 * el día que estas piezas se usen fuera del admin, se promueven y se regeneran
 * las capturas a la vez.
 */

export type Columna = {
  clave: string;
  titulo: string;
  /** Los números se alinean a la derecha: así se comparan de un vistazo. */
  numerica?: boolean;
  /** Se oculta en móvil. Para columnas de contexto, nunca para la principal. */
  secundaria?: boolean;
};

export function Tabla({
  columnas,
  descripcion,
  children,
}: {
  columnas: Columna[];
  /** Qué contiene la tabla. Va en el `<caption>`, oculto salvo para lectores. */
  descripcion: string;
  children: ReactNode;
}) {
  return (
    // El scroll horizontal vive aquí y no en el `<body>`: una tabla ancha se
    // desplaza dentro de su caja en vez de romper la página entera en móvil.
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{descripcion}</caption>
        <thead>
          <tr className="border-b border-border">
            {columnas.map((c) => (
              <th
                key={c.clave}
                scope="col"
                className={[
                  "pb-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-text-muted",
                  c.numerica ? "text-right" : "text-left",
                  c.secundaria ? "hidden sm:table-cell" : "",
                ].join(" ")}
              >
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

export function Fila({ children }: { children: ReactNode }) {
  return <tr className="transition-colors hover:bg-surface-muted">{children}</tr>;
}

export function Celda({
  children,
  numerica,
  secundaria,
  principal,
}: {
  children: ReactNode;
  numerica?: boolean;
  secundaria?: boolean;
  /** La celda que identifica la fila. Se marca como cabecera de fila. */
  principal?: boolean;
}) {
  const clases = [
    "py-3 align-top text-sm",
    numerica
      ? // `tabular-nums` alinea los dígitos en columna: sin ello, un 1 ocupa
        // menos que un 8 y los importes bailan.
        "text-right tabular-nums text-espresso"
      : "text-left text-text-muted",
    secundaria ? "hidden sm:table-cell" : "",
  ].join(" ");

  if (principal) {
    return (
      <th scope="row" className={`${clases} font-medium text-espresso`}>
        {children}
      </th>
    );
  }
  return <td className={clases}>{children}</td>;
}

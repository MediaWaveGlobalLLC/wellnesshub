import Link from "next/link";

/**
 * Paginación por enlaces, sin JavaScript.
 *
 * Hasta ahora el panel usaba límites duros —25 usuarios, 30 movimientos, 50
 * pedidos, 100 entradas de auditoría— y no había forma de ver el 26. Peor: la
 * pantalla no decía que estuviera recortando, así que «no aparece» y «no
 * existe» se veían igual.
 *
 * Son `<Link>` y no botones para que cada página tenga su URL. Eso permite
 * compartirla, recargarla y volver atrás con el botón del navegador, que es lo
 * que la gente hace de verdad. Es el mismo criterio que ya sigue el buscador de
 * usuarios con su `<form method="get">`.
 */
export function Paginacion({
  pagina,
  porPagina,
  total,
  base,
  parametros,
}: {
  pagina: number;
  porPagina: number;
  total: number;
  /** Ruta sin query, p. ej. "/admin/usuarios". */
  base: string;
  /** Filtros vigentes que hay que conservar al cambiar de página. */
  parametros?: Record<string, string | undefined>;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas <= 1) return null;

  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);

  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(parametros ?? {})) {
      if (v) q.set(k, v);
    }
    if (p > 1) q.set("pagina", String(p));
    const cadena = q.toString();
    return cadena ? `${base}?${cadena}` : base;
  };

  const enlace =
    "text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-espresso underline decoration-terracota decoration-2 underline-offset-[6px] transition-colors hover:text-primary-hover";
  // Sin `pointer-events-none`: un enlace deshabilitado simplemente no se
  // renderiza. Un enlace que se ve pero no responde confunde más que su
  // ausencia.
  const inerte = "text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-text-muted/50";

  return (
    <nav
      aria-label="Paginación"
      className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4"
    >
      <p className="text-xs text-text-muted">
        Mostrando {desde}–{hasta} de {total}
      </p>

      <div className="flex items-center gap-5">
        {pagina > 1 ? (
          <Link href={href(pagina - 1)} className={enlace} rel="prev">
            Anterior
          </Link>
        ) : (
          <span className={inerte}>Anterior</span>
        )}

        <span className="text-xs text-text-muted">
          Página {pagina} de {paginas}
        </span>

        {pagina < paginas ? (
          <Link href={href(pagina + 1)} className={enlace} rel="next">
            Siguiente
          </Link>
        ) : (
          <span className={inerte}>Siguiente</span>
        )}
      </div>
    </nav>
  );
}

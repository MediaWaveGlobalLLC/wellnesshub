import { LoadingSkeleton } from "@/components/states";

/**
 * Esqueleto mientras carga una sección del panel.
 *
 * Solo en `/admin`, no en la raíz. Un `loading.tsx` en la raíz envolvería toda
 * la web pública en un Suspense y podría alterar el renderizado inicial de las
 * páginas que sí están en el baseline visual. El panel es dinámico por
 * definición —`force-dynamic` en cada página— así que es donde de verdad hay
 * una espera que enseñar.
 */
export default function CargandoAdmin() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      <LoadingSkeleton filas={4} />
    </div>
  );
}

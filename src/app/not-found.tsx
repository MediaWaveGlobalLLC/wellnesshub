import type { Metadata } from "next";

import { EmptyState } from "@/components/states";
import { LeafIcon } from "@/components/icons";

/**
 * 404 de la aplicación.
 *
 * Tampoco existía. Y desde ahora se ve más: la ficha de usuario responde 404
 * ante un id malformado, y las secciones de solo-dueña responden 404 a un
 * empleado en vez de 403, para no confirmar que existen.
 */
export const metadata: Metadata = {
  title: "Página no encontrada",
  robots: { index: false, follow: false },
};

export default function NoEncontrado() {
  return (
    <div className="grain min-h-screen bg-leche pt-32">
      <div className="mx-auto max-w-2xl px-5 pb-24 sm:px-8">
        <EmptyState
          icono={<LeafIcon size={32} className="text-terracota" />}
          titulo="Aquí no hay nada"
          descripcion="La página que buscas no existe o cambió de sitio."
          accion={{ href: "/", texto: "Volver al inicio" }}
        />
      </div>
    </div>
  );
}

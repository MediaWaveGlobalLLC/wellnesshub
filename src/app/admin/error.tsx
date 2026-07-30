"use client";

import { ErrorState } from "@/components/states";

/**
 * Error dentro del panel.
 *
 * Separado del de la raíz para que un fallo consultando la base no tire abajo
 * la cabecera ni la navegación del panel: quien está administrando sigue
 * pudiendo irse a otra sección sin volver a entrar.
 *
 * Igual que el de la raíz: nunca se pinta `error.message`. En una pantalla de
 * administración la tentación de enseñarlo es mayor —«así se depura antes»— y
 * es justo donde más caro sale, porque los errores de aquí vienen de consultas
 * con nombres de tabla y de columnas.
 */
export default function ErrorAdmin({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="py-6">
      <ErrorState
        titulo="Esta sección no cargó"
        descripcion="Puede ser un problema momentáneo con la base de datos. Reintenta; si persiste, revisa los registros del servidor con la referencia de abajo."
        onReintentar={reset}
      />
      {error.digest && (
        <p className="mt-6 text-center text-[0.65rem] text-text-muted">
          Referencia: {error.digest}
        </p>
      )}
    </div>
  );
}

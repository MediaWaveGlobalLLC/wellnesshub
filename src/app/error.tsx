"use client";

import { ErrorState } from "@/components/states";

/**
 * Pantalla de error de la aplicación.
 *
 * No existía ninguna: cualquier excepción no capturada caía en la pantalla por
 * defecto de Next, que en producción es una página en blanco con un texto en
 * inglés. Para una cafetería en Condado eso no es aceptable.
 *
 * `"use client"` es obligatorio: Next exige que los límites de error lo sean.
 *
 * NO se muestra `error.message`. En producción Next ya lo enmascara, pero el
 * hábito importa: un mensaje de error puede llevar un nombre de tabla, una
 * consulta o parte de una clave. Se enseña el `digest`, que es lo que permite
 * encontrar la traza real en los registros del servidor.
 */
export default function ErrorApp({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="grain min-h-screen bg-leche pt-32">
      <div className="mx-auto max-w-2xl px-5 pb-24 sm:px-8">
        <ErrorState
          descripcion="Algo se rompió por nuestro lado. Puedes reintentar; si sigue igual, escríbenos y lo miramos."
          onReintentar={reset}
        />
        {error.digest && (
          <p className="mt-6 text-center text-[0.65rem] text-text-muted">
            Referencia: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}

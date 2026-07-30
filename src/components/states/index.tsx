import type { ReactNode } from "react";
import { Alert, Card, Skeleton } from "@/components/ui/Surface";
import { ButtonLink } from "@/components/ui/Button";

/**
 * Estados obligatorios — docs/02 los exige en TODA pantalla:
 * loading, empty, error recuperable, success, disabled/processing y sesión expirada.
 *
 * Se centralizan aquí para que ninguna pantalla los improvise.
 */

/** Skeleton editorial acorde a la marca (nunca un spinner genérico). */
export function LoadingSkeleton({ filas = 3 }: { filas?: number }) {
  return (
    <Card className="p-6" aria-busy>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-8 w-2/3" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: filas }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
      <span className="sr-only">Cargando…</span>
    </Card>
  );
}

/** Vacío útil: dice qué falta y ofrece la acción siguiente. */
export function EmptyState({
  icono,
  titulo,
  descripcion,
  accion,
}: {
  icono?: ReactNode;
  titulo: string;
  descripcion: string;
  accion?: { href: string; texto: string };
}) {
  return (
    <Card className="px-6 py-12 text-center">
      {icono && <div className="mx-auto mb-4 text-text-muted">{icono}</div>}
      <p className="font-serif text-xl text-espresso">{titulo}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-text-muted">
        {descripcion}
      </p>
      {accion && (
        <div className="mt-6">
          <ButtonLink href={accion.href} variant="secundario" size="md">
            {accion.texto}
          </ButtonLink>
        </div>
      )}
    </Card>
  );
}

/** Error recuperable: explica y permite reintentar. */
export function ErrorState({
  titulo = "Algo no cargó bien",
  descripcion,
  onReintentar,
}: {
  titulo?: string;
  descripcion: string;
  onReintentar?: () => void;
}) {
  return (
    <Alert tono="error" titulo={titulo}>
      <p>{descripcion}</p>
      {onReintentar && (
        <button
          type="button"
          onClick={onReintentar}
          className="mt-3 text-xs font-bold uppercase tracking-[0.1em] underline decoration-2 underline-offset-4"
        >
          Reintentar
        </button>
      )}
    </Alert>
  );
}

/** Confirmación de éxito. */
export function SuccessState({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <Alert tono="exito" titulo={titulo}>
      {descripcion}
    </Alert>
  );
}

/** Sesión expirada — el usuario debe volver a entrar. */
export function SessionExpired() {
  return (
    <Card className="px-6 py-10 text-center">
      <p className="font-serif text-xl text-espresso">Tu sesión expiró</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-text-muted">
        Por seguridad cerramos la sesión tras un período de inactividad. Vuelve a
        entrar para continuar donde quedaste.
      </p>
      <div className="mt-6">
        <ButtonLink href="/iniciar-sesion" size="md">
          Iniciar sesión
        </ButtonLink>
      </div>
    </Card>
  );
}

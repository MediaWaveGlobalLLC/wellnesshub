"use client";

import {
  useId,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn";
import { ChevronIcon } from "@/components/icons";

/**
 * Campos que `components/ui/Field.tsx` no tiene: desplegable y texto largo.
 *
 * VIVEN AQUÍ Y NO EN `components/ui/`. El baseline visual cubre /registro,
 * /perfil, /wallet y /gift-cards, y esas cuatro importan de `components/ui/`:
 * tocar ese directorio pone en juego el gate visual por unos campos que hoy
 * solo usa el panel. El precio es duplicar las clases del control; cuando estos
 * campos se usen fuera del admin, se promueven y se regeneran las capturas a la
 * vez.
 *
 * Las reglas de accesibilidad son las mismas que en `Field`: label real
 * siempre, error asociado por `aria-describedby` y `role="alert"`.
 */

const CONTROL =
  "w-full min-h-[var(--control-height)] rounded-lg border border-border bg-surface " +
  "px-4 text-espresso placeholder:text-text-muted/60 " +
  "transition-colors duration-200 focus:border-terracota focus:outline-none " +
  "disabled:cursor-not-allowed disabled:opacity-50";

type Comun = {
  label: string;
  labelOculto?: boolean;
  error?: string;
  ayuda?: string;
};

function Envoltura({
  label,
  labelOculto,
  error,
  ayuda,
  fieldId,
  children,
}: Comun & { fieldId: string; children: ReactNode }) {
  return (
    <div className="w-full">
      <label
        htmlFor={fieldId}
        className={cn(
          "mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-muted",
          labelOculto && "sr-only"
        )}
      >
        {label}
      </label>

      {children}

      {ayuda && !error && (
        <p id={`${fieldId}-ayuda`} className="mt-1.5 text-xs text-text-muted">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={`${fieldId}-error`} role="alert" className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function Select({
  label,
  labelOculto,
  error,
  ayuda,
  id,
  className,
  children,
  ...select
}: Comun & SelectHTMLAttributes<HTMLSelectElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;

  return (
    <Envoltura
      label={label}
      labelOculto={labelOculto}
      error={error}
      ayuda={ayuda}
      fieldId={fieldId}
    >
      <div className="relative">
        <select
          id={fieldId}
          // `appearance-none` quita la flecha del sistema, que en Windows es
          // gris azulada y desentona con la paleta. La nuestra va debajo.
          className={cn(CONTROL, "appearance-none pr-11", error && "border-danger", className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : ayuda ? `${fieldId}-ayuda` : undefined}
          {...select}
        >
          {children}
        </select>
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-muted">
          <ChevronIcon size={16} />
        </span>
      </div>
    </Envoltura>
  );
}

export function Textarea({
  label,
  labelOculto,
  error,
  ayuda,
  id,
  className,
  rows = 3,
  ...area
}: Comun & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;

  return (
    <Envoltura
      label={label}
      labelOculto={labelOculto}
      error={error}
      ayuda={ayuda}
      fieldId={fieldId}
    >
      <textarea
        id={fieldId}
        rows={rows}
        // `py-3` porque el `min-h` de una sola línea no aplica igual a un
        // textarea: sin esto el texto queda pegado al borde superior.
        className={cn(CONTROL, "py-3 leading-relaxed", error && "border-danger", className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : ayuda ? `${fieldId}-ayuda` : undefined}
        {...area}
      />
    </Envoltura>
  );
}

/**
 * Campo de dinero: se escribe en dólares, se envía en centavos.
 *
 * Es el mismo criterio que ya justifica `AjusteForm`: pedirle centavos a una
 * persona es una invitación a equivocarse por cien. Acepta coma decimal, que es
 * lo que teclea media Puerto Rico.
 */
export function CampoDinero({
  label,
  labelOculto,
  error,
  ayuda,
  id,
  name,
  defaultValue,
  className,
  ...input
}: Comun & {
  name: string;
  /** En CENTAVOS. Se muestra en dólares. */
  defaultValue?: number;
} & Omit<SelectHTMLAttributes<HTMLInputElement>, "defaultValue">) {
  const autoId = useId();
  const fieldId = id ?? autoId;

  return (
    <Envoltura
      label={label}
      labelOculto={labelOculto}
      error={error}
      ayuda={ayuda}
      fieldId={fieldId}
    >
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
          $
        </span>
        <input
          id={fieldId}
          name={name}
          type="text"
          inputMode="decimal"
          defaultValue={defaultValue !== undefined ? (defaultValue / 100).toFixed(2) : undefined}
          className={cn(CONTROL, "pl-8 tabular-nums", error && "border-danger", className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : ayuda ? `${fieldId}-ayuda` : undefined}
          {...input}
        />
      </div>
    </Envoltura>
  );
}

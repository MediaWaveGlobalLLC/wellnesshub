"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Campos de formulario SIEMBRA — derivados del mockup 01 (Registro).
 *
 * Composición del mockup: superficie clara, borde fino, icono de línea a la
 * izquierda, altura ~50px (tokens.controls.height) y radio suave.
 *
 * docs/07 exige labels reales y mensajes de error asociados por `aria-describedby`.
 * El label puede ocultarse visualmente, pero nunca eliminarse.
 */

const CONTROL =
  "w-full min-h-[var(--control-height)] rounded-lg border border-border bg-surface " +
  "px-4 text-espresso placeholder:text-text-muted/60 " +
  "transition-colors duration-200 focus:border-terracota focus:outline-none " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export type FieldProps = {
  label: string;
  /** Oculta el label visualmente pero lo mantiene para lectores de pantalla. */
  labelOculto?: boolean;
  error?: string;
  ayuda?: string;
  icono?: ReactNode;
  children?: ReactNode;
};

export function Field({
  label,
  labelOculto,
  error,
  ayuda,
  icono,
  id,
  className,
  ...input
}: FieldProps & Omit<InputHTMLAttributes<HTMLInputElement>, "children">) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const errorId = `${fieldId}-error`;
  const ayudaId = `${fieldId}-ayuda`;

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

      <div className="relative">
        {icono && (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
            {icono}
          </span>
        )}
        <input
          id={fieldId}
          className={cn(CONTROL, icono ? "pl-12" : null, error ? "border-danger" : null, className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={cn(error ? errorId : null, ayuda ? ayudaId : null) || undefined}
          {...input}
        />
      </div>

      {ayuda && !error && (
        <p id={ayudaId} className="mt-2 text-xs text-text-muted">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-xs font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Campo de contraseña con alternador de visibilidad (mockup 01). */
export function PasswordField({
  label,
  error,
  icono,
  id,
  ...input
}: FieldProps & Omit<InputHTMLAttributes<HTMLInputElement>, "children" | "type">) {
  const [visible, setVisible] = useState(false);
  const autoId = useId();
  const fieldId = id ?? autoId;

  return (
    <div className="relative">
      <Field
        {...input}
        id={fieldId}
        label={label}
        error={error}
        icono={icono}
        type={visible ? "text" : "password"}
        className="pr-12"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute right-3 top-[2.35rem] rounded-sm p-2 text-text-muted transition-colors hover:text-espresso"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2.2 12S6 5.4 12 5.4 21.8 12 21.8 12 18 18.6 12 18.6 2.2 12 2.2 12Z" />
          <circle cx="12" cy="12" r="3.1" />
          {!visible && <path d="M4 20 20 4" />}
        </svg>
      </button>
    </div>
  );
}

/** Casilla de consentimiento — Términos y Privacidad del mockup 01. */
export function Checkbox({
  label,
  error,
  id,
  ...input
}: { label: ReactNode; error?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "children">) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const errorId = `${fieldId}-error`;

  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          id={fieldId}
          type="checkbox"
          className="mt-0.5 h-5 w-5 flex-none rounded-sm border border-border accent-terracota"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          {...input}
        />
        <label htmlFor={fieldId} className="text-sm leading-relaxed text-espresso">
          {label}
        </label>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-xs font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

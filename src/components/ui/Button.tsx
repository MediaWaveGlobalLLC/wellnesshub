import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Botón SIEMBRA.
 *
 * · `variant` sale de los mockups: terracota sólido (primario), contorno espresso
 *   (secundario), forest sólido (canje/wallet) y enlace subrayado (terciario).
 * · `shape="pill"` es el CTA redondo del header ("ORDENA ONLINE"); `shape="soft"`
 *   es el radio 16px del formulario de registro. Nunca se supera el máximo de 24px.
 * · Altura mínima 48px (tokens.controls.buttonMinHeight).
 */
export type ButtonVariant = "primario" | "secundario" | "forest" | "terciario";
export type ButtonShape = "pill" | "soft";
export type ButtonSize = "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primario: "bg-terracota text-leche hover:bg-primary-hover shadow-warm",
  secundario:
    "border-[1.5px] border-espresso/30 text-espresso hover:border-espresso hover:bg-espresso hover:text-leche",
  forest: "bg-forest text-avena hover:bg-olive",
  terciario:
    "text-espresso underline decoration-terracota decoration-2 underline-offset-[6px] hover:text-terracota",
};

const SIZES: Record<ButtonSize, string> = {
  md: "px-6 py-3 text-xs",
  lg: "px-8 py-4 text-sm",
};

const BASE =
  "inline-flex items-center justify-center gap-3 font-bold uppercase tracking-[0.08em] " +
  "transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-45";

type Estilo = {
  variant?: ButtonVariant;
  shape?: ButtonShape;
  size?: ButtonSize;
  className?: string;
};

/** `className` va al final para que el consumidor pueda ajustar sin perder la base. */
function estilos({ variant = "primario", shape = "soft", size = "lg", className }: Estilo) {
  return cn(
    BASE,
    VARIANTS[variant],
    SIZES[size],
    shape === "pill" ? "btn-pill" : "min-h-[48px] rounded-lg",
    className
  );
}

export function Button({
  children,
  cargando,
  disabled,
  variant,
  shape,
  size,
  className,
  ...rest
}: Estilo & {
  children: ReactNode;
  /** Muestra estado de proceso y bloquea la interacción. docs/02 lo exige. */
  cargando?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">) {
  return (
    <button
      {...rest}
      className={estilos({ variant, shape, size, className })}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
    >
      {cargando ? "Procesando…" : children}
    </button>
  );
}

export function ButtonLink({
  href,
  children,
  variant,
  shape,
  size,
  className,
}: Estilo & { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={estilos({ variant, shape, size, className })}>
      {children}
    </Link>
  );
}

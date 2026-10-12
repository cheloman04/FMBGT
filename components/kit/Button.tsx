import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-500/60 " +
  "disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none";

/**
 * 🪤 El primario es PLANO: un relleno de acento, sin degradado, sin borde
 * interior, sin halo. La respuesta al pasar y al pulsar es un cambio de BRILLO,
 * no de color: una sola regla que vale para cualquier acento de cliente.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-ac-500 text-ac-contrast transition-[filter,transform] duration-150 " +
    "hover:brightness-107 active:brightness-94 active:translate-y-px",
  secondary: "border border-hairline text-fg-2 transition-colors duration-150 hover:bg-surface-muted",
  ghost: "text-fg-2 transition-colors duration-150 hover:bg-surface-muted hover:text-fg",
  danger:
    "border border-tone-red/30 bg-tone-red/10 text-tone-red transition-colors duration-150 hover:bg-tone-red/20",
};

/**
 * 🪤 En el teléfono los dos tamaños llegan a 44px (`min-h-11`), el mínimo táctil
 * del estándar (§1). El escritorio no cambia.
 */
const SIZES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs max-sm:min-h-11",
  md: "px-4 py-2 text-sm max-sm:min-h-11",
};

/**
 * Las clases de un botón sin el elemento: para un `<Link>` con aspecto de botón.
 * Una sola `primary` por pantalla (§7.5).
 *
 * `layout` es solo maquetación (`w-full`, `self-end`, `shrink-0`): nunca color,
 * relleno ni tamaño de letra, que chocarían con la base sin `tailwind-merge`.
 */
export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", layout?: string): string {
  return cx(BASE, VARIANTS[variant], SIZES[size], layout);
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  layout,
  children,
  disabled,
  type = "button",
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Spinner y deshabilitado. La etiqueta dice qué está pasando ("Saving…"). */
  loading?: boolean;
  /** Solo maquetación (`w-full`, `self-end`). Ver `buttonClasses`. */
  layout?: string;
  children: ReactNode;
}) {
  return (
    <button type={type} disabled={disabled || loading} className={buttonClasses(variant, size, layout)} {...rest}>
      {loading ? (
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 flex-shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
        />
      ) : null}
      {children}
    </button>
  );
}

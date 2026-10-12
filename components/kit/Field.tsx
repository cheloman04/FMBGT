"use client";

// `ComponentPropsWithRef` y no `*HTMLAttributes`: en React 19 `ref` es una prop
// normal, y un `<input type="file">` la necesita para leer el fichero elegido.
import { useId, type ComponentPropsWithRef, type ReactNode } from "react";
import { cx } from "./cx";

/**
 * Un campo es un HUECO donde se escribe, no una tarjeta que sobresale: superficie
 * hundida (`bg-surface-muted`) y el filete del sistema. Lo escrito en `text-fg`;
 * el marcador en `text-fg-disabled`, que es justo para lo que existe ese gris.
 *
 * 🪤 `max-sm:text-base`: por debajo de 16px iOS hace zoom al enfocar el campo y
 * descoloca la página entera.
 */
export const FIELD_CLASSES =
  "w-full rounded-lg border border-hairline bg-surface-muted px-3 py-2 text-sm text-fg max-sm:text-base " +
  "placeholder:text-fg-disabled transition-colors " +
  "focus:border-ac-500/60 focus:outline-none focus:ring-1 focus:ring-ac-500/40 " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "aria-[invalid=true]:border-tone-red/60";

/**
 * El desplegable nativo de un `<select>` NO hereda las clases del control: sin
 * esto sus filas salen del color del sistema. El esquema (`color-scheme`) ya lo
 * pone `[data-kit]` desde el tema; aquí, el relleno sólido de cada opción.
 */
export const SELECT_OPTION_CLASSES = "[&>option]:bg-surface [&>option]:text-fg";

/** La etiqueta de un campo. Exportada para los controles que no son de este fichero. */
export const FIELD_LABEL_CLASSES = "mb-1.5 block text-xs font-medium text-fg-muted";

export type FieldChrome = {
  label?: string;
  /** Esconde la etiqueta a la vista, pero la deja para el lector de pantalla. */
  labelHidden?: boolean;
  /** Mensaje de error, ya traducido. Pinta el campo en rojo y lo anuncia. */
  error?: string;
  hint?: string;
  /** Solo maquetación del contenedor (`sm:col-span-2`, `max-w-xs`). Nunca color. */
  layout?: string;
};

export function FieldShell({
  id,
  label,
  labelHidden,
  error,
  hint,
  layout,
  children,
}: FieldChrome & { id: string; children: ReactNode }) {
  // 🪤 Un `sr-only` es `position: absolute` sin `top`: sin un contenedor
  // posicionado, Chrome lo coloca lejísimos y estira el scroll de la página.
  // El `relative` le da un bloque contenedor de verdad, solo cuando hace falta.
  const hidden = Boolean(label && labelHidden);
  return (
    <div className={cx(hidden && "relative", layout)}>
      {label ? (
        <label htmlFor={id} className={hidden ? "sr-only" : FIELD_LABEL_CLASSES}>
          {label}
        </label>
      ) : null}
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-fg-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-tone-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, { error, hint }: FieldChrome): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

type Native<T extends "input" | "textarea" | "select"> = Omit<ComponentPropsWithRef<T>, "className">;

export function Input({ label, labelHidden, error, hint, layout, id: idProp, ...rest }: Native<"input"> & FieldChrome) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell {...{ id, label, labelHidden, error, hint, layout }}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, { error, hint })}
        className={FIELD_CLASSES}
        {...rest}
      />
    </FieldShell>
  );
}

export function Textarea({
  label,
  labelHidden,
  error,
  hint,
  layout,
  id: idProp,
  ...rest
}: Native<"textarea"> & FieldChrome) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell {...{ id, label, labelHidden, error, hint, layout }}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, { error, hint })}
        className={cx(FIELD_CLASSES, "min-h-[80px]")}
        {...rest}
      />
    </FieldShell>
  );
}

/** El `<select>` nativo con el estilo del kit. Para un menú con marca, `SelectMenu`. */
export function Select({
  label,
  labelHidden,
  error,
  hint,
  layout,
  id: idProp,
  children,
  ...rest
}: Native<"select"> & FieldChrome) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell {...{ id, label, labelHidden, error, hint, layout }}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, { error, hint })}
        className={cx(FIELD_CLASSES, SELECT_OPTION_CLASSES)}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
}

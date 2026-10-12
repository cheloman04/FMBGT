import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * El marco de toda página de dashboard: una sola medida, `max-w-6xl`.
 *
 * Una columna con su propio tope se lee como otra anchura de página aunque el
 * marco coincida; por eso no hay medidas por página (§6.1).
 */
export function PageShell({
  children,
  fill = false,
  nested = false,
  padding = "p-4 sm:p-6",
}: {
  children: ReactNode;
  /** Columna a toda altura que gestiona su propio scroll (un chat, un tablero). */
  fill?: boolean;
  /**
   * Solo la medida, sin lienzo propio. Obligatorio dentro de un sub-shell que ya
   * pinta el lienzo, o dentro de una vista embebida.
   */
  nested?: boolean;
  /** Relleno reemplazable (no un `className` que lo pise: §6.3). */
  padding?: string;
}) {
  const inner = (
    <div className={cx("mx-auto max-w-6xl", padding, fill && "flex flex-col lg:h-full lg:min-h-0")}>
      {children}
    </div>
  );

  if (nested) return inner;

  // 3.5rem es la barra superior del shell en el teléfono; en escritorio no hay.
  return (
    <div className={cx("bg-canvas min-h-[calc(100dvh-3.5rem)] md:min-h-dvh", fill && "lg:h-full")}>{inner}</div>
  );
}

/**
 * La cabecera de página. Su `<h1>` es el ÚNICO de la página.
 *
 * Como mucho una acción primaria en `actions` (§7.5): si hay dos botones de
 * acento, no hay acción primaria.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  titleAside,
  icon,
  actions,
  actionsFill = false,
  actionsSpread = false,
  spacing = "mb-6",
  as = "h1",
}: {
  /** Micro-etiqueta encima del título (el área o la sección del producto). */
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Algo que acompaña al título en su misma línea: un badge de estado, un selector. */
  titleAside?: ReactNode;
  icon?: ReactNode;
  /** Botones o selectores a la derecha del título. Una sola acción primaria. */
  actions?: ReactNode;
  /** En el teléfono las acciones ocupan la fila entera. */
  actionsFill?: boolean;
  /** Las acciones se reparten a lo ancho (`justify-between`). */
  actionsSpread?: boolean;
  /** Margen inferior reemplazable. */
  spacing?: string;
  /**
   * Nivel del encabezado. `h1` por defecto, que es la invariante. Una vista
   * EMBEBIDA dentro de otra página baja a `h2`/`h3`: dos `<h1>` dejan a un
   * lector de pantalla sin saber cuál es el título.
   */
  as?: "h1" | "h2" | "h3";
}) {
  const Heading = as;
  return (
    <div className={cx(spacing, "flex flex-wrap items-start justify-between gap-4")}>
      {/* 🪤 Base 13rem, no 0: con `flex-1` a secas las acciones nunca bajaban a
          su propia línea y en el teléfono el título se quedaba con ~80px. */}
      <div className="flex min-w-0 flex-[1_1_13rem] flex-wrap items-center gap-x-6 gap-y-3 md:gap-x-10">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? <span className="mt-1 flex-shrink-0">{icon}</span> : null}
          <div className="min-w-0">
            {eyebrow ? <p className="kit-eyebrow">{eyebrow}</p> : null}
            <Heading className="mt-2 text-2xl font-semibold tracking-tight text-fg sm:text-[2.2rem]">{title}</Heading>
            {subtitle ? <p className="mt-1 text-sm text-fg-muted">{subtitle}</p> : null}
          </div>
        </div>
        {titleAside}
      </div>
      {actions ? (
        <div
          className={cx(
            "flex flex-wrap items-center gap-2",
            actionsFill && "max-sm:w-full",
            actionsSpread && "flex-1 justify-between self-center",
          )}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Título de un grupo (una pila o una rejilla) sobre el lienzo: el nivel entre el
 * título de página y la etiqueta de una sección.
 */
export function GroupHeader({
  title,
  subtitle,
  action,
  icon,
  id,
  spacing = "mb-3",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Enlace o nota alineada a la derecha. */
  action?: ReactNode;
  icon?: ReactNode;
  /** Para un `aria-labelledby` de la sección que titula. */
  id?: string;
  spacing?: string;
}) {
  return (
    <div className={cx(spacing, "flex flex-wrap items-end justify-between gap-2")}>
      <div className="min-w-0">
        <h2 id={id} className="flex items-center gap-2 text-base font-semibold text-fg">
          {icon ? <span className="flex-shrink-0 text-fg-muted">{icon}</span> : null}
          {title}
        </h2>
        {subtitle ? <p className="mt-0.5 text-xs text-fg-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex-shrink-0">{action}</div> : null}
    </div>
  );
}

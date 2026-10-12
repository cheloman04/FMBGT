import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * Qué papel hace una columna en el TELÉFONO, donde la tabla pasa a filas:
 *
 *   [primary, en negrita]                   [status]
 *   [secondary]
 *   [meta · meta · meta]
 *   [actions]
 *
 * `hidden`: solo en escritorio.
 */
export type MobileRole = "primary" | "secondary" | "meta" | "status" | "actions" | "hidden";

export type Column<T> = {
  key: string;
  /** Cabecera de la columna en escritorio. */
  header: string;
  cell: (row: T) => ReactNode;
  /** Las cifras van a la derecha. */
  align?: "left" | "right";
  /** Ancho en escritorio, como clase (`w-32`, `w-[8rem]`). Solo maquetación. */
  width?: string;
  /** Papel en el teléfono. Por defecto, la primera columna es `primary` y el resto `meta`. */
  mobile?: MobileRole;
  /**
   * La celda tiene botones o enlaces propios. Con `rowHref` toda la fila es un
   * enlace; esto sube la celda por encima de él para que sus controles respondan.
   */
  interactive?: boolean;
};

const ALIGN = { left: "text-left", right: "text-right" } as const;
const ROW_PADDING = { operate: "py-2.5", report: "py-4" } as const;

/**
 * Una lista de registros: TABLA en escritorio y FILAS en el teléfono, desde una
 * sola definición de columnas (§6.4). Nada de escribir la tabla y las tarjetas por
 * separado: en FMBGT esa pareja estaba repetida tres veces, y una de las tres
 * copias ya enseñaba datos distintos.
 *
 * Filas sobre el lienzo separadas por filetes, sin caja (§7.6). Con `rowHref`
 * toda la fila es un enlace (al detalle, o a `?booking=id` para abrir un Drawer).
 *
 * Sin hooks: sirve igual en una página de servidor que dentro de una isla.
 */
export function ResponsiveList<T>({
  rows,
  columns,
  rowKey,
  rowHref,
  caption,
  density = "operate",
  empty,
}: {
  rows: readonly T[];
  columns: ReadonlyArray<Column<T>>;
  rowKey: (row: T) => string;
  /** Destino de la fila entera. */
  rowHref?: (row: T) => string;
  /** Qué es la lista, para el lector de pantalla ("Bookings"). No se ve. */
  caption: string;
  /** `operate` (filas de 40–44px, el admin) o `report` (56–64px, el portal). §1. */
  density?: keyof typeof ROW_PADDING;
  /** Lo que se pinta sin filas: un `EmptyState`. */
  empty?: ReactNode;
}) {
  if (rows.length === 0) return <>{empty ?? null}</>;
  const role = (col: Column<T>, i: number): MobileRole => col.mobile ?? (i === 0 ? "primary" : "meta");
  // La columna que lleva el enlace de la fila: la primaria.
  const linkIndex = Math.max(0, columns.findIndex((c, i) => role(c, i) === "primary"));

  return (
    <div>
      {/* ── Escritorio: tabla ─────────────────────────────────────────── */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-hairline">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cx(
                    "px-3 pb-2.5 text-[10px] font-semibold uppercase tracking-wider text-fg-muted first:pl-0 last:pr-0",
                    ALIGN[col.align ?? "left"],
                    col.width,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const href = rowHref?.(row);
              return (
                // `relative` en la fila: el enlace de la celda primaria se estira
                // sobre ella entera (`after:inset-0`).
                <tr key={rowKey(row)} className={cx("relative border-b border-hairline", href && "hover:bg-surface-muted")}>
                  {columns.map((col, i) => {
                    const content = col.cell(row);
                    return (
                      <td
                        key={col.key}
                        className={cx(
                          "px-3 align-middle text-fg-2 first:pl-0 last:pr-0",
                          ROW_PADDING[density],
                          ALIGN[col.align ?? "left"],
                          i === linkIndex && "font-medium text-fg",
                        )}
                      >
                        {href && i === linkIndex ? (
                          <Link
                            href={href}
                            className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ac-500/60"
                          >
                            {content}
                          </Link>
                        ) : col.interactive ? (
                          <div className="relative z-[1]">{content}</div>
                        ) : (
                          content
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Teléfono: filas ──────────────────────────────────────────────
          Sin filete arriba: el de la Section (o la cabecera) ya separa. Un filete,
          no dos. */}
      <ul className="divide-y divide-hairline border-b border-hairline md:hidden" aria-label={caption}>
        {rows.map((row) => {
          const href = rowHref?.(row);
          const pick = (r: MobileRole) => columns.filter((c, i) => role(c, i) === r);
          const primary = pick("primary");
          const secondary = pick("secondary");
          const meta = pick("meta");
          const status = pick("status");
          const actions = pick("actions");
          return (
            <li key={rowKey(row)} className={cx("relative flex flex-col gap-1 py-3", href && "active:bg-surface-muted")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 text-sm font-semibold text-fg">
                  {href ? (
                    <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
                      {primary.map((c) => (
                        <span key={c.key}>{c.cell(row)}</span>
                      ))}
                    </Link>
                  ) : (
                    primary.map((c) => <span key={c.key}>{c.cell(row)}</span>)
                  )}
                </div>
                {status.length ? (
                  <div className="relative z-[1] flex flex-shrink-0 items-center gap-1.5">
                    {status.map((c) => (
                      <span key={c.key}>{c.cell(row)}</span>
                    ))}
                  </div>
                ) : null}
              </div>
              {secondary.map((c) => (
                <div key={c.key} className="text-sm text-fg-2">
                  {c.cell(row)}
                </div>
              ))}
              {meta.length ? (
                <div className="flex flex-wrap gap-x-1.5 text-xs text-fg-muted">
                  {meta.map((c, i) => (
                    <span key={c.key} className="inline-flex items-center gap-1.5">
                      {i > 0 ? <span aria-hidden="true">·</span> : null}
                      {c.cell(row)}
                    </span>
                  ))}
                </div>
              ) : null}
              {actions.length ? (
                <div className="relative z-[1] mt-1.5 flex flex-wrap gap-2">
                  {actions.map((c) => (
                    <div key={c.key}>{c.cell(row)}</div>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

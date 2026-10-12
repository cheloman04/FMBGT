"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { IconCheck, IconChevronDown, IconSliders, IconX } from "./_icons";
import { cx } from "./cx";
import { useDialogBehavior } from "./useDialogBehavior";

export type FilterSheetOption = {
  /** `null` = sin filtro (el "todas"). */
  value: string | null;
  label: string;
  count: number;
  /** Cada opción NAVEGA: el filtro vive en la URL (§4.7). */
  href: string;
};

export type FilterSheetLabels = {
  /** "Close filters": el clic en la veladura. */
  closeBackdrop: string;
  close: string;
  /** El recuento con filtro: `(shown, total) => "12 of 46"`. */
  count: (shown: number, total: number) => string;
};

const LABELS_EN: FilterSheetLabels = {
  closeBackdrop: "Close filters",
  close: "Close",
  count: (shown, total) => `${shown} of ${total}`,
};

/**
 * Un filtro de N alternativas excluyentes EN EL TELÉFONO: una barra a lo ancho,
 * con relleno de acento, que abre una hoja inferior. En escritorio no se pinta
 * (`md:hidden`): ahí el filtro es la fila de `MetricStrip` o de pestañas.
 *
 * 🪤 En 390px caben tres cifras en fila; el resto se iba por un `overflow-x` que
 * no anuncia que hay más. Por eso en el teléfono el mando es UNO y se ve.
 * 🪤 El rótulo nombra la DIMENSIÓN ("Status"), no su valor: dice qué abre el
 * botón y no cambia de ancho al filtrar. El valor vigente va a la derecha.
 */
export function FilterSheet({
  dimension,
  options,
  active,
  shown,
  total,
  dialogLabel,
  labels: labelsProp,
  spacing = "pb-4",
}: {
  /** La DIMENSIÓN, no su valor: "Status", "Fase". Es el rótulo del botón. */
  dimension: string;
  options: FilterSheetOption[];
  /** El valor vigente, o `undefined` cuando se ven todas. */
  active?: string;
  shown: number;
  total: number;
  /** Nombre accesible del diálogo: "Filter bookings". */
  dialogLabel: string;
  labels?: Partial<FilterSheetLabels>;
  /** Separación inferior reemplazable (§6.3). */
  spacing?: string;
}) {
  const labels = { ...LABELS_EN, ...labelsProp };
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogBehavior(open, () => setOpen(false), panelRef);
  const current = options.find((o) => o.value === (active ?? null)) ?? options[0];

  return (
    // El filete de cierre hace de borde superior de la lista de debajo: un filete, no dos.
    <div className={cx("border-b border-hairline md:hidden", spacing)}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl bg-ac-500 px-4 text-sm font-semibold text-ac-contrast transition-[filter] hover:brightness-107 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        {/* `flex-none`: si el lado derecho crece, se encoge él (que trunca), no el rótulo. */}
        <span className="flex flex-none items-center gap-2">
          <IconSliders className="h-4 w-4" />
          {dimension}
        </span>
        <span className="flex min-w-0 items-center gap-2 text-xs">
          {/* Mismo color que el botón, rebajado en opacidad: un gris de la escalera
              aquí sería texto claro sobre el acento, que es lo que falla AA. */}
          <span aria-live="polite" className="truncate">
            {current.label}
            <span className="opacity-80">
              {" · "}
              {active ? labels.count(shown, total) : total}
            </span>
          </span>
          <IconChevronDown className="h-4 w-4 flex-none opacity-80" />
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={dialogLabel}>
          <button
            type="button"
            aria-label={labels.closeBackdrop}
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full bg-canvas/70 backdrop-blur-sm"
          />
          <div
            ref={panelRef}
            className="kit-elevated absolute inset-x-0 bottom-0 flex max-h-[70dvh] flex-col rounded-b-none rounded-t-2xl border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)]"
          >
            <div className="flex flex-none items-center justify-between gap-3 border-b border-hairline px-5 py-4">
              <p className="text-sm font-semibold text-fg">{dimension}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={labels.close}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>
            {/* Elegir ya es aplicar: cada opción navega, no hay pie de "aplicar". */}
            <ul className="min-h-0 flex-1 divide-y divide-hairline overflow-y-auto overscroll-contain px-5">
              {options.map((o) => {
                const isActive = o.value === (active ?? null);
                return (
                  <li key={o.label}>
                    <Link
                      href={o.href}
                      onClick={() => setOpen(false)}
                      aria-current={isActive ? "page" : undefined}
                      className="flex min-h-12 items-center justify-between gap-3 py-3 text-sm transition-colors hover:bg-surface-muted"
                    >
                      <span className={isActive ? "font-semibold text-fg" : "text-fg-2"}>{o.label}</span>
                      <span className="flex items-center gap-2.5">
                        <span className="text-sm font-semibold tabular-nums text-fg">{o.count}</span>
                        {isActive ? (
                          <IconCheck className="h-4 w-4 flex-none text-ac-400" />
                        ) : (
                          <span className="h-4 w-4 flex-none" aria-hidden="true" />
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

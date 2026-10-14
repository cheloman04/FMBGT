"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconX } from "./_icons";
import { useDialogBehavior } from "./useDialogBehavior";

const WIDTH = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-2xl" } as const;

/**
 * El diálogo centrado: `role="dialog"`, `aria-modal`, clic en la veladura para
 * cerrar. La conducta (Escape, foco, scroll) vive en `useDialogBehavior`.
 *
 * Se monta con un PORTAL en el `[data-kit]` más cercano al sitio donde se pinta
 * (si no hay ninguno, en `document.body`): así sigue leyendo los tokens del
 * dashboard (§7.3) y funciona desde cualquier contexto de apilamiento.
 *
 * 🪤 Pintado en su sitio, `fixed` lo sacaba del flujo pero no de su contexto de
 * apilamiento: abierto desde una celda `interactive` de `ResponsiveList` (o desde
 * la línea de estado o de acciones del teléfono), que va en `relative z-[1]`, su
 * `z-[70]` se quedaba atrapado ahí dentro, y las filas de DESPUÉS pintaban sus
 * botones encima de la veladura, y respondían al clic.
 *
 * El sitio lo da un ancla vacía que sí se pinta en su sitio: su callback ref busca
 * el `[data-kit]` y lo guarda (sin efecto que haga `setState`). React aplica esa
 * actualización antes de pintar, así que el diálogo no parpadea. La conducta se
 * engancha cuando el panel ya está en el DOM, para que el foco entre en él.
 * Un `Modal` abierto en el render del servidor sale tras la hidratación.
 *
 * Para React el diálogo sigue siendo hijo de quien lo pinta: el contexto llega y
 * los eventos suben por ese árbol, no por el del DOM.
 *
 * 🪤 `.kit-elevated` es la única superficie con sombra: un diálogo es lo único
 * que de verdad flota. Mismo relleno que el lienzo; lo que dice que flota es la
 * veladura, el filete y la sombra (§7.6).
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  closeLabel = "Close",
}: {
  open: boolean;
  onClose: () => void;
  /** Título accesible del diálogo; se pinta como cabecera. */
  title: string;
  children: ReactNode;
  /** Botones de acción, alineados a la derecha. Una sola acción primaria. */
  footer?: ReactNode;
  size?: keyof typeof WIDTH;
  /** Nombre accesible de la X, ya traducido. */
  closeLabel?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [layer, setLayer] = useState<Element | null>(null);
  // Estable: con una flecha nueva en cada render, React la volvería a llamar en cada uno.
  const anchorRef = useCallback((anchor: HTMLSpanElement | null) => {
    if (anchor) setLayer(anchor.closest("[data-kit]") ?? document.body);
  }, []);
  useDialogBehavior(open && layer !== null, onClose, panelRef);

  if (!open) return null;

  return (
    <>
      <span ref={anchorRef} hidden />
      {layer
        ? createPortal(
            <div
              className="fixed inset-0 z-[70] flex items-center justify-center bg-canvas/70 p-4 text-left backdrop-blur-sm"
              onClick={onClose}
            >
              <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onClick={(e) => e.stopPropagation()}
                className={`kit-elevated max-h-[85dvh] w-full overflow-y-auto ${WIDTH[size]}`}
              >
                <div className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-4">
                  <h2 className="text-sm font-semibold text-fg">{title}</h2>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label={closeLabel}
                    // 44×44 en el teléfono: es la salida de todos los diálogos.
                    className="rounded-md p-1 text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-500/60 max-sm:flex max-sm:h-11 max-sm:w-11 max-sm:items-center max-sm:justify-center"
                  >
                    <IconX className="h-4 w-4" />
                  </button>
                </div>
                <div className="px-5 py-4">{children}</div>
                {footer ? (
                  <div className="flex flex-wrap justify-end gap-2 border-t border-hairline px-5 py-3.5">{footer}</div>
                ) : null}
              </div>
            </div>,
            layer,
          )
        : null}
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { IconX } from "./_icons";
import { cx } from "./cx";
import { useDialogBehavior } from "./useDialogBehavior";

const WIDTH = { md: "md:max-w-md", lg: "md:max-w-2xl" } as const;

/**
 * Un panel lateral: el detalle de una fila sin salir de la lista (§6.4). En el
 * teléfono ocupa la pantalla entera.
 *
 * Dos formas de cerrarlo:
 *   · `closeHref`: desde una página de SERVIDOR, sin pasar funciones. El drawer
 *     vive en la URL (`?booking=42`); cerrar es navegar a la lista sin el
 *     parámetro (`withParam(path, params, "booking", null)`). Se puede compartir y
 *     el botón Atrás lo cierra.
 *   · `onClose`: desde una isla, con el estado en el cliente.
 *
 * Se pinta en su sitio (sin portal), dentro de `[data-kit]`, como `Modal`.
 */
export function Drawer({
  open,
  title,
  children,
  footer,
  onClose,
  closeHref,
  size = "md",
  closeLabel = "Close",
}: {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  /** Acciones fijas abajo. Una sola primaria. */
  footer?: ReactNode;
  onClose?: () => void;
  closeHref?: string;
  size?: keyof typeof WIDTH;
  closeLabel?: string;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => {
    if (onClose) onClose();
    else if (closeHref) router.push(closeHref, { scroll: false });
  }, [onClose, closeHref, router]);
  useDialogBehavior(open, close, panelRef);

  // Entra deslizándose desde la derecha, salvo con `prefers-reduced-motion`.
  useEffect(() => {
    if (!open || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    panelRef.current?.animate([{ transform: "translateX(24px)", opacity: 0 }, { transform: "none", opacity: 1 }], {
      duration: 200,
      easing: "cubic-bezier(.4,0,.2,1)",
    });
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] text-left">
      <div aria-hidden="true" onClick={close} className="absolute inset-0 bg-canvas/70 backdrop-blur-sm" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={cx(
          // `.kit-elevated` da el material de lo que flota (lienzo, filete, sombra);
          // aquí sin radio y con el filete solo a la izquierda.
          "kit-elevated absolute inset-y-0 right-0 flex w-full flex-col rounded-none border-y-0 border-r-0 pb-[env(safe-area-inset-bottom)]",
          WIDTH[size],
        )}
      >
        <div className="flex h-14 flex-shrink-0 items-center justify-between gap-4 border-b border-hairline px-5">
          <h2 className="min-w-0 truncate text-sm font-semibold text-fg">{title}</h2>
          <button
            type="button"
            onClick={close}
            aria-label={closeLabel}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-500/60"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
        {footer ? (
          <div className="flex flex-shrink-0 flex-wrap justify-end gap-2 border-t border-hairline px-5 py-3.5">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Lo que un diálogo tiene que hacer aunque no se vea: Escape, foco inicial,
 * tabulación atrapada dentro, devolver el foco al salir y bloquear el scroll de
 * detrás.
 *
 * Es un hook y no un componente A PROPÓSITO: un drawer lateral o una hoja de
 * abajo no comparten MATERIAL con `Modal`, pero sí esta conducta. En el hub, de
 * seis diálogos escritos a mano solo cuatro cerraban con Escape y ninguno
 * atrapaba ni devolvía el foco.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useDialogBehavior(open: boolean, onClose: () => void, panelRef: RefObject<HTMLElement | null>) {
  /**
   * 🪤 `onClose` va en una ref y NO en las dependencias. Si entrara, a quien lo
   * pase sin memoizar (una flecha en línea, lo normal) el efecto se le volvería a
   * montar en cada render, y la limpieza devuelve el foco: el foco saltaría al
   * disparador de detrás con el diálogo todavía abierto.
   */
  const onCloseRef = useRef(onClose);
  // Se pone al día en un efecto, no durante el render: escribir una ref mientras
  // se renderiza rompe el render concurrente.
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const restore = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key === "Tab" && panel) {
        const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      restore?.focus?.();
    };
  }, [open, panelRef]);
}

"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

export type ConfirmRequest = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Nombre accesible de la X, ya traducido: si no, una pantalla en español anuncia "Close". */
  closeLabel?: string;
  /** Botón rojo, para lo destructivo o irreversible. */
  danger?: boolean;
};

/**
 * La confirmación como promesa: el sustituto directo de `window.confirm`.
 *
 *   const { confirm, dialog } = useConfirm();
 *   async function onDelete() {
 *     if (!(await confirm({ title: "Delete this booking?", danger: true }))) return;
 *     // …seguir
 *   }
 *   return <>{…}{dialog}</>;   // el nodo se pinta una vez, en cualquier sitio
 *
 * El diálogo se cierra en cuanto se responde; el progreso de después lo enseña
 * el estado de carga de quien llamó, inline (§8.5).
 */
export function useConfirm(): {
  confirm: (req: ConfirmRequest) => Promise<boolean>;
  dialog: ReactNode;
} {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((req: ConfirmRequest) => {
    return new Promise<boolean>((resolve) => {
      // Una pregunta anterior aún abierta se resuelve en `false` antes de sustituirla.
      resolverRef.current?.(false);
      resolverRef.current = resolve;
      setRequest(req);
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setRequest(null);
    resolve?.(value);
  }, []);

  const dialog = request ? (
    <ConfirmDialog
      open
      onClose={() => settle(false)}
      onConfirm={() => {
        settle(true);
        return false; // ya está cerrado: que ConfirmDialog no vuelva a llamar a onClose
      }}
      title={request.title}
      description={request.description}
      confirmLabel={request.confirmLabel}
      cancelLabel={request.cancelLabel}
      closeLabel={request.closeLabel}
      danger={request.danger}
    />
  ) : null;

  return { confirm, dialog };
}

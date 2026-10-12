"use client";

import { useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";

/**
 * La confirmación: nunca `window.confirm` (§6.1). Escape, foco atrapado y un
 * spinner mientras corre la acción. Lo normal es usarla a través de `useConfirm`.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  closeLabel = "Close",
  danger = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Puede ser async: el botón muestra el spinner hasta que termina. Devuelve `false` para no cerrar. */
  onConfirm: () => boolean | void | Promise<boolean | void>;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  closeLabel?: string;
  /** Botón rojo, para lo destructivo o irreversible (Blueprint §41). */
  danger?: boolean;
  children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      const shouldClose = await onConfirm();
      if (shouldClose !== false) onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      size="sm"
      closeLabel={closeLabel}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} size="sm" onClick={handleConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description ? <p className="text-sm leading-relaxed text-fg-2">{description}</p> : null}
      {children ? <div className={description ? "mt-4" : undefined}>{children}</div> : null}
    </Modal>
  );
}

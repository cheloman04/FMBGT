import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * El elemento raíz del área de dashboard.
 *
 * Lleva `data-kit`, que es donde el tema del cliente pone sus tokens (§7.3): todo
 * lo que cuelga de aquí lee los colores del dashboard, y lo que queda fuera (la
 * landing, el flujo de reserva) sigue con los suyos. Va en el `layout.tsx` del
 * área, por encima del shell.
 *
 * 🪤 Un portal (`createPortal` a `document.body`) se sale de este elemento y se
 * queda sin tokens. Las capas flotantes del kit se montan DENTRO de él.
 */
export function KitRoot({
  children,
  className,
}: {
  children: ReactNode;
  /** Maquetación del contenedor (`flex h-dvh overflow-hidden`, …). Nunca color. */
  className?: string;
}) {
  return (
    <div data-kit="" className={cx("min-h-dvh bg-canvas text-fg antialiased", className)}>
      {children}
    </div>
  );
}

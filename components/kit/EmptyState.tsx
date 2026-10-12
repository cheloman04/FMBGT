import type { ReactNode } from "react";

/**
 * Vacío: una línea que dice QUÉ falta y CÓMO se llena (§8.5).
 *
 * "No payments in this period. They appear here as they settle." — nunca
 * "Nothing here yet". Sin ilustración, sin caja. Si una acción llena el hueco,
 * es un botón `secondary` debajo.
 */
export function EmptyState({
  title,
  hint,
  icon,
  action,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="px-4 py-10 text-center">
      {icon ? <div className="mb-2 flex justify-center text-fg-muted">{icon}</div> : null}
      <p className="text-sm text-fg-muted">{title}</p>
      {hint ? <p className="mx-auto mt-1 max-w-md text-xs text-fg-muted">{hint}</p> : null}
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}

import Link from "next/link";
import { cx } from "./cx";
import { withParam, type SearchParamsInput } from "./url";

export type PeriodOption = { value: string; label: string };

const SEGMENT =
  "inline-flex min-h-8 items-center rounded-md px-3 text-xs font-medium transition-colors duration-150 max-sm:min-h-11 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-500/60";

/**
 * Elegir el periodo de una vista: mes, 90 días, año, todo (§6.4). Un control
 * segmentado.
 *
 * Dos modos:
 *   · URL (el normal): `pathname` + `searchParams` de la página. Cada opción es
 *     un `<Link>` a la misma ruta con `?<param>=<valor>`, los demás filtros
 *     intactos y la paginación reiniciada. Funciona desde una página de servidor.
 *   · En memoria: `onChange`, solo dentro de una isla (una gráfica que cambia de
 *     ventana sin volver al servidor).
 *
 * 🪤 El segmento activo es neutro (relleno de superficie), no de acento: el acento
 * es para la acción primaria y la serie del periodo actual, no para un filtro (§7.5).
 */
export function PeriodFilter({
  options,
  value,
  param = "period",
  pathname,
  searchParams,
  onChange,
  ariaLabel = "Period",
}: {
  options: readonly PeriodOption[];
  value: string;
  /** El parámetro de la URL. */
  param?: string;
  pathname?: string;
  searchParams?: SearchParamsInput;
  onChange?: (value: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex rounded-lg border border-hairline bg-surface-muted p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        const className = cx(SEGMENT, active ? "bg-surface text-fg" : "text-fg-muted hover:text-fg");
        if (onChange || !pathname) {
          return (
            <button key={o.value} type="button" aria-pressed={active} onClick={() => onChange?.(o.value)} className={className}>
              {o.label}
            </button>
          );
        }
        return (
          <Link
            key={o.value}
            href={withParam(pathname, searchParams, param, o.value)}
            aria-current={active ? "true" : undefined}
            scroll={false}
            className={className}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

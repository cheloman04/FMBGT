import { domainOf, linePath } from "./chart";
import { cx } from "./cx";

/**
 * Una tendencia en miniatura, sin ejes: para el `sub` de una métrica o el final de
 * una fila. Misma regla que `LineChart`: acento para el periodo actual, gris
 * discontinuo para la comparación.
 */
export function Sparkline({
  values,
  compare,
  label,
  layout = "h-8 w-24",
}: {
  values: ReadonlyArray<number | null>;
  compare?: ReadonlyArray<number | null>;
  /** Lo que dice, para el lector de pantalla: "Bookings, last 8 weeks: rising". */
  label: string;
  /** Tamaño (`h-8 w-24`): solo maquetación. */
  layout?: string;
}) {
  const domain = domainOf(values, compare);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cx("inline-block overflow-visible align-middle", layout)}
    >
      {domain && compare ? (
        <path
          d={linePath(compare, domain)}
          fill="none"
          className="stroke-fg-muted"
          strokeWidth={1.25}
          strokeDasharray="3 2"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {domain ? (
        <path
          d={linePath(values, domain)}
          fill="none"
          className="stroke-ac-500"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        <line x1={0} x2={100} y1={50} y2={50} className="stroke-hairline" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}

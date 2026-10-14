import { domainOf, linePath, niceDomain, ticks, yOf } from "./chart";
import { cx } from "./cx";

export type ChartSeries = {
  label: string;
  /** Un valor por etiqueta del eje X. `null` = sin dato (la línea se corta; no es un cero). */
  values: ReadonlyArray<number | null>;
};

const defaultFormat = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

/** Como mucho ~7 etiquetas en el eje X: con 30 días, una de cada cinco. */
function sampleLabels(labels: readonly string[]): Array<{ label: string; index: number }> {
  const step = Math.max(1, Math.ceil(labels.length / 7));
  return labels.map((label, index) => ({ label, index })).filter(({ index }) => index % step === 0 || index === labels.length - 1);
}

/**
 * La gráfica del estándar (§8.3): UNA línea de acento para el periodo actual y,
 * si hay, una gris discontinua para la comparación. Sin áreas rellenas, sin
 * sombras, cuadrícula de filetes. Sin librería: SVG que llena su contenedor.
 *
 * Sin datos pinta los ejes y una línea de texto, nunca un spinner ni altura cero.
 * Los valores van también en una tabla oculta, para el lector de pantalla.
 *
 * Sin hooks: sirve en una página de servidor (con `formatValue` incluido).
 */
export function LineChart({
  series,
  compare,
  xLabels,
  ariaLabel,
  formatValue = defaultFormat,
  height = 180,
  emptyLabel = "No data in this period yet.",
}: {
  series: ChartSeries;
  compare?: ChartSeries;
  xLabels: readonly string[];
  /** Qué muestra la gráfica: "Collected revenue by week". */
  ariaLabel: string;
  formatValue?: (n: number) => string;
  /** Alto del área de trazado, en px. */
  height?: number;
  emptyLabel?: string;
}) {
  const raw = domainOf(series.values, compare?.values);
  const domain = raw ? niceDomain(raw) : null;
  const shownTicks = domain ? ticks(domain) : [];
  const xs = sampleLabels(xLabels);

  return (
    <figure className="w-full">
      {compare ? (
        <figcaption aria-hidden="true" className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-fg-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-ac-500" />
            {series.label}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-fg-muted" />
            {compare.label}
          </span>
        </figcaption>
      ) : null}

      <div aria-hidden="true" className="grid grid-cols-[auto_1fr] gap-x-3">
        {/* Eje Y: las marcas, alineadas con su filete. */}
        <div className="relative" style={{ height }}>
          {shownTicks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2 text-[10px] tabular-nums text-fg-muted"
              style={{ top: `${yOf(t, domain!)}%` }}
            >
              {formatValue(t)}
            </span>
          ))}
        </div>

        <div className="relative border-b border-hairline" style={{ height }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
            {shownTicks.map((t) => (
              <line
                key={t}
                x1={0}
                x2={100}
                y1={yOf(t, domain!)}
                y2={yOf(t, domain!)}
                className="stroke-hairline"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {domain && compare ? (
              <path
                d={linePath(compare.values, domain)}
                fill="none"
                className="stroke-fg-muted"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            {domain ? (
              <path
                d={linePath(series.values, domain)}
                fill="none"
                className="stroke-ac-500"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </svg>
          {!domain ? (
            <p className="absolute inset-0 flex items-center justify-center text-xs text-fg-muted">{emptyLabel}</p>
          ) : null}
        </div>

        {/* Eje X, bajo el área de trazado. */}
        <div />
        <div className="relative mt-1.5 h-4">
          {xs.map(({ label, index }) => {
            const pct = xLabels.length > 1 ? (index / (xLabels.length - 1)) * 100 : 50;
            return (
              <span
                key={index}
                className={cx(
                  "absolute whitespace-nowrap text-[10px] text-fg-muted",
                  pct === 0 ? "left-0" : pct === 100 ? "right-0" : "-translate-x-1/2",
                )}
                style={pct > 0 && pct < 100 ? { left: `${pct}%` } : undefined}
              >
                {label}
              </span>
            );
          })}
        </div>
      </div>

      {/* 🪤 `sr-only` va en un div, no en la tabla: una tabla no encoge a 1px (su
          ancho mínimo es el de su contenido) y a 320px desbordaba el <main> hacia
          la derecha. El div sí mide 1px y recorta lo de dentro. */}
      <div className="sr-only">
        <table>
          <caption>{ariaLabel}</caption>
          <thead>
            <tr>
              <th scope="col" />
              <th scope="col">{series.label}</th>
              {compare ? <th scope="col">{compare.label}</th> : null}
            </tr>
          </thead>
          <tbody>
            {xLabels.map((label, i) => (
              <tr key={i}>
                <th scope="row">{label}</th>
                <td>{series.values[i] == null ? "—" : formatValue(series.values[i]!)}</td>
                {compare ? <td>{compare.values[i] == null ? "—" : formatValue(compare.values[i]!)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

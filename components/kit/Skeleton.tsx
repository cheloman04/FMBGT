import { cx } from "./cx";

/**
 * Lo que se ve mientras llega una página (§8.6): la FORMA de lo que va a llegar,
 * no un spinner. Para los `loading.tsx`.
 *
 *   // app/admin/bookings/loading.tsx
 *   export default function Loading() {
 *     return <PageSkeleton metrics={4} rows={8} />;
 *   }
 */

const PULSE = "animate-pulse rounded-md bg-surface-muted motion-reduce:animate-none";

/** Un bloque. `layout` da el tamaño (`h-4 w-32`): solo maquetación. */
export function Skeleton({ layout }: { layout: string }) {
  return <div aria-hidden="true" className={cx(PULSE, layout)} />;
}

/** Líneas de texto; la última más corta, como un párrafo de verdad. */
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div aria-hidden="true" className="space-y-2">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={cx(PULSE, "h-3", i === lines - 1 && lines > 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

/** La forma de una `MetricStrip`: fila desde 42rem de ancho, como ella (`@container`). */
export function SkeletonMetrics({ count = 4 }: { count?: number }) {
  return (
    <div className="@container">
      <div aria-hidden="true" className="grid grid-cols-2 gap-6 border-b border-hairline pb-5 @2xl:flex @2xl:gap-0 @2xl:divide-x @2xl:divide-hairline">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="space-y-2.5 @2xl:flex-1 @2xl:px-5 @2xl:first:pl-0">
            <div className={cx(PULSE, "h-2.5 w-20")} />
            <div className={cx(PULSE, "h-6 w-24")} />
            <div className={cx(PULSE, "h-2.5 w-16")} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** La forma de una lista de filas con filetes. */
export function SkeletonList({ rows = 6 }: { rows?: number }) {
  return (
    <ul aria-hidden="true" className="divide-y divide-hairline border-b border-hairline">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center justify-between gap-4 py-3.5">
          <div className="min-w-0 flex-1 space-y-2">
            <div className={cx(PULSE, "h-3.5 w-48 max-w-full")} />
            <div className={cx(PULSE, "h-2.5 w-32")} />
          </div>
          <div className={cx(PULSE, "h-5 w-20 rounded-full")} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Una página entera mientras carga: cabecera, tira de métricas y lista. Con la
 * misma medida que `PageShell`, para que nada salte al llegar el contenido.
 */
export function PageSkeleton({
  metrics = 4,
  rows = 6,
  label = "Loading…",
}: {
  /** Métricas de la tira; 0 si la página no tiene. */
  metrics?: number;
  rows?: number;
  /** Lo que oye el lector de pantalla, ya traducido. */
  label?: string;
}) {
  return (
    <div className="bg-canvas min-h-[calc(100dvh-3.5rem)] md:min-h-dvh" aria-busy="true">
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <p role="status" className="sr-only">
          {label}
        </p>
        <div aria-hidden="true" className="mb-6 space-y-3">
          <div className={cx(PULSE, "h-2.5 w-24")} />
          <div className={cx(PULSE, "h-8 w-56")} />
          <div className={cx(PULSE, "h-3 w-72 max-w-full")} />
        </div>
        {metrics > 0 ? <SkeletonMetrics count={metrics} /> : null}
        <div className="mt-10">
          <SkeletonList rows={rows} />
        </div>
      </div>
    </div>
  );
}

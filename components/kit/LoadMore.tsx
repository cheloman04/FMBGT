import Link from "next/link";

export type LoadMoreLabels = {
  /** `(showing, total, noun) => "Showing 50 of 212 bookings"`. */
  showing: (showing: number, total: number, noun: string) => string;
  more: string;
  loading: string;
};

const LABELS_EN: LoadMoreLabels = {
  showing: (showing, total, noun) => `Showing ${showing} of ${total} ${noun}`,
  more: "Load more",
  loading: "Loading…",
};

const LINK =
  "rounded-lg px-3 py-1.5 font-medium text-ac-400 transition-colors duration-150 hover:bg-surface-muted hover:text-ac-300 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-500/60 max-sm:min-h-11";

/**
 * El pie de una lista: "Showing X of Y" y, si hay más, cargar más.
 *
 * Sustituye al corte silencioso de `.limit()` / `.slice()`: quien mira ve SIEMPRE
 * el total (§8.4). Dos modos:
 *   · Paginación en servidor: `moreHref` → un `<Link>` (la página va en la URL).
 *   · Paginación en cliente: `onLoadMore` (+ `loading`) → un `<button>`.
 */
export function LoadMore({
  showing,
  total,
  noun = "items",
  moreHref,
  onLoadMore,
  loading = false,
  labels: labelsProp,
}: {
  showing: number;
  total: number;
  noun?: string;
  moreHref?: string;
  onLoadMore?: () => void;
  loading?: boolean;
  labels?: Partial<LoadMoreLabels>;
}) {
  const labels = { ...LABELS_EN, ...labelsProp };
  const hasMore = total > showing;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-hairline px-1 py-3 text-xs text-fg-muted">
      <span>{labels.showing(showing, total, noun)}</span>
      {hasMore && onLoadMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loading}
          aria-busy={loading}
          className={`${LINK} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {loading ? labels.loading : labels.more}
        </button>
      ) : hasMore && moreHref ? (
        <Link href={moreHref} className={LINK}>
          {labels.more}
        </Link>
      ) : null}
    </div>
  );
}

import Link from 'next/link';
import type { Crumb } from '@/lib/seo';

/**
 * Visible breadcrumb trail. Pair it with breadcrumbSchema() from lib/seo so the
 * markup and the structured data describe the same path — Google checks.
 * The final crumb is the current page and carries no link.
 */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-8">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--lp-text-muted)]">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={crumb.name} className="flex items-center gap-2">
              {crumb.url && !isLast ? (
                <Link
                  href={new URL(crumb.url).pathname}
                  className="underline-offset-4 transition hover:text-[var(--lp-green)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-green)]"
                >
                  {crumb.name}
                </Link>
              ) : (
                <span aria-current={isLast ? 'page' : undefined} className="text-[var(--lp-text-body)]">
                  {crumb.name}
                </span>
              )}
              {!isLast && <span aria-hidden="true">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

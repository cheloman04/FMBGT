// The view's state as it comes in the URL (KIGARU_DASHBOARD_STANDARD_V1.md
// §4.7), read defensively: a hand-edited or stale link falls back to the
// default instead of breaking the page. Shared by the admin's list pages. Pure.
import type { SearchParamsInput } from '@/components/kit';

export type Raw = string | string[] | undefined;

/** `?a=1&a=2` arrives as an array: the first one wins. */
export const single = (raw: Raw) => (Array.isArray(raw) ? raw[0] : raw);

/** Rows per "Load more". */
export const PAGE_SIZE = 50;
const MAX_PAGES = 20;
const MAX_SEARCH = 80;

/**
 * The search as it goes to the database. The characters PostgREST reads as
 * filter syntax (`,` `(` `)` `"` `\`) and the LIKE wildcards (`%` `*`) are
 * dropped: they never carry meaning in a name, an email or a phone.
 */
export function parseSearch(raw: Raw): string {
  return (single(raw) ?? '')
    .replace(/[,()"\\%*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SEARCH);
}

/** How many pages of PAGE_SIZE are showing ("Load more" adds one). */
export function parsePage(raw: Raw): number {
  const page = Number.parseInt(single(raw) ?? '', 10);
  return Number.isFinite(page) && page >= 1 ? Math.min(page, MAX_PAGES) : 1;
}

/** The id of the record open in a drawer, if it looks like one. */
export function parseUuid(raw: Raw): string | null {
  const value = single(raw);
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value.toLowerCase() : null;
}

/** The OR of a search across columns, for `.or()`. Quoted: the value may hold `.` or `:` (an email, a time). */
export function ilikeAny(columns: readonly string[], q: string): string {
  return columns.map((column) => `${column}.ilike."%${q}%"`).join(',');
}

/** The same params without one key: the open drawer, when a filter link is built behind it. */
export function dropParam(params: SearchParamsInput, key: string): URLSearchParams {
  const copy = new URLSearchParams();
  const entries = params instanceof URLSearchParams ? [...params.entries()] : Object.entries(params);
  for (const [name, value] of entries) {
    if (name === key) continue;
    for (const v of Array.isArray(value) ? value : [value]) if (v !== undefined) copy.append(name, v);
  }
  return copy;
}

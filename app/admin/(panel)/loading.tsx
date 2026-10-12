import { PageSkeleton } from '@/components/kit';

// What the operator sees while a page's data loads (§8.6): header, a strip of
// figures and a list, at the same width as the page so nothing jumps.
export default function Loading() {
  return <PageSkeleton metrics={4} rows={6} label="Loading…" />;
}

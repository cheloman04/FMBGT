import { PageSkeleton } from '@/components/kit';

// One booking loading (§8.6): the header and its sections, at the page's width.
export default function Loading() {
  return <PageSkeleton metrics={0} rows={8} label="Loading the booking…" />;
}

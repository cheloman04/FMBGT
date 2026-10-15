import { PageSkeleton } from '@/components/kit';

// The bell loading (§8.6): the header and the notification rows.
export default function Loading() {
  return <PageSkeleton metrics={0} rows={6} label="Loading notifications…" />;
}

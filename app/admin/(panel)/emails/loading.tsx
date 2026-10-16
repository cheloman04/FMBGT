import { PageSkeleton } from '@/components/kit';

// The emails loading (§8.6): the status strip and the email rows.
export default function Loading() {
  return <PageSkeleton metrics={5} rows={8} label="Loading emails…" />;
}

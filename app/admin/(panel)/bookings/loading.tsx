import { PageSkeleton } from '@/components/kit';

// The bookings list loading (§8.6): header, the status strip and the rows, at
// the page's width so nothing jumps when it arrives.
export default function Loading() {
  return <PageSkeleton metrics={5} rows={8} label="Loading bookings…" />;
}

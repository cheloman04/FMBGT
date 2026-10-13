import { PageSkeleton } from '@/components/kit';

// The leads list loading (§8.6): header, the view strip and the rows, at the
// page's width so nothing jumps when it arrives.
export default function Loading() {
  return <PageSkeleton metrics={4} rows={8} label="Loading leads…" />;
}

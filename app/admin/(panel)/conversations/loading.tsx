import { PageSkeleton } from '@/components/kit';

// The inbox loading (§8.6): the header and the conversation rows, at the page's
// width so nothing jumps when it arrives.
export default function Loading() {
  return <PageSkeleton metrics={0} rows={6} label="Loading conversations…" />;
}

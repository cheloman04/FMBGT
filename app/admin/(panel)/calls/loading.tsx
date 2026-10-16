import { PageSkeleton } from '@/components/kit';

// The call log loading (§8.6): the header, the five tiles and the call rows, at
// the page's width so nothing jumps when it arrives.
export default function Loading() {
  return <PageSkeleton metrics={5} rows={6} label="Loading calls…" />;
}

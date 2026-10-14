import { PageSkeleton } from '@/components/kit';

// The Trash loading (§8.6): the header and the rows, at the page's width so
// nothing jumps when it arrives. No strip: the page has none.
export default function Loading() {
  return <PageSkeleton metrics={0} rows={8} label="Loading the trash…" />;
}

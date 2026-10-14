import { PageSkeleton } from '@/components/kit';

// The manual booking page loading (§8.6): the header, the form and the list.
export default function Loading() {
  return <PageSkeleton metrics={0} rows={8} label="Loading manual bookings…" />;
}

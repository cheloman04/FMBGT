import { redirect } from 'next/navigation';
import { PageHeader, PageShell } from '@/components/kit';
import { requireOperator } from '@/lib/admin/auth';
import { legacyBookingsUrl } from '@/lib/admin/bookings';
import { legacyLeadsUrl } from '@/lib/admin/leads';
import { loadNextBooking, loadOverview } from '@/lib/admin/loaders';
import { AdminOverview } from './_components/Overview';

interface PageProps {
  searchParams: Promise<{ status?: string | string[]; leadId?: string | string[] }>;
}

export const metadata = { title: 'Dashboard | Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminPage({ searchParams }: PageProps) {
  await requireOperator();

  const { status, leadId } = await searchParams;
  // The lists below the overview moved to their own routes (phase 2, step 3):
  // an old link (a bookmark, a lead alert) lands on the same view there.
  const moved = legacyBookingsUrl(status) ?? legacyLeadsUrl(status, leadId);
  if (moved) redirect(moved);

  const [overview, next] = await Promise.all([loadOverview(), loadNextBooking()]);

  return (
    <PageShell>
      <PageHeader eyebrow="Overview" title="Dashboard" subtitle="Money, the next tour and what needs you. Times in Eastern." />
      <AdminOverview stats={overview} next={next} />
    </PageShell>
  );
}

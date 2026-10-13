import { PageHeader, PageShell } from '@/components/kit';
import { requireOperator } from '@/lib/admin/auth';
import { loadTrash } from '@/lib/admin/loaders';
import { LegacyArea } from '../../_components/LegacyArea';
import { LegacyTrash } from './LegacyTrash';

export const metadata = { title: 'Trash | Admin' };
export const dynamic = 'force-dynamic';

// The Trash in its own route (phase 2, step 3c-1). Its body is still the legacy
// UI moved out of AdminClient; step 3c-2 rebuilds it with the kit.
export default async function TrashPage() {
  await requireOperator();
  const { bookings, leads } = await loadTrash();

  return (
    <PageShell>
      <PageHeader
        eyebrow="Records"
        title="Trash"
        subtitle="Archived bookings and leads. Restore one, or delete it for good. Times in Eastern."
      />
      <LegacyArea>
        <LegacyTrash trashedBookings={bookings} trashedLeads={leads} />
      </LegacyArea>
    </PageShell>
  );
}

import { CallsLog, PageHeader, PageShell } from '@/components/kit';
import { requireOperator } from '@/lib/admin/auth';
import { loadCallLog } from '@/lib/admin/calls';

export const metadata = { title: 'Calls | Admin' };
export const dynamic = 'force-dynamic';

// FMBGT runs on Eastern time (§8.7).
const TIME_ZONE = 'America/New_York';

// The calls (§9.1 «Llamadas»): what the voice agent made and took, with the ones
// that need a person first. The first paint comes from the server; the island then
// re-reads the log every 30 s through /api/admin/calls. "Open their messages"
// goes to the same person's thread in /admin/conversations (the kit's default).
export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string; period?: string; direction?: string; q?: string }>;
}) {
  await requireOperator();
  // The first paint is the URL's: a link to `?segment=needs_human` opens on "Needs a human".
  const initial = await loadCallLog(await searchParams);

  return (
    <PageShell fill>
      <PageHeader title="Calls" subtitle="Calls your AI agent made and took, with the ones that need a person first." />
      <CallsLog initial={initial} endpoint="/api/admin/calls" loginPath="/admin/login" timeZone={TIME_ZONE} />
    </PageShell>
  );
}

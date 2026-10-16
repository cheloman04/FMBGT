import { EmailsLog, PageHeader, PageShell, parseEmailView } from '@/components/kit';
import { requireOperator } from '@/lib/admin/auth';
import { EMAIL_TYPE_LABELS, loadEmails } from '@/lib/admin/emails';

export const metadata = { title: 'Emails | Admin' };
export const dynamic = 'force-dynamic';

// FMBGT runs on Eastern time (§8.7).
const TIME_ZONE = 'America/New_York';

// The customer emails (§9.3): what the site sent its guests through Kigaru and
// whether it arrived. The first paint comes from the server, for the filters in
// the URL; the island then switches filters without a reload and re-reads the
// list every 60 s through /api/admin/emails.
export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOperator();
  const initial = await loadEmails(parseEmailView(await searchParams));

  return (
    <PageShell>
      <PageHeader
        title="Emails"
        subtitle="Booking confirmations, balance emails, follow-ups and review requests your site sent, and whether they arrived."
      />
      <EmailsLog
        initial={initial}
        endpoint="/api/admin/emails"
        loginPath="/admin/login"
        timeZone={TIME_ZONE}
        labels={{ typeNames: EMAIL_TYPE_LABELS }}
      />
    </PageShell>
  );
}

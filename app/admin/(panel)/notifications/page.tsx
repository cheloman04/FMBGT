import { NotificationsFeed, PageHeader, PageShell } from '@/components/kit';
import { requireOperator } from '@/lib/admin/auth';
import { loadNotifications } from '@/lib/admin/notifications';

export const metadata = { title: 'Notifications | Admin' };
export const dynamic = 'force-dynamic';

// FMBGT runs on Eastern time (§8.7).
const TIME_ZONE = 'America/New_York';

// The bell (§9.2): what the hub tells the owner, starting with the conversations the
// assistant passed to a person. The first paint comes from the server; the island
// then re-reads it every 30 s through /api/admin/notifications.
export default async function NotificationsPage() {
  await requireOperator();
  const initial = await loadNotifications();

  return (
    <PageShell>
      <PageHeader
        title="Notifications"
        subtitle="When your assistant passes a conversation to you, it shows up here with a link to reply."
      />
      <NotificationsFeed
        initial={initial}
        endpoint="/api/admin/notifications"
        loginPath="/admin/login"
        timeZone={TIME_ZONE}
      />
    </PageShell>
  );
}

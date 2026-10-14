import { ConversationsInbox, PageHeader, PageShell } from '@/components/kit';
import { requireOperator } from '@/lib/admin/auth';
import { loadConversations } from '@/lib/admin/conversations';

export const metadata = { title: 'Conversations | Admin' };
export const dynamic = 'force-dynamic';

// FMBGT runs on Eastern time (§8.7).
const TIME_ZONE = 'America/New_York';

// The inbox (§9): Instagram, Messenger and WhatsApp DMs, read and answered here.
// The first paint comes from the server; the island then re-reads the inbox and
// the open thread every 15 s through /api/admin/conversations.
export default async function ConversationsPage() {
  await requireOperator();
  const initial = await loadConversations();

  return (
    <PageShell fill>
      <PageHeader
        title="Conversations"
        subtitle="Instagram, Messenger and WhatsApp messages. Replying here takes the conversation over from the AI agent."
      />
      <ConversationsInbox
        initial={initial}
        endpoint="/api/admin/conversations"
        loginPath="/admin/login"
        timeZone={TIME_ZONE}
      />
    </PageShell>
  );
}

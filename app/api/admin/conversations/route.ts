import { inboxRoutes } from '@/lib/admin/conversations';

export const dynamic = 'force-dynamic';

// GET — the inbox: the conversations and the channels with an active account.
export const GET = inboxRoutes.list;

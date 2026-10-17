import { inboxRoutes } from '@/lib/admin/conversations';

export const dynamic = 'force-dynamic';
// Sending goes through the hub to Meta: two network hops in a row.
export const maxDuration = 60;

// GET — the thread. POST { text } — reply as the business: it TAKES OVER the
// conversation (the AI agent stops answering it). PATCH { handler: 'agent' } —
// hand it back; PATCH { archived } — archive it or put it back in the inbox.
// DELETE — delete an archived conversation forever (the connection needs the
// channels:delete scope).
export const { GET, POST, PATCH, DELETE } = inboxRoutes.thread;

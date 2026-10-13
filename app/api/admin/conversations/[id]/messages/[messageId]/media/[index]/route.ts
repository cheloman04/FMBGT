import { inboxRoutes } from '@/lib/admin/conversations';

export const dynamic = 'force-dynamic';

// GET — an attachment: a 302 to the hub's one-hour signed URL. The thumbnail's
// <img src> points here, so it needs the operator's session like any admin route.
export const GET = inboxRoutes.media;

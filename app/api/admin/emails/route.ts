import { emailRoutes } from '@/lib/admin/emails';

export const dynamic = 'force-dynamic';

// GET — the customer emails, newest first (`?segment=&type=&period=&to=&cursor=`).
export const GET = emailRoutes.list;

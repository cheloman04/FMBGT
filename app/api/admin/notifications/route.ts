import { notificationRoutes } from '@/lib/admin/notifications';

export const dynamic = 'force-dynamic';

// GET — the owner's notifications, newest first (`?before=` for the next batch).
export const GET = notificationRoutes.list;

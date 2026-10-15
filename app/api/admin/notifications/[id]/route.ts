import { notificationRoutes } from '@/lib/admin/notifications';

export const dynamic = 'force-dynamic';

// PATCH { read } — mark one notification read or unread (in the portal too).
export const PATCH = notificationRoutes.item.PATCH;

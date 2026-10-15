import { notificationRoutes } from '@/lib/admin/notifications';

export const dynamic = 'force-dynamic';

// POST { until } — "Mark all as read", up to the newest notification on screen.
export const POST = notificationRoutes.readAll;

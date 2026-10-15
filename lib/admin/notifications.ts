// The owner's notifications in /admin — the bell (KIGARU_DASHBOARD_STANDARD_V1.md
// §9.2, the kit's `notifications` module). The same notices Dustin gets in his
// Kigaru portal, starting with "Your assistant passed a conversation to you": the
// assistant handed a DM over to a person, with the link to that thread in the inbox.
// Reading one here marks it read in the portal too (it's the same row in the hub).
//
// Server only: it talks to the hub with the site's connection (the inbox's, scope
// notifications:read), and that secret never reaches the browser — the page and the
// three /api/admin/notifications routes are the only way in.
import { hubFromEnv } from '@/components/kit/conversations/server';
import {
  createNotificationRoutes,
  loadNotifications as loadFromHub,
  notificationsBadge,
  notificationsNav,
  type NotificationsNav,
} from '@/components/kit/notifications/server';
import type { NavBadges } from '@/components/kit';
import { getOperator, unauthorized } from '@/lib/admin/auth';

/**
 * The proxy routes' handlers. Every route.ts under app/api/admin/notifications only
 * re-exports one of these: a route file that exports anything else breaks
 * `next build --webpack`.
 *
 * `authorize` runs first. It answers the operator's own 401 — the kit turns a 401
 * or 403 from the HUB (the connection, not the session) into a 502.
 */
export const notificationRoutes = createNotificationRoutes({
  authorize: async () => ((await getOperator()) ? null : unauthorized()),
  // With the arrow: hubFromEnv() reads the environment, not the request.
  hub: () => hubFromEnv(),
});

/** The first paint of /admin/notifications. A hub failure comes back with its cause. */
export function loadNotifications() {
  return loadFromHub(hubFromEnv());
}

/**
 * Whether the menu shows "Notifications", and how many are unread. Hidden until the
 * site's connection has the notifications:read scope (the hub answers 403); if the
 * hub fails or is slow (2.5 s) it stays visible, without a number. Never throws.
 */
export function notificationsMenu(): Promise<NotificationsNav> {
  return notificationsNav(hubFromEnv());
}

/** The menu counters plus the bell's: amber, someone is waiting for a person. */
export function withNotificationsBadge(badges: NavBadges, bell: NotificationsNav): NavBadges {
  return { ...badges, notifications: notificationsBadge(bell) };
}

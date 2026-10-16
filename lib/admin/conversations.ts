// The /admin inbox: Instagram, Messenger and WhatsApp conversations, which live in
// the Kigaru hub (KIGARU_DASHBOARD_STANDARD_V1.md §9, the kit's `conversations`
// module). Server only: it talks to the hub with the site's connection
// (SENZAI_CONNECTION_KEY / SENZAI_CONNECTION_SECRET, scopes channels:read and
// channels:write), and that secret never reaches the browser — the page and the
// three /api/admin/conversations routes are the only way in.
import { createInboxRoutes, hubFromEnv, inboxVisible, loadInbox } from '@/components/kit/conversations/server';
import { getOperator, unauthorized } from '@/lib/admin/auth';

/**
 * The proxy routes' handlers. Every route.ts under app/api/admin/conversations
 * only re-exports one of these: a route file that exports anything else breaks
 * `next build --webpack`.
 *
 * `authorize` runs first in every handler. It answers the operator's own 401 —
 * the kit turns a 401 from the HUB (a bad connection, not an expired session)
 * into a 502, so the API client never sends a signed-in operator to the login.
 */
export const inboxRoutes = createInboxRoutes({
  authorize: async () => ((await getOperator()) ? null : unauthorized()),
});

/**
 * The first paint of /admin/conversations, for the segment (`?segment=`) and the
 * search (`?q=`) in the URL. A hub failure comes back with its cause.
 */
export function loadConversations(sp: { segment?: string; q?: string }) {
  return loadInbox(hubFromEnv(), { segment: sp.segment, query: sp.q });
}

/**
 * Whether the menu shows "Conversations": only once a messaging channel has an
 * active account in the hub. If the hub fails it stays visible (the page then
 * says why); without a connection configured it hides.
 */
export function conversationsVisible() {
  return inboxVisible(hubFromEnv());
}

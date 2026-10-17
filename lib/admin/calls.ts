// The calls in /admin (KIGARU_DASHBOARD_STANDARD_V1.md §9.1 «Llamadas», the kit's
// `conversations` module): the calls the voice agent made and took, with the ones
// that need a person first. The calls live in the Kigaru hub (contract §2.3).
// "Mark as attended" here is the same mark Kigaru's admin sees: it takes the call
// out of "Needs a human" on both sides.
//
// Server only: it talks to the hub with the site's connection (the inbox's, scopes
// channels:read to read and listen, channels:write to mark), and that secret never
// reaches the browser — the page and the three /api/admin/calls routes are the
// only way in.
import { callsBadge, callsNav, createCallRoutes, hubFromEnv, loadCalls } from '@/components/kit/conversations/server';
import type { CallsNav, NavBadges } from '@/components/kit';
import { getOperator, unauthorized } from '@/lib/admin/auth';

/**
 * The proxy routes' handlers. Every route.ts under app/api/admin/calls only
 * re-exports one of these: a route file that exports anything else breaks
 * `next build --webpack`.
 *
 * `authorize` runs first. It answers the operator's own 401 — the kit turns a 401
 * or 403 from the HUB (the connection, not the session) into a 502.
 */
export const callRoutes = createCallRoutes({
  authorize: async () => ((await getOperator()) ? null : unauthorized()),
  // Who marks a call as attended: what "Attended by X" shows, here and in
  // Kigaru's admin. It comes from the session, on the server; a `by` sent by the
  // browser is ignored, and without one nothing is marked.
  attendedBy: async () => (await getOperator())?.email ?? null,
});

/**
 * The first paint of /admin/calls, for the cut (`?segment=`), the period, the
 * direction and the search (`?q=`) in the URL. A hub failure comes back with its cause.
 */
export function loadCallLog(sp: { segment?: string; period?: string; direction?: string; q?: string }) {
  return loadCalls(hubFromEnv(), { segment: sp.segment, period: sp.period, direction: sp.direction, query: sp.q });
}

/**
 * Whether the menu shows "Calls", and how many need a person. Hidden until the
 * voice line has an active account in the hub or there are calls in the history;
 * also hidden without a connection, without channels:read (403) or with a hub
 * that has no calls API. If the hub fails or is slow (2.5 s) it stays visible,
 * without a number. Never throws, no cache.
 */
export function callsMenu(): Promise<CallsNav> {
  return callsNav(hubFromEnv());
}

/** The menu counters plus the calls': amber, someone is waiting for a person. */
export function withCallsBadge(badges: NavBadges, calls: CallsNav): NavBadges {
  return { ...badges, calls: callsBadge(calls) };
}

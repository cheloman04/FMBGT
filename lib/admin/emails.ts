// The customer emails in /admin (KIGARU_DASHBOARD_STANDARD_V1.md §9.3, the kit's
// `emails` module): what the site sent its guests through Kigaru — confirmations,
// balance emails, lead follow-ups, review requests — and whether each one arrived,
// with its timeline. The emails themselves live in the Kigaru hub (contract §5).
//
// Server only: it talks to the hub with the site's connection (the inbox's, scope
// email:read), and that secret never reaches the browser — the page and the two
// /api/admin/emails routes are the only way in.
import { hubFromEnv } from '@/components/kit/conversations/server';
import { createEmailRoutes, emailsVisible as visibleInHub, loadEmails as loadFromHub } from '@/components/kit/emails/server';
import type { EmailView } from '@/components/kit';
import { getOperator, unauthorized } from '@/lib/admin/auth';
import { EMAIL_TYPE_NAMES } from '@/lib/email/config';

/**
 * The proxy routes' handlers. Every route.ts under app/api/admin/emails only
 * re-exports one of these: a route file that exports anything else breaks
 * `next build --webpack`.
 *
 * `authorize` runs first. It answers the operator's own 401 — the kit turns a 401
 * or 403 from the HUB (the connection, not the session) into a 502.
 */
export const emailRoutes = createEmailRoutes({
  authorize: async () => ((await getOperator()) ? null : unauthorized()),
  // With the arrow: hubFromEnv() reads the environment, not the request.
  hub: () => hubFromEnv(),
});

/** The names of FMBGT's email types: the type filter and the list's column. */
export const EMAIL_TYPE_LABELS: Record<string, string> = EMAIL_TYPE_NAMES;

/** The first paint of /admin/emails, for the filters in the URL. A hub failure comes back with its cause. */
export function loadEmails(view: EmailView) {
  return loadFromHub(hubFromEnv(), view);
}

/**
 * Whether the menu shows "Emails": hidden until the site's connection has the
 * email:read scope (the hub answers 403); if the hub fails or is slow (2.5 s) it
 * stays visible. Keeps its answer for a minute and never throws.
 */
export function emailsVisible(): Promise<boolean> {
  return visibleInHub(hubFromEnv());
}

import 'server-only';

// POST /api/admin/emails/test — one of the eight customer emails, with sample data,
// to an address the operator types (lib/email/test-samples.ts). It goes through the
// real path: the outbox, the Kigaru hub, Resend, the inbox, and then the list in
// /admin/emails. It doesn't depend on KIGARU_EMAIL_TYPES: a test always goes
// through Kigaru, so the owner can review every email before it is switched over.
//
// Outside production the outbox only sends to *@resend.dev; any other address comes
// back as "not sent" and never reaches the hub.

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getOperator, unauthorized } from '@/lib/admin/auth';
import { getAppUrl } from '@/lib/app-url';
import { getBookingLocationMeta } from '@/lib/location-meta';
import { queueEmail } from '@/lib/email/outbox';
import { SAMPLE_LOCATION, TEST_EMAIL_KEYS, renderTestEmail } from '@/lib/email/test-samples';

const Body = z.object({
  email: z.enum(TEST_EMAIL_KEYS),
  trail: z.enum(['paved', 'mtb']).default('paved'),
  to: z.string().trim().toLowerCase().email().max(254),
});

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** The handler the route re-exports. The operator's session first, before any work. */
export async function sendTestEmail(req: Request): Promise<Response> {
  if (!(await getOperator())) return unauthorized();

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Pick an email and type a full email address.' }, 400);
  const { email, trail, to } = parsed.data;

  const rendered = renderTestEmail(email, {
    trail,
    siteUrl: getAppUrl(),
    meetingUrl: getBookingLocationMeta(SAMPLE_LOCATION[trail]).meetingPointUrl,
  });
  const result = await queueEmail({
    type: rendered.type,
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    // Every test is a new email: its own key, never a duplicate of another.
    idempotencyKey: `test:${rendered.type}:${randomUUID()}`,
  });

  switch (result.state) {
    case 'sent':
      return json({ data: { state: result.state, message: `Sent to Kigaru for ${to}. It shows up in the list below within a minute.` } });
    case 'pending':
      return json({ data: { state: result.state, message: "Kigaru couldn't take it right now; it will retry on its own." } });
    case 'skipped':
      return json({ error: 'Not sent: outside production only *@resend.dev addresses go out.' }, 409);
    case 'invalid':
      return json({ error: 'Type a full email address.' }, 400);
    default:
      return json({ error: `Kigaru didn't take it: ${result.error ?? result.state}` }, 502);
  }
}

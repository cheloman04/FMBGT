import { NextRequest, NextResponse } from 'next/server';
import { drainEmailOutbox, purgeSettledEmailBodies } from '@/lib/email/outbox';
import { runEmailSequences } from '@/lib/email/sequences';

// The customer-email tick (phase 6 of the Kigaru plan):
//   1. the marketing sequences switched over to Kigaru (lead follow-ups, review
//      requests): due steps are rendered and queued, as n8n's crons used to do;
//   2. the email outbox: rows the hub couldn't take yet are handed over again;
//   3. bodies of rows settled more than 30 days ago are cleared.
//
// On the Hobby plan Vercel runs crons once a day, so this one in vercel.json is a
// safety net. The real clock is a schedule that calls this route every 5 minutes
// with `Authorization: Bearer <CRON_SECRET>` (an n8n schedule with ONE HTTP node,
// the way process-analytics-deliveries is clocked today: no email goes through n8n).
// Calling it more often than needed is harmless: every step is idempotent.

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const adminSecret = process.env.ADMIN_SECRET;
  return Boolean(
    (cronSecret && req.headers.get('authorization') === `Bearer ${cronSecret}`) ||
      (adminSecret && req.headers.get('x-admin-secret') === adminSecret)
  );
}

async function run(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sequences = await runEmailSequences();
    const drained = await drainEmailOutbox({ limit: 50 });
    const outbox = {
      claimed: drained.claimed,
      sent: drained.sent,
      retrying: drained.retrying,
      rejected: drained.rejected,
      failed: drained.failed,
      ...(drained.skipped ? { skipped: drained.skipped } : {}),
    };
    await purgeSettledEmailBodies();
    return NextResponse.json({ sequences, outbox });
  } catch (error) {
    console.error('[cron/emails] failed', error);
    return NextResponse.json({ error: 'Email tick failed' }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;

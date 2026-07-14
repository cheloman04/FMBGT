import { NextRequest, NextResponse } from 'next/server';
import { processAnalyticsDeliveries } from '@/lib/analytics-delivery';

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
    return NextResponse.json(await processAnalyticsDeliveries({ limit: 50 }));
  } catch (error) {
    console.error('[cron/process-analytics-deliveries] failed', error);
    return NextResponse.json({ error: 'Analytics delivery processing failed' }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import {
  buildLeadFollowUpWebhookPayload,
  enrollLeadInFollowUp,
  evaluateLeadFollowUpEligibility,
  markFollowUpWebhookTriggered,
} from '@/lib/lead-followup';

const BodySchema = z.object({
  lead_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session')?.value;
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || session !== adminSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const leadWebhookUrl = process.env.N8N_LEAD_FOLLOWUP_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL;
  if (!leadWebhookUrl || leadWebhookUrl === 'your_n8n_webhook_url_here') {
    return NextResponse.json({ error: 'Lead follow-up webhook URL is not configured' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 });
  }

  const eligibility = await evaluateLeadFollowUpEligibility(parsed.data.lead_id);
  if (!eligibility.lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }
  if (!eligibility.eligible && eligibility.reason !== 'followup_not_enrolled') {
    return NextResponse.json(
      { error: `Lead is not eligible for follow-up (${eligibility.reason})` },
      { status: 409 }
    );
  }

  const result = await enrollLeadInFollowUp(parsed.data.lead_id);
  const shouldTriggerWebhook =
    result.created || (!result.enrollment.webhook_triggered_at && result.enrollment.status === 'active');

  if (!shouldTriggerWebhook) {
    return NextResponse.json({
      ok: true,
      enrollment_id: result.enrollment.id,
      already_active: result.alreadyActive,
      message: 'Active follow-up already exists',
    });
  }

  const payload = buildLeadFollowUpWebhookPayload({
    lead: result.lead,
    enrollment: result.enrollment,
  });

  const response = await fetch(leadWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return NextResponse.json({ error: `n8n returned ${response.status}` }, { status: 502 });
  }

  await markFollowUpWebhookTriggered(result.enrollment.id);

  return NextResponse.json({
    ok: true,
    enrollment_id: result.enrollment.id,
    already_active: result.alreadyActive,
  });
}

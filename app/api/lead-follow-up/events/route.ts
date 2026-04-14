import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  markFollowUpStepSent,
  markLeadAndEnrollmentLost,
  skipFollowUpStep,
} from '@/lib/lead-followup';

const BodySchema = z.discriminatedUnion('event', [
  z.object({
    event: z.literal('step_sent'),
    enrollment_id: z.string().uuid(),
    step_key: z.enum(['1_hour', '1_day', '1_week']),
  }),
  z.object({
    event: z.literal('step_skipped'),
    enrollment_id: z.string().uuid(),
    step_key: z.enum(['1_hour', '1_day', '1_week']),
    reason: z.string().min(1).max(200),
  }),
  z.object({
    event: z.literal('mark_lost'),
    enrollment_id: z.string().uuid(),
  }),
]);

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.N8N_FOLLOWUP_SECRET;
  if (!secret) return false;
  return req.headers.get('x-followup-secret') === secret;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid follow-up event payload' }, { status: 400 });
  }

  switch (parsed.data.event) {
    case 'step_sent':
      await markFollowUpStepSent({
        enrollmentId: parsed.data.enrollment_id,
        stepKey: parsed.data.step_key,
      });
      break;
    case 'step_skipped':
      await skipFollowUpStep({
        enrollmentId: parsed.data.enrollment_id,
        stepKey: parsed.data.step_key,
        reason: parsed.data.reason,
      });
      break;
    case 'mark_lost':
      await markLeadAndEnrollmentLost(parsed.data.enrollment_id);
      break;
  }

  return NextResponse.json({ ok: true });
}

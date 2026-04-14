import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  markReviewRequestReceived,
  markReviewRequestStepSent,
  skipReviewRequestStep,
} from '@/lib/review-requests';

const BodySchema = z.discriminatedUnion('event', [
  z.object({
    event: z.literal('step_sent'),
    enrollment_id: z.string().uuid(),
    step_key: z.enum(['same_day', '1_day', '1_week']),
  }),
  z.object({
    event: z.literal('step_skipped'),
    enrollment_id: z.string().uuid(),
    step_key: z.enum(['same_day', '1_day', '1_week']),
    reason: z.string().min(1).max(200),
  }),
  z.object({
    event: z.literal('review_received'),
    enrollment_id: z.string().uuid(),
    platform: z.string().min(1).max(100).optional(),
  }),
]);

function isAuthorized(req: NextRequest): boolean {
  const secret =
    process.env.N8N_REVIEW_REQUEST_SECRET || process.env.N8N_FOLLOWUP_SECRET;
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
    return NextResponse.json({ error: 'Invalid review request event payload' }, { status: 400 });
  }

  switch (parsed.data.event) {
    case 'step_sent':
      await markReviewRequestStepSent({
        enrollmentId: parsed.data.enrollment_id,
        stepKey: parsed.data.step_key,
      });
      break;
    case 'step_skipped':
      await skipReviewRequestStep({
        enrollmentId: parsed.data.enrollment_id,
        stepKey: parsed.data.step_key,
        reason: parsed.data.reason,
      });
      break;
    case 'review_received':
      await markReviewRequestReceived({
        enrollmentId: parsed.data.enrollment_id,
        platform: parsed.data.platform ?? null,
      });
      break;
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getReviewRequestEnrollmentById,
  getReviewRequestSteps,
  markReviewRequestReceived,
  markReviewRequestStepSent,
  skipReviewRequestStep,
} from '@/lib/review-requests';
import { sendSenzaiEvent } from '@/lib/senzai-ingest';

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
    case 'step_sent': {
      const enrollment = await getReviewRequestEnrollmentById(parsed.data.enrollment_id);
      const steps = await getReviewRequestSteps(parsed.data.enrollment_id);
      const targetStep = steps.find((step) => step.step_key === parsed.data.step_key);
      const shouldAttemptReviewRequested = targetStep?.status === 'pending';

      await markReviewRequestStepSent({
        enrollmentId: parsed.data.enrollment_id,
        stepKey: parsed.data.step_key,
      });

      const updatedSteps = shouldAttemptReviewRequested
        ? await getReviewRequestSteps(parsed.data.enrollment_id)
        : steps;
      const updatedTargetStep = updatedSteps.find((step) => step.step_key === parsed.data.step_key);

      if (enrollment && shouldAttemptReviewRequested && updatedTargetStep?.status === 'sent') {
        await sendSenzaiEvent({
          event_name: 'review.requested',
          occurred_at: new Date().toISOString(),
          source_event_id: `${parsed.data.enrollment_id}:${parsed.data.step_key}`,
          idempotency_key: `review_enrollment:${parsed.data.enrollment_id}:step:${parsed.data.step_key}:requested`,
          source_route: '/api/review-requests/events',
          authoritative_source: 'review_request_step_sent',
          entity_type: 'review_request_enrollment',
          entity_id: parsed.data.enrollment_id,
          refs: {
            booking_id: enrollment.booking_id,
            customer_id: enrollment.customer_id,
            review_enrollment_id: parsed.data.enrollment_id,
          },
          data: {
            enrollment_id: parsed.data.enrollment_id,
            booking_id: enrollment.booking_id,
            customer_id: enrollment.customer_id,
            email: enrollment.email,
            full_name: enrollment.full_name,
            trail_type: enrollment.trail_type,
            location_name: enrollment.location_name,
            sequence_key: enrollment.sequence_key,
            step_key: parsed.data.step_key,
          },
        });
      }
      break;
    }
    case 'step_skipped':
      await skipReviewRequestStep({
        enrollmentId: parsed.data.enrollment_id,
        stepKey: parsed.data.step_key,
        reason: parsed.data.reason,
      });
      break;
    case 'review_received': {
      const enrollment = await getReviewRequestEnrollmentById(parsed.data.enrollment_id);
      const shouldAttemptReviewReceived =
        Boolean(enrollment) &&
        !enrollment?.review_left_at &&
        enrollment?.status !== 'reviewed';

      await markReviewRequestReceived({
        enrollmentId: parsed.data.enrollment_id,
        platform: parsed.data.platform ?? null,
      });

      const updatedEnrollment = shouldAttemptReviewReceived
        ? await getReviewRequestEnrollmentById(parsed.data.enrollment_id)
        : enrollment;

      if (enrollment && shouldAttemptReviewReceived && updatedEnrollment?.status === 'reviewed') {
        await sendSenzaiEvent({
          event_name: 'review.received',
          occurred_at: new Date().toISOString(),
          source_event_id: parsed.data.enrollment_id,
          idempotency_key: `review_enrollment:${parsed.data.enrollment_id}:received`,
          source_route: '/api/review-requests/events',
          authoritative_source: 'review_request_received',
          entity_type: 'review_request_enrollment',
          entity_id: parsed.data.enrollment_id,
          refs: {
            booking_id: enrollment.booking_id,
            customer_id: enrollment.customer_id,
            review_enrollment_id: parsed.data.enrollment_id,
          },
          data: {
            enrollment_id: parsed.data.enrollment_id,
            booking_id: enrollment.booking_id,
            customer_id: enrollment.customer_id,
            email: enrollment.email,
            full_name: enrollment.full_name,
            trail_type: enrollment.trail_type,
            location_name: enrollment.location_name,
            sequence_key: enrollment.sequence_key,
            platform: parsed.data.platform ?? null,
          },
        });
      }
      break;
    }
  }

  return NextResponse.json({ ok: true });
}

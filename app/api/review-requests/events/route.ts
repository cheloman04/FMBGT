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
      const eventData = parsed.data;
      const enrollment = await getReviewRequestEnrollmentById(eventData.enrollment_id);
      const steps = await getReviewRequestSteps(eventData.enrollment_id);
      const targetStep = steps.find((step) => step.step_key === eventData.step_key);
      const shouldAttemptReviewRequested = targetStep?.status === 'pending';

      await markReviewRequestStepSent({
        enrollmentId: eventData.enrollment_id,
        stepKey: eventData.step_key,
      });

      const updatedSteps = shouldAttemptReviewRequested
        ? await getReviewRequestSteps(eventData.enrollment_id)
        : steps;
      const updatedTargetStep = updatedSteps.find((step) => step.step_key === eventData.step_key);

      if (enrollment && shouldAttemptReviewRequested && updatedTargetStep?.status === 'sent') {
        await sendSenzaiEvent({
          event_name: 'review.requested',
          occurred_at: new Date().toISOString(),
          source_event_id: `${eventData.enrollment_id}:${eventData.step_key}`,
          idempotency_key: `review_enrollment:${eventData.enrollment_id}:step:${eventData.step_key}:requested`,
          source_route: '/api/review-requests/events',
          authoritative_source: 'review_request_step_sent',
          entity_type: 'review_request_enrollment',
          entity_id: eventData.enrollment_id,
          refs: {
            booking_id: enrollment.booking_id,
            customer_id: enrollment.customer_id,
            review_enrollment_id: eventData.enrollment_id,
          },
          data: {
            enrollment_id: eventData.enrollment_id,
            booking_id: enrollment.booking_id,
            customer_id: enrollment.customer_id,
            email: enrollment.email,
            full_name: enrollment.full_name,
            trail_type: enrollment.trail_type,
            location_name: enrollment.location_name,
            sequence_key: enrollment.sequence_key,
            step_key: eventData.step_key,
          },
        });
      }
      break;
    }
    case 'step_skipped': {
      const eventData = parsed.data;
      await skipReviewRequestStep({
        enrollmentId: eventData.enrollment_id,
        stepKey: eventData.step_key,
        reason: eventData.reason,
      });
      break;
    }
    case 'review_received': {
      const eventData = parsed.data;
      const enrollment = await getReviewRequestEnrollmentById(eventData.enrollment_id);
      const shouldAttemptReviewReceived =
        Boolean(enrollment) &&
        !enrollment?.review_left_at &&
        enrollment?.status !== 'reviewed';

      await markReviewRequestReceived({
        enrollmentId: eventData.enrollment_id,
        platform: eventData.platform ?? null,
      });

      const updatedEnrollment = shouldAttemptReviewReceived
        ? await getReviewRequestEnrollmentById(eventData.enrollment_id)
        : enrollment;

      if (enrollment && shouldAttemptReviewReceived && updatedEnrollment?.status === 'reviewed') {
        await sendSenzaiEvent({
          event_name: 'review.received',
          occurred_at: new Date().toISOString(),
          source_event_id: eventData.enrollment_id,
          idempotency_key: `review_enrollment:${eventData.enrollment_id}:received`,
          source_route: '/api/review-requests/events',
          authoritative_source: 'review_request_received',
          entity_type: 'review_request_enrollment',
          entity_id: eventData.enrollment_id,
          refs: {
            booking_id: enrollment.booking_id,
            customer_id: enrollment.customer_id,
            review_enrollment_id: eventData.enrollment_id,
          },
          data: {
            enrollment_id: eventData.enrollment_id,
            booking_id: enrollment.booking_id,
            customer_id: enrollment.customer_id,
            email: enrollment.email,
            full_name: enrollment.full_name,
            trail_type: enrollment.trail_type,
            location_name: enrollment.location_name,
            sequence_key: enrollment.sequence_key,
            platform: eventData.platform ?? null,
          },
        });
      }
      break;
    }
  }

  return NextResponse.json({ ok: true });
}

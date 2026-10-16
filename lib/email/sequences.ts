import 'server-only';

// The two marketing sequences, run by the app instead of n8n.
//
// n8n's "LEAD - Follow-Up Processor (Cron)" and "COMPLETED_SERVICES_Review_Flow"
// polled the due steps, asked the app whether each lead or booking was still
// eligible, sent the email over SMTP and reported back. This does the same in one
// place, on the /api/cron/emails tick, and hands the email to Kigaru:
//
//   due step → still eligible? → render → queueEmail (key `<type>:<step id>`) → mark sent
//
// Only for the sequences switched over (`KIGARU_EMAIL_TYPES`): turn the n8n
// workflow OFF before switching a sequence on, or both would send it.
//
// Safe to run twice at once: the idempotency key is the step's id, so two ticks
// that pick the same step hand the hub one email, and marking a step only moves
// it out of `pending`.

import { getSupabaseAdmin } from '@/lib/supabase';
import { getAppUrl } from '@/lib/app-url';
import { formatSkillLevel } from '@/lib/booking-email';
import {
  evaluateLeadFollowUpEligibility,
  getFollowUpEnrollmentById,
  markFollowUpStepSent,
  markLeadAndEnrollmentLost,
  skipFollowUpStep,
  type FollowUpStepKey,
} from '@/lib/lead-followup';
import {
  evaluateReviewRequestEligibility,
  getReviewRequestEnrollmentById,
  recordReviewRequestStepSent,
  skipReviewRequestStep,
  type ReviewRequestStepKey,
} from '@/lib/review-requests';
import { sendsViaKigaru } from './config';
import { queueEmail } from './outbox';
import { firstName } from './templates/booking-confirmed';
import { renderLeadFollowUp } from './templates/lead-follow-up';
import { renderReviewRequest } from './templates/review-request';

/**
 * A step more than this late is skipped, not sent: a "1 hour" follow-up that
 * arrives days later (n8n down, a backlog at switch-over) does more harm than good.
 */
export const MAX_STEP_LATENESS_MS = 48 * 60 * 60 * 1000;
const STEPS_PER_TICK = 25;

type DueStep = { id: string; enrollment_id: string; step_key: string; scheduled_for: string };

export type SequenceSummary = { due: number; sent: number; skipped: number; failed: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

async function dueSteps(db: Db, table: string, now: Date): Promise<DueStep[]> {
  const { data, error } = await db
    .from(table)
    .select('id, enrollment_id, step_key, scheduled_for')
    .eq('status', 'pending')
    .lte('scheduled_for', now.toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(STEPS_PER_TICK);
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as DueStep[];
}

/** Whether a step is too late to send (see MAX_STEP_LATENESS_MS). */
export function tooLate(scheduledFor: string, now: Date): boolean {
  return now.getTime() - new Date(scheduledFor).getTime() > MAX_STEP_LATENESS_MS;
}

export async function processLeadFollowUps(now: Date = new Date(), deps: { db?: Db } = {}): Promise<SequenceSummary> {
  const summary: SequenceSummary = { due: 0, sent: 0, skipped: 0, failed: 0 };
  const db: Db = deps.db ?? getSupabaseAdmin();
  const steps = await dueSteps(db, 'lead_followup_steps', now);
  summary.due = steps.length;

  for (const step of steps) {
    const stepKey = step.step_key as FollowUpStepKey;
    try {
      if (tooLate(step.scheduled_for, now)) {
        await skipFollowUpStep({ enrollmentId: step.enrollment_id, stepKey, reason: 'overdue' });
        summary.skipped++;
        continue;
      }
      const enrollment = await getFollowUpEnrollmentById(step.enrollment_id);
      if (!enrollment) {
        await skipFollowUpStep({ enrollmentId: step.enrollment_id, stepKey, reason: 'enrollment_not_found' });
        summary.skipped++;
        continue;
      }
      const eligibility = await evaluateLeadFollowUpEligibility(enrollment.lead_id, enrollment.id);
      const lead = eligibility.lead;
      if (!eligibility.eligible || !lead) {
        await skipFollowUpStep({ enrollmentId: enrollment.id, stepKey, reason: eligibility.reason || 'lead_not_eligible' });
        summary.skipped++;
        continue;
      }
      if (!lead.email) {
        await skipFollowUpStep({ enrollmentId: enrollment.id, stepKey, reason: 'missing_email' });
        summary.skipped++;
        continue;
      }

      const { subject, html, text } = renderLeadFollowUp({
        stepKey,
        trailType: enrollment.trail_type,
        firstName: firstName(lead.full_name),
        skillLevel: lead.selected_skill_level ? formatSkillLevel(lead.selected_skill_level) : null,
        locationName: lead.selected_location_name,
        enrollmentId: enrollment.id,
        sequenceKey: enrollment.sequence_key,
        siteUrl: getAppUrl(),
      });
      const result = await queueEmail({
        type: 'lead_follow_up',
        to: lead.email,
        subject,
        html,
        text,
        idempotencyKey: `lead_follow_up:${step.id}`,
        entityType: 'lead',
        entityId: lead.id,
      });

      // The outbox itself failed: leave the step pending for the next tick.
      if (result.state === 'error') throw new Error(result.error ?? 'email outbox error');
      if (!result.ok) {
        // A final no from the hub (an unsubscribed or bouncing address, a bad
        // body) or no usable address: skip the step with the reason. A retry in
        // flight counts as sent.
        await skipFollowUpStep({ enrollmentId: enrollment.id, stepKey, reason: `email_${result.state}` });
        summary.failed++;
        continue;
      }
      await markFollowUpStepSent({ enrollmentId: enrollment.id, stepKey });
      // n8n marked the lead lost right after the last email: same here.
      if (stepKey === '1_week') await markLeadAndEnrollmentLost(enrollment.id);
      summary.sent++;
    } catch (error) {
      // The step stays pending and is tried again on the next tick.
      console.error('[email-sequences] lead follow-up step failed', { step: step.id, error: error instanceof Error ? error.message : error });
      summary.failed++;
    }
  }
  return summary;
}

export async function processReviewRequests(now: Date = new Date(), deps: { db?: Db } = {}): Promise<SequenceSummary> {
  const summary: SequenceSummary = { due: 0, sent: 0, skipped: 0, failed: 0 };
  const db: Db = deps.db ?? getSupabaseAdmin();
  const steps = await dueSteps(db, 'booking_review_request_steps', now);
  summary.due = steps.length;

  for (const step of steps) {
    const stepKey = step.step_key as ReviewRequestStepKey;
    try {
      if (tooLate(step.scheduled_for, now)) {
        await skipReviewRequestStep({ enrollmentId: step.enrollment_id, stepKey, reason: 'overdue' });
        summary.skipped++;
        continue;
      }
      const enrollment = await getReviewRequestEnrollmentById(step.enrollment_id);
      if (!enrollment) {
        await skipReviewRequestStep({ enrollmentId: step.enrollment_id, stepKey, reason: 'enrollment_not_found' });
        summary.skipped++;
        continue;
      }
      const eligibility = await evaluateReviewRequestEligibility(enrollment.booking_id, enrollment.id);
      const booking = eligibility.booking;
      if (!eligibility.eligible || !booking?.customer_email) {
        await skipReviewRequestStep({ enrollmentId: enrollment.id, stepKey, reason: eligibility.reason || 'booking_not_eligible' });
        summary.skipped++;
        continue;
      }

      const { subject, html, text } = renderReviewRequest({
        stepKey,
        trailType: enrollment.trail_type,
        firstName: firstName(booking.customer_name ?? enrollment.full_name),
        locationName: enrollment.location_name ?? booking.location_name,
        enrollmentId: enrollment.id,
        bookingId: enrollment.booking_id,
        sequenceKey: enrollment.sequence_key,
        siteUrl: getAppUrl(),
      });
      const result = await queueEmail({
        type: 'review_request',
        to: booking.customer_email,
        subject,
        html,
        text,
        idempotencyKey: `review_request:${step.id}`,
        entityType: 'booking',
        entityId: enrollment.booking_id,
      });

      if (result.state === 'error') throw new Error(result.error ?? 'email outbox error');
      if (!result.ok) {
        await skipReviewRequestStep({ enrollmentId: enrollment.id, stepKey, reason: `email_${result.state}` });
        summary.failed++;
        continue;
      }
      await recordReviewRequestStepSent({ enrollmentId: enrollment.id, stepKey, sourceRoute: '/api/cron/emails' });
      summary.sent++;
    } catch (error) {
      console.error('[email-sequences] review request step failed', { step: step.id, error: error instanceof Error ? error.message : error });
      summary.failed++;
    }
  }
  return summary;
}

/** The sequences switched over to Kigaru, run once. The others are left to n8n. */
export async function runEmailSequences(now: Date = new Date()): Promise<Record<string, SequenceSummary | 'n8n'>> {
  return {
    lead_follow_up: sendsViaKigaru('lead_follow_up') ? await processLeadFollowUps(now) : 'n8n',
    review_request: sendsViaKigaru('review_request') ? await processReviewRequests(now) : 'n8n',
  };
}

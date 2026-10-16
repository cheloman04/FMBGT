import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock('@/lib/app-url', () => ({ getAppUrl: () => 'https://www.floridamountainbikeguides.com' }));
vi.mock('@/lib/booking-email', () => ({ formatSkillLevel: (s: string) => (s === 'beginner' ? 'Beginner' : s) }));

const m = vi.hoisted(() => ({
  queueEmail: vi.fn(),
  evaluateLeadFollowUpEligibility: vi.fn(),
  getFollowUpEnrollmentById: vi.fn(),
  markFollowUpStepSent: vi.fn(),
  markLeadAndEnrollmentLost: vi.fn(),
  skipFollowUpStep: vi.fn(),
  evaluateReviewRequestEligibility: vi.fn(),
  getReviewRequestEnrollmentById: vi.fn(),
  recordReviewRequestStepSent: vi.fn(),
  skipReviewRequestStep: vi.fn(),
}));
vi.mock('./outbox', () => ({ queueEmail: m.queueEmail }));
vi.mock('@/lib/lead-followup', () => ({
  evaluateLeadFollowUpEligibility: m.evaluateLeadFollowUpEligibility,
  getFollowUpEnrollmentById: m.getFollowUpEnrollmentById,
  markFollowUpStepSent: m.markFollowUpStepSent,
  markLeadAndEnrollmentLost: m.markLeadAndEnrollmentLost,
  skipFollowUpStep: m.skipFollowUpStep,
}));
vi.mock('@/lib/review-requests', () => ({
  evaluateReviewRequestEligibility: m.evaluateReviewRequestEligibility,
  getReviewRequestEnrollmentById: m.getReviewRequestEnrollmentById,
  recordReviewRequestStepSent: m.recordReviewRequestStepSent,
  skipReviewRequestStep: m.skipReviewRequestStep,
}));

import { processLeadFollowUps, processReviewRequests, tooLate } from './sequences';

const NOW = new Date('2026-10-16T12:00:00Z');
const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60_000).toISOString();

/** A db that returns `steps` for the due-steps query and records the filters. */
function dbWith(steps: Array<{ id: string; enrollment_id: string; step_key: string; scheduled_for: string }>) {
  const filters: Array<[string, unknown]> = [];
  const q = {
    select: () => q,
    eq: (k: string, v: unknown) => (filters.push([k, v]), q),
    lte: (k: string, v: unknown) => (filters.push([k, v]), q),
    order: () => q,
    limit: async () => ({ data: steps, error: null }),
  };
  return { db: { from: () => q }, filters };
}

const ENROLLMENT = { id: 'enr-1', lead_id: 'lead-1', trail_type: 'mtb', sequence_key: 'default_lead_recovery' };
const LEAD = {
  id: 'lead-1',
  full_name: 'Maria Gomez',
  email: 'maria@resend.dev',
  selected_skill_level: 'beginner',
  selected_location_name: 'Mount Dora',
};

describe('lead follow-ups through Kigaru', () => {
  beforeEach(() => {
    Object.values(m).forEach((f) => f.mockReset());
    m.getFollowUpEnrollmentById.mockResolvedValue(ENROLLMENT);
    m.evaluateLeadFollowUpEligibility.mockResolvedValue({ eligible: true, reason: null, lead: LEAD, enrollment: ENROLLMENT });
    m.queueEmail.mockResolvedValue({ ok: true, state: 'sent', httpStatus: 202, error: null });
  });

  it('reads only pending steps that are due', async () => {
    const { db, filters } = dbWith([]);
    await processLeadFollowUps(NOW, { db });
    expect(filters).toEqual([
      ['status', 'pending'],
      ['scheduled_for', NOW.toISOString()],
    ]);
  });

  it('renders the step, queues it with the step id as the key, and marks it sent', async () => {
    const { db } = dbWith([{ id: 'step-1', enrollment_id: 'enr-1', step_key: '1_day', scheduled_for: minutesAgo(3) }]);
    const out = await processLeadFollowUps(NOW, { db });
    expect(out).toEqual({ due: 1, sent: 1, skipped: 0, failed: 0 });
    const intent = m.queueEmail.mock.calls[0][0];
    expect(intent).toMatchObject({
      type: 'lead_follow_up',
      to: 'maria@resend.dev',
      idempotencyKey: 'lead_follow_up:step-1',
      entityType: 'lead',
      entityId: 'lead-1',
      subject: 'Maria, if you can ride a bike, you can do this 🚵‍♂️',
    });
    expect(intent.html).toContain('Beginner');
    expect(intent.html).toContain('{{unsubscribe_url}}');
    expect(m.markFollowUpStepSent).toHaveBeenCalledWith({ enrollmentId: 'enr-1', stepKey: '1_day' });
    expect(m.markLeadAndEnrollmentLost).not.toHaveBeenCalled();
  });

  it('the last step marks the lead lost, as n8n did', async () => {
    const { db } = dbWith([{ id: 'step-3', enrollment_id: 'enr-1', step_key: '1_week', scheduled_for: minutesAgo(1) }]);
    await processLeadFollowUps(NOW, { db });
    expect(m.markLeadAndEnrollmentLost).toHaveBeenCalledWith('enr-1');
  });

  it('a lead that converted is skipped with the reason, no email', async () => {
    m.evaluateLeadFollowUpEligibility.mockResolvedValue({ eligible: false, reason: 'lead_converted', lead: LEAD, enrollment: ENROLLMENT });
    const { db } = dbWith([{ id: 'step-1', enrollment_id: 'enr-1', step_key: '1_hour', scheduled_for: minutesAgo(1) }]);
    const out = await processLeadFollowUps(NOW, { db });
    expect(out.skipped).toBe(1);
    expect(m.queueEmail).not.toHaveBeenCalled();
    expect(m.skipFollowUpStep).toHaveBeenCalledWith({ enrollmentId: 'enr-1', stepKey: '1_hour', reason: 'lead_converted' });
  });

  it('🪤 a step more than 48 h late is skipped as overdue, never sent', async () => {
    const { db } = dbWith([{ id: 'step-1', enrollment_id: 'enr-1', step_key: '1_hour', scheduled_for: minutesAgo(49 * 60) }]);
    const out = await processLeadFollowUps(NOW, { db });
    expect(out.skipped).toBe(1);
    expect(m.queueEmail).not.toHaveBeenCalled();
    expect(m.skipFollowUpStep).toHaveBeenCalledWith({ enrollmentId: 'enr-1', stepKey: '1_hour', reason: 'overdue' });
    expect(tooLate(minutesAgo(47 * 60), NOW)).toBe(false);
  });

  it('an unsubscribed address (422 suppressed) skips the step; a retry in flight counts as sent', async () => {
    m.queueEmail.mockResolvedValueOnce({ ok: false, state: 'rejected', httpStatus: 422, error: 'suppressed: unsubscribed' });
    m.queueEmail.mockResolvedValueOnce({ ok: true, state: 'pending', httpStatus: 503, error: 'paused' });
    const { db } = dbWith([
      { id: 'step-1', enrollment_id: 'enr-1', step_key: '1_hour', scheduled_for: minutesAgo(2) },
      { id: 'step-2', enrollment_id: 'enr-1', step_key: '1_day', scheduled_for: minutesAgo(1) },
    ]);
    const out = await processLeadFollowUps(NOW, { db });
    expect(out).toMatchObject({ sent: 1, failed: 1 });
    expect(m.skipFollowUpStep).toHaveBeenCalledWith({ enrollmentId: 'enr-1', stepKey: '1_hour', reason: 'email_rejected' });
    expect(m.markFollowUpStepSent).toHaveBeenCalledWith({ enrollmentId: 'enr-1', stepKey: '1_day' });
  });

  it('🪤 if the outbox itself fails, the step stays pending for the next tick', async () => {
    m.queueEmail.mockResolvedValue({ ok: false, state: 'error', httpStatus: null, error: 'outbox: db down' });
    const { db } = dbWith([{ id: 'step-1', enrollment_id: 'enr-1', step_key: '1_hour', scheduled_for: minutesAgo(2) }]);
    const out = await processLeadFollowUps(NOW, { db });
    expect(out.failed).toBe(1);
    expect(m.skipFollowUpStep).not.toHaveBeenCalled();
    expect(m.markFollowUpStepSent).not.toHaveBeenCalled();
  });
});

describe('review requests through Kigaru', () => {
  const REVIEW_ENROLLMENT = {
    id: 'renr-1',
    booking_id: '8c1e2f4a-0000-4000-8000-000000000001',
    trail_type: 'paved',
    location_name: 'Downtown Sanford',
    full_name: 'Jake P',
    sequence_key: 'completed_service_review_request',
  };

  beforeEach(() => {
    Object.values(m).forEach((f) => f.mockReset());
    m.getReviewRequestEnrollmentById.mockResolvedValue(REVIEW_ENROLLMENT);
    m.evaluateReviewRequestEligibility.mockResolvedValue({
      eligible: true,
      reason: null,
      booking: { customer_email: 'jake@resend.dev', customer_name: 'Jake Peters', location_name: 'Downtown Sanford' },
      enrollment: REVIEW_ENROLLMENT,
    });
    m.queueEmail.mockResolvedValue({ ok: true, state: 'sent', httpStatus: 202, error: null });
  });

  it('queues the review email for the booking and reports the step with review.requested', async () => {
    const { db } = dbWith([{ id: 'rstep-1', enrollment_id: 'renr-1', step_key: 'same_day', scheduled_for: minutesAgo(1) }]);
    const out = await processReviewRequests(NOW, { db });
    expect(out.sent).toBe(1);
    expect(m.queueEmail.mock.calls[0][0]).toMatchObject({
      type: 'review_request',
      to: 'jake@resend.dev',
      idempotencyKey: 'review_request:rstep-1',
      entityType: 'booking',
      entityId: REVIEW_ENROLLMENT.booking_id,
      subject: 'Thanks for riding with us today — quick favor? 🌿',
    });
    expect(m.recordReviewRequestStepSent).toHaveBeenCalledWith({ enrollmentId: 'renr-1', stepKey: 'same_day', sourceRoute: '/api/cron/emails' });
  });

  it('a guest who already reviewed is skipped', async () => {
    m.evaluateReviewRequestEligibility.mockResolvedValue({ eligible: false, reason: 'review_already_received', booking: null, enrollment: REVIEW_ENROLLMENT });
    const { db } = dbWith([{ id: 'rstep-2', enrollment_id: 'renr-1', step_key: '1_day', scheduled_for: minutesAgo(1) }]);
    await processReviewRequests(NOW, { db });
    expect(m.queueEmail).not.toHaveBeenCalled();
    expect(m.skipReviewRequestStep).toHaveBeenCalledWith({ enrollmentId: 'renr-1', stepKey: '1_day', reason: 'review_already_received' });
  });
});

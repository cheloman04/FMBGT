// "Send a test email" in /admin/emails: each of the eight customer emails, filled
// with sample data, so the owner can see in a real inbox exactly what his guests
// get — through the real path (outbox → Kigaru hub → Resend), without a booking,
// a lead or n8n.
//
// The subject starts with "[Test] " so a test never passes for a real email, in the
// inbox or in the list. Links that need a real record (calendar, waiver) are left
// out; the booking and review links point at the live site.
//
// No imports but the templates: the tests load this as is.

import type { EmailType } from './config';
import { renderBookingConfirmed } from './templates/booking-confirmed';
import { renderLeadFollowUp, type FollowUpTrail, type LeadFollowUpStepKey } from './templates/lead-follow-up';
import { renderRemainingBalanceFailed, renderRemainingBalancePaid } from './templates/remaining-balance';
import { renderReviewRequest, type ReviewStepKey } from './templates/review-request';

type Sample = { label: string; type: EmailType };

/** The menu of the test dialog, in the order the guest would get them. */
export const TEST_EMAILS = {
  booking_confirmed: { label: 'Booking confirmation', type: 'booking_confirmed' },
  booking_updated: { label: 'Booking updated', type: 'booking_confirmed' },
  remaining_balance_paid: { label: 'Balance paid', type: 'remaining_balance_paid' },
  remaining_balance_failed: { label: 'Balance charge failed', type: 'remaining_balance_failed' },
  lead_1_hour: { label: 'Lead follow-up · 1 hour', type: 'lead_follow_up' },
  lead_1_day: { label: 'Lead follow-up · 1 day', type: 'lead_follow_up' },
  lead_1_week: { label: 'Lead follow-up · 1 week', type: 'lead_follow_up' },
  review_same_day: { label: 'Review request · same day', type: 'review_request' },
  review_1_day: { label: 'Review request · 1 day', type: 'review_request' },
  review_1_week: { label: 'Review request · 1 week', type: 'review_request' },
} as const satisfies Record<string, Sample>;

export type TestEmailKey = keyof typeof TEST_EMAILS;
export const TEST_EMAIL_KEYS = Object.keys(TEST_EMAILS) as [TestEmailKey, ...TestEmailKey[]];

export const TEST_SUBJECT_PREFIX = '[Test] ';

/** Sample places that exist in lib/location-meta.ts, one per trail type. */
export const SAMPLE_LOCATION: Record<FollowUpTrail, string> = {
  paved: 'Sanford Historic Riverfront Tour',
  mtb: 'Mount Dora Mountain Bike Trail, Mount Dora',
};

const SAMPLE_ID = '00000000-0000-4000-8000-000000000000';

/** The next Saturday after `now`, as YYYY-MM-DD: a believable ride date. */
export function nextSaturday(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + (((6 - d.getUTCDay() + 7) % 7) || 7));
  return d.toISOString().slice(0, 10);
}

export function renderTestEmail(
  key: TestEmailKey,
  opts: { trail: FollowUpTrail; siteUrl: string; meetingUrl: string | null; now?: Date },
): { type: EmailType; subject: string; html: string; text: string } {
  const sample = TEST_EMAILS[key];
  const now = opts.now ?? new Date();
  const location = SAMPLE_LOCATION[opts.trail];
  const booking = {
    booking_id: SAMPLE_ID,
    customer_email: null,
    customer_name: 'Alex Sample',
    deposit_amount: 5000,
    remaining_balance: 15000,
    remaining_balance_due_at: `${nextSaturday(now)}T00:00:00Z`,
    total_amount: 20000,
    location,
    date: nextSaturday(now),
    time: '09:00',
    duration_hours: 2,
    participant_count: 2,
    trail_type: opts.trail,
    skill_level: opts.trail === 'mtb' ? 'Beginner' : null,
    meeting_location_url: opts.meetingUrl,
  };

  let rendered: { subject: string; html: string; text: string };
  if (key === 'booking_confirmed') {
    rendered = renderBookingConfirmed(booking);
  } else if (key === 'booking_updated') {
    rendered = renderBookingConfirmed({ ...booking, updated: true, changes_summary: ['Riders: 1 → 2', 'Time: 8:00 AM → 9:00 AM'] });
  } else if (key === 'remaining_balance_paid') {
    rendered = renderRemainingBalancePaid({ ...booking, payment_intent_id: 'pi_test', amount: 15000 });
  } else if (key === 'remaining_balance_failed') {
    rendered = renderRemainingBalanceFailed({ ...booking, payment_intent_id: 'pi_test', amount: 15000 });
  } else if (key.startsWith('lead_')) {
    rendered = renderLeadFollowUp({
      stepKey: key.slice('lead_'.length) as LeadFollowUpStepKey,
      trailType: opts.trail,
      firstName: 'Alex',
      skillLevel: opts.trail === 'mtb' ? 'Beginner' : null,
      locationName: location,
      enrollmentId: 'test-email',
      sequenceKey: 'default_lead_recovery',
      siteUrl: opts.siteUrl,
    });
  } else {
    rendered = renderReviewRequest({
      stepKey: key.slice('review_'.length) as ReviewStepKey,
      trailType: opts.trail,
      firstName: 'Alex',
      locationName: location,
      enrollmentId: 'test-email',
      bookingId: SAMPLE_ID,
      sequenceKey: 'completed_service_review_request',
      siteUrl: opts.siteUrl,
    });
  }

  return { type: sample.type, ...rendered, subject: `${TEST_SUBJECT_PREFIX}${rendered.subject}` };
}

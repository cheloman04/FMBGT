import { describe, expect, it } from 'vitest';
import { BRAND, UNSUBSCRIBE_MARKER, esc, href } from './layout';
import {
  formatLongDate,
  formatTourTime,
  formatUsd,
  renderBookingConfirmed,
  type BookingConfirmedPayload,
} from './templates/booking-confirmed';
import { renderRemainingBalanceFailed, renderRemainingBalancePaid } from './templates/remaining-balance';
import { leadBookingUrl, renderLeadFollowUp, type LeadFollowUpInput } from './templates/lead-follow-up';
import { renderReviewRequest, reviewUrl, type ReviewRequestInput } from './templates/review-request';

const BOOKING: BookingConfirmedPayload = {
  booking_id: '8c1e2f4a-0000-4000-8000-000000000001',
  customer_email: 'guest@resend.dev',
  customer_name: 'Maria Gomez',
  deposit_amount: 5000,
  remaining_balance: 15000,
  remaining_balance_due_at: '2026-10-17T15:00:00Z',
  total_amount: 20000,
  location: 'Downtown Sanford',
  date: '2026-10-18',
  time: '09:00',
  duration_hours: 2,
  participant_count: 2,
  trail_type: 'paved',
  skill_level: 'Beginner',
  meeting_location_url: 'https://maps.google.com/?q=229+Magnolia',
  calendar_url: 'https://www.floridamountainbikeguides.com/api/calendar/8c1e2f4a',
};

const SITE = 'https://www.floridamountainbikeguides.com';

describe('the shared shells', () => {
  it('escapes everything that comes from a booking or a lead', () => {
    expect(esc('<script>"x" & \'y\'')).toBe('&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;');
    expect(href('javascript:alert(1)')).toBe('#');
    expect(href(null)).toBe('#');
    expect(href('https://a.test/x?y=1&z=2')).toBe('https://a.test/x?y=1&amp;z=2');
  });
});

describe('booking_confirmed', () => {
  it('ports the n8n subject, with and without a first name', () => {
    expect(renderBookingConfirmed(BOOKING).subject).toBe('🚴 Your Adventure Starts Here Maria — Let’s Ride!');
    expect(renderBookingConfirmed({ ...BOOKING, customer_name: null }).subject).toBe('🚴 Your Adventure Starts Here — Let’s Ride!');
    expect(renderBookingConfirmed({ ...BOOKING, updated: true }).subject).toBe('✏️ Your booking was updated, Maria');
  });

  it('formats money, date and time the way the n8n code node did', () => {
    expect(formatUsd(15000)).toBe('$150.00');
    expect(formatUsd(null)).toBeNull();
    expect(formatLongDate('2026-10-18')).toBe('Sunday October 18th 2026');
    expect(formatLongDate('2026-10-01')).toBe('Thursday October 1st 2026');
    expect(formatTourTime('09:00')).toBe('9:00 AM ET');
    expect(formatTourTime('13:30')).toBe('1:30 PM ET');
  });

  it('shows the scheduled card charge only when there is a balance and a charge date', () => {
    const { html, text } = renderBookingConfirmed(BOOKING);
    expect(html).toContain('$150.00');
    expect(html).toContain('automatically charged');
    expect(text).toContain('charged to the card on file');
    expect(renderBookingConfirmed({ ...BOOKING, remaining_balance: 0 }).html).not.toContain('automatically charged');
    expect(renderBookingConfirmed({ ...BOOKING, remaining_balance_due_at: null }).html).not.toContain('automatically charged');
  });

  it('a manual cash booking: balance due on the day and the waiver link, no card charge', () => {
    const { html } = renderBookingConfirmed({
      ...BOOKING,
      manual_booking: true,
      remaining_balance_due_at: null,
      waiver_url: 'https://www.floridamountainbikeguides.com/waiver/abc',
      waiver_signed: false,
    });
    expect(html).toContain('payable on the day of your ride');
    expect(html).toContain('Sign the Waiver');
    expect(html).toContain('/waiver/abc');
    expect(html).not.toContain('automatically charged');
  });

  it('a gift-card booking says so instead of a $0.00 deposit', () => {
    const { html } = renderBookingConfirmed({ ...BOOKING, deposit_amount: 0, remaining_balance: 0, gift_card_covered: true });
    expect(html).toContain('Gift card');
    expect(html).not.toContain('Deposit paid');
  });

  it('an update lists the changes, escaped', () => {
    const { html } = renderBookingConfirmed({ ...BOOKING, updated: true, changes_summary: ['Date: Oct 18 → Oct 19', '<b>Riders</b>: 2 → 3'] });
    expect(html).toContain('Your booking was updated');
    expect(html).toContain('Date: Oct 18 → Oct 19');
    expect(html).toContain('&lt;b&gt;Riders&lt;/b&gt;');
  });

  it('is transactional: no unsubscribe marker, but the postal address and the reply line', () => {
    const { html, text } = renderBookingConfirmed(BOOKING);
    expect(html).not.toContain(UNSUBSCRIBE_MARKER);
    expect(html).toContain(BRAND.postalAddress[0]);
    expect(text).toContain('Reply to this email');
  });
});

describe('remaining balance', () => {
  const data = { ...BOOKING, payment_intent_id: 'pi_123', amount: 15000 };

  it('paid: the amount, the ride and the meeting point', () => {
    const { subject, html, text } = renderRemainingBalancePaid(data);
    expect(subject).toBe("You're all paid up, Maria: see you on the trail");
    expect(html).toContain('$150.00');
    expect(html).toContain('Sunday October 18th 2026');
    expect(text).toContain('Meeting point');
  });

  it('failed: asks the guest to reply, keeps the spot, no unsubscribe', () => {
    const { subject, html, text } = renderRemainingBalanceFailed(data);
    expect(subject).toBe("Maria, we couldn't charge your remaining balance");
    expect(renderRemainingBalanceFailed({ ...data, customer_name: '' }).subject).toBe("We couldn't charge your remaining balance");
    expect(html).toContain('Your spot is still held');
    expect(text).toContain('reply to this email');
    expect(html).not.toContain(UNSUBSCRIBE_MARKER);
  });
});

const LEAD: LeadFollowUpInput = {
  stepKey: '1_hour',
  trailType: 'paved',
  firstName: 'Maria',
  skillLevel: null,
  locationName: null,
  enrollmentId: '11111111-2222-4333-8444-555555555555',
  sequenceKey: 'default_lead_recovery',
  siteUrl: SITE,
};

describe('lead follow-ups (marketing)', () => {
  it('has the six n8n variants, each with its subject', () => {
    const subjects = (['paved', 'mtb'] as const).flatMap((trailType) =>
      (['1_hour', '1_day', '1_week'] as const).map((stepKey) => renderLeadFollowUp({ ...LEAD, trailType, stepKey }).subject),
    );
    expect(subjects).toEqual([
      'Still thinking it over, Maria? Let’s get your ride booked 🌿',
      'Maria, your paved trail ride is waiting for you 🌴',
      'Last reminder Maria, complete your paved trail adventure 🚴‍♂️',
      'Maria, your MTB adventure is waiting 🔥🚵',
      'Maria, if you can ride a bike, you can do this 🚵‍♂️',
      'Maria, One last reminder: the trail is still waiting 🚵‍♂️',
    ]);
  });

  it('never starts a subject or headline with a comma when there is no name', () => {
    for (const stepKey of ['1_hour', '1_day', '1_week'] as const) {
      for (const trailType of ['paved', 'mtb'] as const) {
        const { subject, html } = renderLeadFollowUp({ ...LEAD, trailType, stepKey, firstName: null });
        expect(subject.startsWith(',')).toBe(false);
        expect(subject).not.toContain('null');
        expect(html).not.toContain('>, ');
      }
    }
  });

  it('carries the unsubscribe marker in html AND text, and the postal address (CAN-SPAM)', () => {
    const { html, text } = renderLeadFollowUp(LEAD);
    expect(html).toContain(`href="${UNSUBSCRIBE_MARKER}"`);
    expect(text).toContain(UNSUBSCRIBE_MARKER);
    expect(html).toContain(BRAND.postalAddress[0]);
    expect(text).toContain(BRAND.postalAddress[0]);
  });

  it('the booking link keeps the n8n tracking', () => {
    const url = new URL(leadBookingUrl({ ...LEAD, trailType: 'mtb', stepKey: '1_day' }));
    expect(url.origin + url.pathname).toBe(`${SITE}/booking`);
    expect(url.searchParams.get('utm_campaign')).toBe('lead_recovery');
    expect(url.searchParams.get('template_key')).toBe('mtb_1_day');
    expect(url.searchParams.get('enrollment_id')).toBe(LEAD.enrollmentId);
    expect(renderLeadFollowUp(LEAD).html).toContain('utm_campaign=lead_recovery');
  });

  it('MTB shows the skill level, with the n8n fallback', () => {
    expect(renderLeadFollowUp({ ...LEAD, trailType: 'mtb', skillLevel: 'Beginner' }).html).toContain('Beginner');
    expect(renderLeadFollowUp({ ...LEAD, trailType: 'mtb' }).html).toContain('Any level welcome');
    expect(renderLeadFollowUp(LEAD).html).toContain('Choose Downtown Sanford or Blue Springs Trail');
  });
});

const REVIEW: ReviewRequestInput = {
  stepKey: 'same_day',
  trailType: 'mtb',
  firstName: 'Jake',
  locationName: 'Mount Dora',
  enrollmentId: '22222222-2222-4333-8444-555555555555',
  bookingId: '8c1e2f4a-0000-4000-8000-000000000001',
  sequenceKey: 'completed_service_review_request',
  siteUrl: SITE,
};

describe('review requests (marketing)', () => {
  it('has the six n8n variants; the 1-day MTB subject uses the first name, not the full one', () => {
    const subjects = (['paved', 'mtb'] as const).flatMap((trailType) =>
      (['same_day', '1_day', '1_week'] as const).map((stepKey) => renderReviewRequest({ ...REVIEW, trailType, stepKey }).subject),
    );
    expect(subjects).toEqual([
      'Thanks for riding with us today — quick favor? 🌿',
      'Jake, how was yesterday’s ride? 🚴‍♂️⭐',
      'Your feedback would mean a lot to us, Jake 🙌',
      'You crushed it today — mind sharing a quick review? 🔥',
      'Jake, still smiling from yesterday’s ride? 🚵⭐',
      'Jake, still willing to share your MTB experience? 🚵',
    ]);
  });

  it('carries the unsubscribe marker and the postal address', () => {
    const { html, text } = renderReviewRequest(REVIEW);
    expect(html).toContain(UNSUBSCRIBE_MARKER);
    expect(text).toContain(UNSUBSCRIBE_MARKER);
    expect(html).toContain(BRAND.postalAddress[1]);
  });

  it('the review link goes to the app’s /review page with the n8n tracking', () => {
    const url = new URL(reviewUrl(REVIEW));
    expect(url.origin + url.pathname).toBe(`${SITE}/review`);
    expect(url.searchParams.get('cta')).toBe('leave_google_review');
    expect(url.searchParams.get('booking_id')).toBe(REVIEW.bookingId);
    expect(url.searchParams.get('first_name')).toBe('Jake');
    expect(new URL(reviewUrl({ ...REVIEW, firstName: null, locationName: null })).searchParams.has('first_name')).toBe(false);
  });
});

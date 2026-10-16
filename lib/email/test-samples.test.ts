import { describe, expect, it } from 'vitest';
import { UNSUBSCRIBE_MARKER } from './layout';
import { TEST_EMAILS, TEST_EMAIL_KEYS, TEST_SUBJECT_PREFIX, nextSaturday, renderTestEmail } from './test-samples';

const OPTS = { siteUrl: 'https://www.floridamountainbikeguides.com', meetingUrl: 'https://maps.test/x', now: new Date('2026-10-16T12:00:00Z') };

describe('test emails', () => {
  it('covers the eight customer emails (plus "booking updated"), each with its real email type', () => {
    expect(TEST_EMAIL_KEYS).toHaveLength(10);
    expect(new Set(Object.values(TEST_EMAILS).map((s) => s.type))).toEqual(
      new Set(['booking_confirmed', 'remaining_balance_paid', 'remaining_balance_failed', 'lead_follow_up', 'review_request']),
    );
  });

  it('every sample renders in both trails, with [Test] in the subject and no unfilled placeholder but the unsubscribe one', () => {
    for (const key of TEST_EMAIL_KEYS) {
      for (const trail of ['paved', 'mtb'] as const) {
        const r = renderTestEmail(key, { ...OPTS, trail });
        expect(r.subject.startsWith(TEST_SUBJECT_PREFIX), key).toBe(true);
        expect(r.type).toBe(TEST_EMAILS[key].type);
        expect(r.html.replaceAll(UNSUBSCRIBE_MARKER, '')).not.toMatch(/\{\{|undefined|null|NaN/);
        expect(r.text).not.toMatch(/undefined|NaN/);
      }
    }
  });

  it('the marketing samples carry the unsubscribe marker; the booking ones do not', () => {
    expect(renderTestEmail('lead_1_hour', { ...OPTS, trail: 'paved' }).html).toContain(UNSUBSCRIBE_MARKER);
    expect(renderTestEmail('review_1_week', { ...OPTS, trail: 'mtb' }).text).toContain(UNSUBSCRIBE_MARKER);
    expect(renderTestEmail('booking_confirmed', { ...OPTS, trail: 'paved' }).html).not.toContain(UNSUBSCRIBE_MARKER);
  });

  it('uses believable sample data: the next Saturday, the sample guest, the trail’s place', () => {
    expect(nextSaturday(new Date('2026-10-16T12:00:00Z'))).toBe('2026-10-17');
    expect(nextSaturday(new Date('2026-10-17T12:00:00Z'))).toBe('2026-10-24');
    const r = renderTestEmail('booking_confirmed', { ...OPTS, trail: 'mtb' });
    expect(r.subject).toBe('[Test] 🚴 Your Adventure Starts Here Alex — Let’s Ride!');
    expect(r.html).toContain('Saturday October 17th 2026');
    expect(r.html).toContain('Mount Dora');
    expect(r.html).toContain('https://maps.test/x');
    expect(renderTestEmail('booking_updated', { ...OPTS, trail: 'paved' }).html).toContain('Your booking was updated');
  });
});

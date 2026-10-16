import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/app-url', () => ({ getAppUrl: () => 'https://www.floridamountainbikeguides.com' }));
vi.mock('@/lib/location-meta', () => ({ getBookingLocationMeta: () => ({ meetingPointUrl: 'https://maps.test/x' }) }));

const m = vi.hoisted(() => ({ triggerN8nEvent: vi.fn(), queueEmail: vi.fn(), booking: null as unknown }));
vi.mock('@/lib/n8n', () => ({ triggerN8nEvent: m.triggerN8nEvent }));
vi.mock('./outbox', () => ({ queueEmail: m.queueEmail }));
vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: m.booking, error: null }) }) }) }),
  }),
}));

import { sendBookingConfirmedEmail, sendRemainingBalanceFailedEmail, sendRemainingBalancePaidEmail } from './send';

const DATA = {
  booking_id: '8c1e2f4a-0000-4000-8000-000000000001',
  customer_email: 'guest@resend.dev',
  customer_name: 'Maria Gomez',
  date: '2026-10-18',
  time: '09:00',
};

describe('the switch decides who sends', () => {
  beforeEach(() => {
    m.triggerN8nEvent.mockReset().mockResolvedValue({ ok: true, attemptedAt: 't', statusCode: 200, error: null });
    m.queueEmail.mockReset().mockResolvedValue({ ok: true, state: 'sent', httpStatus: 202, error: null });
  });
  afterEach(() => vi.unstubAllEnvs());

  it('a type that is not switched over goes to n8n with the same payload as before', async () => {
    vi.stubEnv('KIGARU_EMAIL_TYPES', 'review_request');
    const out = await sendBookingConfirmedEmail({ data: DATA, source: '/api/webhooks/stripe' });
    expect(out).toMatchObject({ ok: true, via: 'n8n', statusCode: 200 });
    expect(m.triggerN8nEvent).toHaveBeenCalledWith({
      event: 'booking_confirmed',
      data: DATA,
      source: '/api/webhooks/stripe',
      envKeys: ['N8N_WEBHOOK_URL'],
      webhookUrl: undefined,
    });
    expect(m.queueEmail).not.toHaveBeenCalled();
  });

  it('switched over: rendered and queued for Kigaru; the first confirmation has ONE key per booking', async () => {
    vi.stubEnv('KIGARU_EMAIL_TYPES', 'booking_confirmed');
    const out = await sendBookingConfirmedEmail({ data: DATA, source: '/api/webhooks/stripe' });
    expect(out).toMatchObject({ ok: true, via: 'kigaru', statusCode: 202, error: null });
    expect(m.triggerN8nEvent).not.toHaveBeenCalled();
    expect(m.queueEmail.mock.calls[0][0]).toMatchObject({
      type: 'booking_confirmed',
      to: 'guest@resend.dev',
      idempotencyKey: `booking_confirmed:${DATA.booking_id}`,
      entityType: 'booking',
      entityId: DATA.booking_id,
      subject: '🚴 Your Adventure Starts Here Maria — Let’s Ride!',
    });
  });

  it('a resend or an edit gets a key of its own, so it always goes out', async () => {
    vi.stubEnv('KIGARU_EMAIL_TYPES', '*');
    await sendBookingConfirmedEmail({ data: DATA, source: 'x', repeat: true });
    await sendBookingConfirmedEmail({ data: DATA, source: 'x', repeat: true });
    const [a, b] = m.queueEmail.mock.calls.map((c) => c[0].idempotencyKey as string);
    expect(a).toMatch(new RegExp(`^booking_confirmed:${DATA.booking_id}:[0-9a-f-]{36}$`));
    expect(a).not.toBe(b);
    expect(a.length).toBeLessThanOrEqual(120);
  });

  it('a final no from Kigaru is ok: false with the reason, for the booking columns', async () => {
    vi.stubEnv('KIGARU_EMAIL_TYPES', 'booking_confirmed');
    m.queueEmail.mockResolvedValue({ ok: false, state: 'rejected', httpStatus: 422, error: 'not_configured: Email is not set up' });
    const out = await sendBookingConfirmedEmail({ data: DATA, source: 'x' });
    expect(out).toMatchObject({ ok: false, statusCode: 422, error: 'not_configured: Email is not set up', via: 'kigaru' });
  });

  it('balance paid: one email per PaymentIntent; n8n keeps its own webhook URL', async () => {
    vi.stubEnv('KIGARU_EMAIL_TYPES', 'remaining_balance_paid');
    await sendRemainingBalancePaidEmail({ data: { ...DATA, payment_intent_id: 'pi_1', amount: 15000 }, source: 'x' });
    expect(m.queueEmail.mock.calls[0][0].idempotencyKey).toBe('remaining_balance_paid:pi_1');

    vi.stubEnv('KIGARU_EMAIL_TYPES', '');
    await sendRemainingBalancePaidEmail({ data: { ...DATA, payment_intent_id: 'pi_1', amount: 1 }, source: 'x', n8n: { webhookUrl: 'https://n8n.test/rb' } });
    expect(m.triggerN8nEvent.mock.calls[0][0]).toMatchObject({ event: 'remaining_balance_paid', webhookUrl: 'https://n8n.test/rb' });
  });

  it('balance failed: through n8n the old payload; through Kigaru the guest comes from the booking', async () => {
    vi.stubEnv('KIGARU_EMAIL_TYPES', '');
    await sendRemainingBalanceFailedEmail({ bookingId: DATA.booking_id, paymentIntentId: 'pi_2', amount: 15000, errorMessage: 'card_declined', source: 'x' });
    expect(m.triggerN8nEvent.mock.calls[0][0].data).toEqual({ booking_id: DATA.booking_id, payment_intent_id: 'pi_2', error_message: 'card_declined' });

    vi.stubEnv('KIGARU_EMAIL_TYPES', 'remaining_balance_failed');
    m.booking = { id: DATA.booking_id, date: '2026-10-18', time_slot: '09:00', duration_hours: 2, participant_count: 2, customers: { name: 'Maria Gomez', email: 'guest@resend.dev' }, locations: { name: 'Downtown Sanford' } };
    await sendRemainingBalanceFailedEmail({ bookingId: DATA.booking_id, paymentIntentId: 'pi_2', amount: 15000, errorMessage: 'card_declined', source: 'x' });
    expect(m.queueEmail.mock.calls[0][0]).toMatchObject({
      to: 'guest@resend.dev',
      idempotencyKey: 'remaining_balance_failed:pi_2',
      subject: "Maria, we couldn't charge your remaining balance",
    });
    // The card error stays with the operator: it never reaches the guest's email.
    expect(m.queueEmail.mock.calls[0][0].html).not.toContain('card_declined');
  });
});

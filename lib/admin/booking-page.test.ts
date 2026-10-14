import { describe, expect, it, vi } from 'vitest';

// No '@/' alias in vitest — point the imports at the real modules.
vi.mock('@/lib/pricing', () => import('../pricing'));
vi.mock('@/lib/discounts', () => import('../discounts'));
vi.mock('@/lib/display-time', () => import('../display-time'));
vi.mock('@/lib/booking-money', () => import('../booking-money'));
// The kit's barrel pulls in React components; its pure modules are all this needs.
vi.mock('@/components/kit', async () => ({
  ...(await import('../../components/kit/url')),
  ...(await import('../../components/kit/status')),
}));

const { historyRows, moneyActions, toBookingPage } = await import('./booking-page');
const { WAIVER_COVERAGE } = await import('./status-meta');

type Record = Parameters<typeof moneyActions>[0];

const ID = '0f8b7c1e-3a2d-4e5f-9a8b-7c6d5e4f3a2b';

// An online booking: $200, $100 deposit paid, $100 on the saved card the day before.
const record = (over: Partial<Record> = {}): Record => ({
  id: ID,
  lead_id: null,
  booking_source: 'online',
  trail_type: 'mtb',
  date: '2026-10-14',
  time_slot: '08:00',
  duration_hours: 2,
  bike_rental: 'standard',
  rider_height_inches: 70,
  participant_count: 1,
  participant_info: null,
  total_price: 20000,
  status: 'confirmed',
  created_at: '2026-10-01T16:00:00Z',
  location_id: 'loc-1',
  customer_id: 'cus-1',
  waiver_session_id: null,
  zip_code: null,
  marketing_source: null,
  attribution_snapshot: null,
  deposit_amount: 10000,
  deposit_paid_cents: 10000,
  deposit_payment_status: 'paid',
  remaining_balance_amount: 10000,
  remaining_balance_due_at: '2026-10-13T00:00:00.000Z',
  remaining_balance_status: 'pending',
  stripe_payment_method_id: 'pm_1',
  extra_paid_cents: 0,
  refunded_cents: 0,
  cal_booking_status: 'created',
  webhook_sent: true,
  webhook_last_attempt_at: null,
  webhook_last_status_code: null,
  webhook_last_error: null,
  discount_code: null,
  discount_label: null,
  discount_percentage: null,
  discount_amount_cents: null,
  subtotal_before_discount_cents: null,
  total_after_discount_cents: null,
  customer_name: 'Jane Rider',
  customer_email: 'jane@example.com',
  customer_phone: '407-555-0100',
  location_name: 'Santos',
  skill_level: 'beginner',
  addons: null,
  payment_method: null,
  admin_notes: null,
  waiver_accepted: false,
  waiver_link_token: 'tok123',
  ...over,
});

const kinds = (r: Record) => moneyActions(r).map((a) => a.kind);

describe('money actions', () => {
  it('only on a booking that is on or done', () => {
    expect(kinds(record({ status: 'cancelled' }))).toEqual([]);
    expect(kinds(record({ status: 'refunded' }))).toEqual([]);
    expect(kinds(record({ status: 'completed' }))).toContain('record_payment');
  });

  it('online, balance scheduled on the card: record a payment lowers it; refunds once money came in', () => {
    const actions = moneyActions(record());
    expect(actions.map((a) => a.kind)).toEqual(['record_payment', 'refund_card', 'record_refund']);
    expect(actions[0]).toMatchObject({ amount: '100.00', method: true, danger: false });
    expect(actions[0].description).toContain('it lowers the balance the card will be charged');
    expect(actions[1]).toMatchObject({ label: 'Refund to card', amount: '', reason: true, danger: true });
    expect(actions[2]).toMatchObject({ label: 'Record cash refund', method: true, reason: true, danger: false });
  });

  it('online, more owed than scheduled (an edit raised the price): charge the saved card', () => {
    const actions = moneyActions(record({ total_price: 25000 }));
    expect(actions[0]).toMatchObject({ kind: 'charge_card', label: 'Charge card $50.00', amount: '50.00', danger: true });
    expect(actions[1]).toMatchObject({ kind: 'record_payment', amount: '50.00' });
    // No saved card: nothing to charge, it can only be recorded.
    expect(kinds(record({ total_price: 25000, stripe_payment_method_id: null }))[0]).toBe('record_payment');
  });

  it('online, refund owed (an edit lowered the price): the refund opens with it', () => {
    const actions = moneyActions(record({ total_price: 5000, remaining_balance_status: 'waived' }));
    expect(actions.map((a) => a.kind)).toEqual(['refund_card', 'record_refund']);
    expect(actions[0]).toMatchObject({ label: 'Refund $50.00 to card', amount: '50.00' });
  });

  it('manual: record a payment toward what is still due, nothing once paid', () => {
    const manual = { booking_source: 'manual', deposit_payment_status: null, remaining_balance_status: 'pending', stripe_payment_method_id: null };
    const actions = moneyActions(record({ ...manual, deposit_paid_cents: 5000 }));
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ kind: 'manual_payment', amount: '150.00', method: true });
    expect(actions[0].description).toContain('$150.00 is still due');
    expect(moneyActions(record({ ...manual, deposit_paid_cents: 20000 }))).toEqual([]);
  });
});

describe('the page', () => {
  it('history: what happened, how much and when (Eastern)', () => {
    expect(
      historyRows([
        { id: 'e1', event_name: 'admin.payment_recorded', message: 'Payment of $50.00 recorded via cash', amount: 5000, occurred_at: '2026-10-13T02:30:00Z' },
        { id: 'e2', event_name: 'booking.edited', message: null, amount: null, occurred_at: '2026-10-12T16:00:00Z' },
      ]),
    ).toEqual([
      { id: 'e1', text: 'Payment of $50.00 recorded via cash', detail: '$50.00 · Oct 12, 2026, 10:30 PM' },
      { id: 'e2', text: 'booking.edited', detail: 'Oct 12, 2026, 12:00 PM' },
    ]);
  });

  it('title, subtitle, edit only while confirmed, the waiver link while someone has to sign', () => {
    const page = toBookingPage(record({ admin_notes: '  VIP  ' }), [], null, [], 'https://fmbg.example/');
    expect(page).toMatchObject({
      title: 'Jane Rider',
      subtitle: 'Santos · Wed, Oct 14, 2026 · 8:00 AM ET',
      editHref: `/admin/bookings/${ID}/edit`,
      notes: 'VIP',
      // Nobody signed yet: "No waivers" says it, no coverage badge on top.
      waiver: { coverage: null, url: 'https://fmbg.example/waiver/tok123' },
    });
    expect(page.detail.customer).toBe('Jane Rider');
    const signed = {
      id: 'w1',
      booking_id: ID,
      session_id: null,
      signer_name: 'Jane Rider',
      signer_role: 'participant',
      participants_covered: ['Jane Rider'],
      agreed_at: '2026-10-02T14:00:00Z',
      pdf_url: null,
      signature_url: null,
      guardian_relationship: null,
    };
    // One signed, a rider still missing: the badge says so, and the link stays.
    expect(toBookingPage(record(), [signed], null, [], 'https://x').waiver).toEqual({ coverage: WAIVER_COVERAGE.needed, url: 'https://x/waiver/tok123' });
    const done = toBookingPage(record({ status: 'completed', waiver_accepted: true, customer_name: null }), [signed], null, [], 'https://fmbg.example');
    expect(done).toMatchObject({ title: 'Customer', editHref: null, notes: null, waiver: { coverage: WAIVER_COVERAGE.covered, url: null } });
    expect(toBookingPage(record({ waiver_link_token: null }), [], null, [], 'https://x').waiver.url).toBeNull();
  });
});

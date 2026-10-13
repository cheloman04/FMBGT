import { describe, expect, it, vi } from 'vitest';

// No '@/' alias in vitest — point the imports at the real modules.
vi.mock('@/lib/pricing', () => import('../pricing'));
vi.mock('@/lib/discounts', () => import('../discounts'));
vi.mock('@/lib/display-time', () => import('../display-time'));
vi.mock('@/lib/booking-datetime', () => import('../booking-datetime'));
vi.mock('@/lib/booking-money', () => import('../booking-money'));
// The kit's barrel pulls in React components; its pure modules are all ./bookings needs.
vi.mock('@/components/kit', async () => ({
  ...(await import('../../components/kit/url')),
  ...(await import('../../components/kit/status')),
}));

const { computeOverview, daysUntil, overviewMetrics, pickNextBooking, toNextBooking } = await import('./overview');

type Booking = Parameters<typeof computeOverview>[0][number];

const booking = (over: Partial<Booking>): Booking => ({
  status: 'confirmed',
  booking_source: 'online',
  total_price: 20000,
  total_after_discount_cents: null,
  deposit_paid_cents: 10000,
  deposit_payment_status: 'paid',
  remaining_balance_amount: 10000,
  remaining_balance_status: 'pending',
  extra_paid_cents: 0,
  refunded_cents: 0,
  stripe_payment_method_id: 'pm_1',
  ...over,
});

describe('computeOverview', () => {
  it('collected is net of refunds, from the same money module as the booking detail', () => {
    const stats = computeOverview(
      [
        booking({}), // deposit paid: 100
        booking({ status: 'completed', remaining_balance_status: 'paid' }), // all paid: 200
        booking({ booking_source: 'manual', deposit_payment_status: null, deposit_paid_cents: 5000, remaining_balance_amount: 0 }), // cash: 50
        booking({ status: 'completed', remaining_balance_status: 'paid', refunded_cents: 2500 }), // 200 - 25
      ],
      [],
      new Set(),
    );
    expect(stats.collectedCents).toBe(10000 + 20000 + 5000 + 17500);
  });

  it('pending checkouts and refunded bookings collect nothing', () => {
    const stats = computeOverview(
      [booking({ status: 'pending' }), booking({ status: 'refunded', remaining_balance_status: 'paid' })],
      [],
      new Set(),
    );
    expect(stats.collectedCents).toBe(0);
    expect(stats.confirmed).toBe(0);
  });

  it('to collect is what confirmed bookings still owe, failed charges included', () => {
    const stats = computeOverview(
      [
        booking({}), // owes 100
        booking({ remaining_balance_status: 'failed' }), // owes 100, charge failed
        booking({ remaining_balance_status: 'paid' }), // paid in full
        booking({ status: 'cancelled' }), // not owed
        booking({ status: 'cancelled', remaining_balance_status: 'failed' }), // failed, but there is no tour to charge for
      ],
      [],
      new Set(),
    );
    expect(stats.toCollectCents).toBe(20000);
    expect(stats.toCollectCount).toBe(2);
    expect(stats.failedCharges).toBe(1);
  });

  it('a lead converted by a payment signal is not open, and counts towards conversion', () => {
    const lead = (id: string, over = {}) => ({ id, status: 'lead', booking_id: null, converted_at: null, ...over });
    const stats = computeOverview(
      [],
      [lead('a'), lead('b'), lead('c', { status: 'converted' }), lead('d', { status: 'lost' })],
      new Set(['b']),
    );
    expect(stats.activeLeads).toBe(1);
    expect(stats.conversionRate).toBe(50);
    expect(computeOverview([], [], new Set()).conversionRate).toBeNull();
  });
});

describe('overviewMetrics', () => {
  const stats = computeOverview([booking({})], [], new Set());

  it('four figures; the bookings and leads ones filter the list below', () => {
    const metrics = overviewMetrics(stats, 'leads');
    expect(metrics.map((m) => m.key)).toEqual(['collected', 'to-collect', 'confirmed', 'leads']);
    expect(metrics.find((m) => m.key === 'leads')).toMatchObject({ href: '/admin?status=leads', active: true });
    expect(metrics.find((m) => m.key === 'confirmed')).toMatchObject({ href: '/admin?status=confirmed', active: false });
  });

  it('says so when nothing is owed', () => {
    const none = computeOverview([booking({ remaining_balance_status: 'paid' })], [], new Set());
    expect(overviewMetrics(none, 'all')[1]).toMatchObject({ value: '$0.00', sub: 'Nothing outstanding' });
    expect(overviewMetrics(stats, 'all')[1]).toMatchObject({ value: '$100.00', sub: 'On 1 confirmed booking' });
  });
});

describe('next booking', () => {
  // 2026-10-13 14:00 Eastern (EDT, UTC-4).
  const now = new Date('2026-10-13T18:00:00Z');

  it('skips a tour that already started today and picks the earliest one ahead', () => {
    const picked = pickNextBooking(
      [
        { id: 'later', date: '2026-10-20', time_slot: '09:00' },
        { id: 'started', date: '2026-10-13', time_slot: '10:00' },
        { id: 'tonight', date: '2026-10-13', time_slot: '17:00' },
        { id: 'broken', date: 'not-a-date', time_slot: '09:00' },
      ],
      now,
    );
    expect(picked?.id).toBe('tonight');
    expect(pickNextBooking([{ date: '2026-10-12', time_slot: '09:00' }], now)).toBeNull();
  });

  it('days are Florida calendar days', () => {
    expect(daysUntil('2026-10-13', '2026-10-13')).toBe('Today');
    expect(daysUntil('2026-10-14', '2026-10-13')).toBe('Tomorrow');
    expect(daysUntil('2026-10-24', '2026-10-13')).toBe('In 11 days');
  });

  it('the view carries the facts the operator needs, already formatted', () => {
    const view = toNextBooking(
      {
        ...booking({ remaining_balance_status: 'paid' }),
        id: 'b1',
        date: '2026-10-24',
        time_slot: '09:00',
        trail_type: 'mtb',
        duration_hours: 2,
        participant_count: 3,
        status: 'confirmed',
        customer_name: 'Laura Walton',
        location_name: 'Markham Woods Trail',
      },
      '2026-10-13',
    );
    expect(view.customer).toBe('Laura Walton');
    expect(view.status).toEqual({ label: 'Confirmed', tone: 'green' });
    expect(view.facts.map((f) => [f.label, f.value, f.sub])).toEqual([
      ['When', 'Sat, Oct 24 · 9:00 AM', 'In 11 days'],
      ['Where', 'Markham Woods Trail', undefined],
      ['Tour', 'Mountain bike · 2h', '3 riders'],
      ['Total', '$200.00', 'Paid in full'],
    ]);
  });

  it('a balance still due shows what is paid and what is left', () => {
    const view = toNextBooking(
      {
        ...booking({}),
        id: 'b2',
        date: '2026-10-14',
        time_slot: null,
        trail_type: 'paved',
        duration_hours: null,
        participant_count: 1,
        status: 'confirmed',
        customer_name: null,
        location_name: null,
      },
      '2026-10-13',
    );
    expect(view.customer).toBe('Customer');
    expect(view.facts.find((f) => f.key === 'payment')?.sub).toBe('$100.00 paid · $100.00 due');
    expect(view.facts.find((f) => f.key === 'tour')).toMatchObject({ value: 'Paved', sub: '1 rider' });
  });
});

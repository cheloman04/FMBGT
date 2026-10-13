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

const {
  bikeMix,
  bookingFilterMetrics,
  bookingFilterOptions,
  bookingRiders,
  bookingsEmpty,
  countByFilter,
  extractWaiverStoragePath,
  groupWaivers,
  latestReviewByBooking,
  parseBookingFilter,
  parseBookingId,
  parsePage,
  parseSearch,
  paymentLine,
  searchResults,
  toBookingDetail,
  toBookingRow,
} = await import('./bookings');

type Record = Parameters<typeof toBookingRow>[0];
type Waiver = Parameters<typeof toBookingDetail>[1][number];
type Review = NonNullable<Parameters<typeof toBookingDetail>[2]>;
type Counts = Parameters<typeof bookingFilterMetrics>[0];

const ID = '0f8b7c1e-3a2d-4e5f-9a8b-7c6d5e4f3a2b';

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
  ...over,
});

const waiver = (over: Partial<Waiver> = {}): Waiver => ({
  id: 'w1',
  booking_id: ID,
  session_id: null,
  signer_name: 'Jane Rider',
  signer_role: 'participant',
  participants_covered: ['Jane Rider'],
  agreed_at: '2026-10-02T14:00:00Z',
  pdf_url: 'https://signed/pdf',
  signature_url: null,
  guardian_relationship: null,
  ...over,
});

const review = (over: Partial<Review> = {}): Review => ({
  id: 'r1',
  booking_id: ID,
  status: 'active',
  enrolled_at: '2026-10-15T14:00:00Z',
  next_step_due_at: null,
  review_left_at: null,
  review_platform: null,
  completed_at: null,
  cancelled_at: null,
  stop_reason: null,
  created_at: '2026-10-15T14:00:00Z',
  updated_at: '2026-10-15T14:00:00Z',
  ...over,
});

/** Intl writes a narrow no-break space before AM/PM: compare with plain spaces. */
const plain = (s: string | null | undefined) => (s ?? '').replace(/\s/g, ' ');

describe('the view in the URL', () => {
  it('reads the status filter, falling back to all', () => {
    expect(parseBookingFilter('confirmed')).toBe('confirmed');
    expect(parseBookingFilter('failed')).toBe('failed');
    expect(parseBookingFilter(['refunded', 'x'])).toBe('refunded');
    expect(parseBookingFilter('pending')).toBe('all');
    expect(parseBookingFilter(undefined)).toBe('all');
  });

  it('cleans the search of what PostgREST or LIKE would read as syntax', () => {
    expect(parseSearch('  jane   rider ')).toBe('jane rider');
    expect(parseSearch('a,b(c)"d"\\e%f*g')).toBe('a b c d e f g');
    expect(parseSearch('jane.doe@example.com')).toBe('jane.doe@example.com');
    expect(parseSearch('x'.repeat(200))).toHaveLength(80);
    expect(parseSearch(undefined)).toBe('');
  });

  it('reads the page and the open booking defensively', () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage('3')).toBe(3);
    expect(parsePage('0')).toBe(1);
    expect(parsePage('abc')).toBe(1);
    expect(parsePage('999')).toBe(20);
    expect(parseBookingId(ID.toUpperCase())).toBe(ID);
    expect(parseBookingId('42')).toBeNull();
    expect(parseBookingId(undefined)).toBeNull();
  });

  it('the strip filters by status, keeps the search and drops the page and the drawer', () => {
    const counts: Counts = { all: 7, confirmed: 3, completed: 2, cancelled: 1, refunded: 1, failed: 0 };
    const metrics = bookingFilterMetrics(counts, 'confirmed', '/admin/bookings', { q: 'jane', page: '3', booking: ID, status: 'confirmed' });
    expect(metrics.map((m) => m.key)).toEqual(['all', 'confirmed', 'completed', 'cancelled', 'refunded']);
    expect(metrics.map((m) => m.href)).toEqual([
      '/admin/bookings?q=jane',
      '/admin/bookings?q=jane&status=confirmed',
      '/admin/bookings?q=jane&status=completed',
      '/admin/bookings?q=jane&status=cancelled',
      '/admin/bookings?q=jane&status=refunded',
    ]);
    expect(metrics.map((m) => m.label)).toEqual(['All', 'Confirmed', 'Completed', 'Cancelled', 'Refunded']);
    expect(metrics.find((m) => m.active)?.key).toBe('confirmed');
    expect(metrics[1]?.value).toBe('3');
  });

  it('the phone filter offers failed charges only when there are some, or it is the one applied', () => {
    const counts: Counts = { all: 2, confirmed: 2, completed: 0, cancelled: 0, refunded: 0, failed: 0 };
    expect(bookingFilterOptions(counts, 'all', '/admin/bookings', {}).map((o) => o.value)).toEqual([
      null,
      'confirmed',
      'completed',
      'cancelled',
      'refunded',
    ]);
    expect(bookingFilterOptions({ ...counts, failed: 1 }, 'all', '/admin/bookings', {}).at(-1)).toMatchObject({
      value: 'failed',
      label: 'Charge failed',
      count: 1,
      href: '/admin/bookings?status=failed',
    });
    expect(bookingFilterOptions(counts, 'failed', '/admin/bookings', {}).at(-1)?.value).toBe('failed');
  });

  it('an empty list says what is missing; a search says where it looked', () => {
    expect(bookingsEmpty('all', '')).toMatch(/^No bookings yet\./);
    expect(bookingsEmpty('confirmed', 'zed')).toMatch(/^No bookings match “zed”\. The search looks at/);
  });
});

describe('failed charges and counts', () => {
  it('a failed charge counts only on a tour that still happens or happened', () => {
    const counts = countByFilter([
      { status: 'confirmed', remaining_balance_status: 'failed' },
      { status: 'completed', remaining_balance_status: 'failed' },
      { status: 'cancelled', remaining_balance_status: 'failed' },
      { status: 'refunded', remaining_balance_status: 'paid' },
    ]);
    expect(counts).toEqual({ all: 4, confirmed: 1, completed: 1, cancelled: 1, refunded: 1, failed: 2 });
  });

  it('a search joins its three queries: one entry per booking, newest tour first, counts over every match', () => {
    const m = (id: string, date: string, time_slot: string | null, status = 'confirmed', balance: string | null = null) => ({
      id,
      date,
      time_slot,
      status,
      remaining_balance_status: balance,
    });
    const result = searchResults(
      [
        m('a', '2026-10-01', '08:00'),
        m('b', '2026-11-01', '08:00', 'completed'),
        m('a', '2026-10-01', '08:00'), // same booking, found by name and by location
        m('c', '2026-11-01', '15:00', 'confirmed', 'failed'),
        m('d', '2026-11-01', null, 'cancelled'),
      ],
      'all',
      3,
    );
    expect(result.ids).toEqual(['d', 'c', 'b']); // Postgres puts a null time first in desc
    expect(result.total).toBe(4);
    expect(result.counts).toMatchObject({ all: 4, confirmed: 2, completed: 1, cancelled: 1, failed: 1 });
    expect(searchResults([m('a', '2026-10-01', '08:00'), m('c', '2026-11-01', '15:00', 'confirmed', 'failed')], 'failed', 50).ids).toEqual(['c']);
  });
});

describe('waivers and reviews', () => {
  it('a booking takes the waivers filed under its id, else those of its checkout session', () => {
    const grouped = groupWaivers(
      [
        { id: 'b1', waiver_session_id: 's1' },
        { id: 'b2', waiver_session_id: 's2' },
        { id: 'b3', waiver_session_id: null },
      ],
      [
        waiver({ id: 'w1', booking_id: 'b1', session_id: 's1' }),
        waiver({ id: 'w2', booking_id: null, session_id: 's1' }),
        waiver({ id: 'w3', booking_id: null, session_id: 's2' }),
      ],
    );
    expect(grouped.get('b1')?.map((w) => w.id)).toEqual(['w1']);
    expect(grouped.get('b2')?.map((w) => w.id)).toEqual(['w3']);
    expect(grouped.get('b3')).toEqual([]);
  });

  it('keeps the newest review request of each booking', () => {
    const latest = latestReviewByBooking([review({ id: 'new' }), review({ id: 'old' }), review({ id: 'other', booking_id: 'b2' })]);
    expect(latest.get(ID)?.id).toBe('new');
    expect(latest.get('b2')?.id).toBe('other');
  });

  it('finds the storage path of a waiver file behind any of its URLs', () => {
    expect(extractWaiverStoragePath('abc/waiver.pdf')).toBe('abc/waiver.pdf');
    expect(extractWaiverStoragePath('https://x.supabase.co/storage/v1/object/public/waivers/abc/my%20file.pdf')).toBe('abc/my file.pdf');
    expect(extractWaiverStoragePath('https://x.supabase.co/storage/v1/object/sign/waivers/abc/sig.png?token=t')).toBe('abc/sig.png');
    expect(extractWaiverStoragePath('https://elsewhere.com/file.pdf')).toBeNull();
    expect(extractWaiverStoragePath(null)).toBeNull();
  });
});

describe('the row of the list', () => {
  it('carries the formatted date, tour, money and the status from the one map', () => {
    const row = toBookingRow(record({ participant_count: 3 }), 1);
    expect(row.when).toBe('Oct 14, 2026 · 8:00 AM');
    expect(row.location).toBe('Santos');
    expect(row.tour).toBe('MTB · 2h · 3 riders');
    expect(row.total).toBe('$200.00');
    expect(row.payment).toBe('$100.00 paid · $100.00 due');
    expect(row.status).toEqual({ label: 'Confirmed', tone: 'green' });
    expect(row.flags).toEqual([]);
  });

  it('flags what needs the operator before a confirmed tour', () => {
    const row = toBookingRow(
      record({ cal_booking_status: 'failed', webhook_sent: false, rider_height_inches: null, remaining_balance_status: 'failed' }),
      0,
    );
    expect(row.flags.map((f) => f.label)).toEqual(['Charge failed', 'No Cal event', 'Email not sent', 'Size missing', 'No waivers']);
  });

  it('after the tour only a failed charge still matters', () => {
    const row = toBookingRow(
      record({ status: 'completed', cal_booking_status: 'failed', webhook_sent: false, remaining_balance_status: 'failed' }),
      0,
    );
    expect(row.flags.map((f) => f.label)).toEqual(['Charge failed']);
    expect(toBookingRow(record({ status: 'cancelled', remaining_balance_status: 'failed' }), 0).flags).toEqual([]);
  });

  it('says how the money stands, from the same module as the booking detail', () => {
    expect(paymentLine(record({ remaining_balance_status: 'paid' }))).toBe('Paid in full');
    expect(paymentLine(record({ status: 'refunded', refunded_cents: 20000 }))).toBe('$200.00 refunded');
    expect(paymentLine(record({ status: 'cancelled' }))).toBe('$100.00 collected');
    expect(paymentLine(record({ status: 'cancelled', deposit_payment_status: null }))).toBe('Nothing collected');
    // A manual booking: deposit_paid_cents is everything collected off-platform.
    expect(paymentLine(record({ booking_source: 'manual', deposit_payment_status: null, deposit_paid_cents: 5000, remaining_balance_amount: 15000 }))).toBe(
      '$50.00 paid · $150.00 due',
    );
    expect(paymentLine(record({ deposit_payment_status: null, deposit_paid_cents: 0 }))).toBe('$200.00 due');
  });
});

describe('riders', () => {
  it('lists the lead rider and the others; an own bike needs no size', () => {
    const riders = bookingRiders(
      record({
        rider_height_inches: null,
        participant_info: [
          { name: 'Sam', bike_rental: 'electric', height_inches: 66 },
          { name: '', bike_rental: 'none', height_inches: null },
        ],
      }),
    );
    expect(riders.map((r) => [r.label, r.name, r.bike, r.height, r.needsSize])).toEqual([
      ['Lead rider', 'Jane Rider', 'Regular bike', 'Size missing', true],
      ['Rider 2', 'Sam', 'E-bike', '66"', false],
      ['Rider 3', 'Name not given', 'Own bike', 'Size missing', false],
    ]);
    expect(bikeMix(riders)).toBe('1 Regular bike · 1 E-bike · 1 Own bike');
  });

  it('a rider with no bike of their own (a manual booking stores names only) rides what the lead rides', () => {
    const rented = bookingRiders(record({ bike_rental: 'standard', participant_info: [{ name: 'Ana' }] }));
    expect(rented[1]).toMatchObject({ bike: 'Regular bike', needsSize: true });
    const own = bookingRiders(record({ bike_rental: 'none', rider_height_inches: null, participant_info: [{ name: 'Ana' }] }));
    expect(own.map((r) => [r.bike, r.needsSize])).toEqual([
      ['Own bike', false],
      ['Own bike', false],
    ]);
    expect(bookingRiders(record({ bike_rental: null, rider_height_inches: null }))[0]?.needsSize).toBe(false);
  });
});

describe('the quick view of the drawer', () => {
  it('puts the tour, the contact and the money in facts', () => {
    const view = toBookingDetail(
      record({
        zip_code: '32801',
        marketing_source: 'instagram',
        lead_id: 'lead-1',
        attribution_snapshot: { utm_source: 'email', template_key: 'mtb_1_day' },
        discount_code: 'FRIENDS20',
        discount_label: 'Friends & family',
        discount_percentage: 20,
        discount_amount_cents: 5000,
        total_after_discount_cents: 20000,
      }),
      [waiver()],
      null,
    );
    expect(view.customer).toBe('Jane Rider');
    expect(view.tour.map((f) => f.label)).toEqual(['When', 'Where', 'Tour', 'Booked']);
    expect(view.tour[2]?.value).toBe('Mountain bike · 2h · 1 rider');
    expect(plain(view.tour[3]?.value)).toBe('Oct 1, 2026, 12:00 PM · online');
    expect(view.contact.facts).toEqual([
      { label: 'ZIP', value: '32801' },
      { label: 'Heard about us', value: 'instagram' },
      { label: 'Attribution', value: 'Converted lead · Email conversion · Template mtb_1_day' },
    ]);
    expect(view.payment).toEqual([
      { label: 'Total', value: '$200.00' },
      { label: 'Discount', value: 'Friends & family (20%) · $50.00 off' },
      { label: 'Collected', value: '$100.00' },
      { label: 'Still due', value: '$100.00' },
      { label: 'Balance charge', value: '$100.00 on Oct 13, 2026' },
    ]);
    expect(view.balance).toEqual({ label: 'Balance scheduled', tone: 'gray' });
    expect(view.waiverStatus).toEqual({ label: '1 waiver', tone: 'green' });
    expect(view.waivers[0]).toMatchObject({ signer: 'Jane Rider', coverage: 'Signed for themselves', pdfUrl: 'https://signed/pdf' });
  });

  it('a manual booking has no card balance; what was collected is off-platform', () => {
    const view = toBookingDetail(
      record({ booking_source: 'manual', deposit_payment_status: null, deposit_paid_cents: 20000, remaining_balance_amount: 0 }),
      [],
      null,
    );
    expect(view.balance).toBeNull();
    expect(view.payment.find((f) => f.label === 'Collected')?.value).toBe('$200.00 · off-platform');
    expect(view.payment.find((f) => f.label === 'Still due')?.value).toBe('Nothing · paid in full');
    expect(view.waiverStatus.label).toBe('No waivers');
  });

  it('says why the confirmation email did not go out, and the review request once the tour is done', () => {
    const confirmed = toBookingDetail(
      record({ webhook_sent: false, webhook_last_attempt_at: '2026-10-02T14:00:00Z', webhook_last_status_code: 500, webhook_last_error: 'n8n down' }),
      [],
      null,
    );
    expect(confirmed.followThrough.map((f) => f.key)).toEqual(['calendar', 'email']);
    expect(plain(confirmed.followThrough[1]?.detail)).toBe('Last attempt Oct 2, 2026, 10:00 AM · HTTP 500 · n8n down');

    const completed = toBookingDetail(record({ status: 'completed' }), [], review({ status: 'reviewed', review_left_at: '2026-10-16T14:00:00Z', review_platform: 'google' }));
    const line = completed.followThrough.find((f) => f.key === 'review');
    expect(line?.meta).toEqual({ label: 'Review received', tone: 'green' });
    expect(plain(line?.detail)).toBe('Oct 16, 2026, 10:00 AM · google');
    expect(toBookingDetail(record({ status: 'completed' }), [], null).followThrough.at(-1)?.meta.label).toBe('Review not started');
  });

  it('names who a guardian signed for, and counts the sizes missing', () => {
    const view = toBookingDetail(
      record({ rider_height_inches: null, participant_info: [{ name: 'Kid', bike_rental: 'standard', height_inches: null }] }),
      [waiver({ signer_role: 'guardian', guardian_relationship: 'parent', participants_covered: ['Kid'] })],
      null,
    );
    expect(view.waivers[0]?.coverage).toBe('Guardian (parent) for Kid');
    expect(view.sizing).toEqual({ label: '2 sizes missing', tone: 'amber' });
  });
});

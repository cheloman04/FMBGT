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

const { toManualRow } = await import('./manual-bookings');

type Record = Parameters<typeof toManualRow>[0];

// Laura's booking: manual, $609.87 paid in cash, nobody has signed yet.
const record = (over: Partial<Record> = {}): Record => ({
  id: 'b1',
  lead_id: null,
  booking_source: 'manual',
  trail_type: 'mtb',
  date: '2026-10-24',
  time_slot: '09:00',
  duration_hours: 2,
  bike_rental: 'standard',
  rider_height_inches: null,
  participant_count: 3,
  participant_info: [{ name: 'Sam' }, { name: 'Ana' }],
  total_price: 60987,
  status: 'confirmed',
  created_at: '2026-10-09T14:24:00Z',
  location_id: 'loc-1',
  customer_id: 'cus-1',
  waiver_session_id: 'ws-1',
  zip_code: null,
  marketing_source: null,
  attribution_snapshot: null,
  deposit_amount: 60987,
  deposit_paid_cents: 60987,
  deposit_payment_status: 'paid',
  remaining_balance_amount: 0,
  remaining_balance_due_at: null,
  remaining_balance_status: 'paid',
  stripe_payment_method_id: null,
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
  customer_name: 'Laura Walton',
  customer_email: 'laura@example.com',
  customer_phone: null,
  location_name: 'Markham Woods Trail',
  waiver_accepted: false,
  waiver_link_token: 'tok123',
  ...over,
});

describe('the manual bookings list', () => {
  it('a row is the bookings list row plus the waiver link while someone has to sign', () => {
    const row = toManualRow(record(), 0, 'https://fmbgt.test/');
    expect(row).toMatchObject({
      id: 'b1',
      customer: 'Laura Walton',
      location: 'Markham Woods Trail',
      payment: 'Paid in full',
      waiverUrl: 'https://fmbgt.test/waiver/tok123',
    });
    expect(row.flags.map((f) => f.label)).toContain('No waivers');
  });

  it('no link once everyone signed, or on a tour that is no longer on', () => {
    expect(toManualRow(record({ waiver_accepted: true }), 1, 'https://fmbgt.test').waiverUrl).toBeNull();
    expect(toManualRow(record({ status: 'cancelled' }), 0, 'https://fmbgt.test').waiverUrl).toBeNull();
    expect(toManualRow(record({ waiver_link_token: null }), 0, 'https://fmbgt.test').waiverUrl).toBeNull();
  });
});

import { describe, expect, it, vi } from 'vitest';

// No '@/' alias in vitest — point the imports at the real modules.
vi.mock('@/lib/pricing', () => import('../pricing'));
vi.mock('@/lib/discounts', () => import('../discounts'));
vi.mock('@/lib/display-time', () => import('../display-time'));
vi.mock('@/lib/booking-money', () => import('../booking-money'));
vi.mock('@/lib/booking-flow-progress', () => import('../booking-flow-progress'));
// The kit's barrel pulls in React components; its pure modules are all this needs.
vi.mock('@/components/kit', async () => ({
  ...(await import('../../components/kit/url')),
  ...(await import('../../components/kit/status')),
  ...(await import('../../components/kit/time')),
}));

const { TRASH_EMPTY, TRASH_PAGE_PARAM, toTrashedBookingRow, toTrashedLeadRow, trashPageHref, trashedLeadStatus, trashedMoney } =
  await import('./trash');
const { LEAD_STATUS } = await import('./status-meta');

type Booking = Parameters<typeof toTrashedBookingRow>[0];
type Lead = Parameters<typeof toTrashedLeadRow>[0];

const booking = (over: Partial<Booking> = {}): Booking => ({
  id: 'b1',
  status: 'cancelled',
  date: '2026-10-20',
  time_slot: '08:00',
  booking_source: 'online',
  total_price: 60000,
  total_after_discount_cents: null,
  deposit_paid_cents: 30000,
  deposit_payment_status: 'paid',
  remaining_balance_amount: 30000,
  remaining_balance_status: 'pending',
  extra_paid_cents: 0,
  refunded_cents: 0,
  stripe_payment_method_id: 'pm_1',
  // 10:30 PM on the 12th in Florida: the day is Eastern, not UTC.
  deleted_at: '2026-10-13T02:30:00Z',
  deleted_by: 'dustin@example.com',
  customer_name: 'Laura Walton',
  location_name: 'Santos',
  ...over,
});

const lead = (over: Partial<Lead> = {}): Lead => ({
  id: 'l1',
  full_name: 'Sam Rivera',
  email: 'sam@example.com',
  selected_trail_type: 'mtb',
  selected_location_name: 'Santos',
  status: 'lead',
  booking_id: null,
  converted_at: null,
  lost_at: null,
  deleted_at: '2026-10-13T02:30:00Z',
  deleted_by: null,
  ...over,
});

describe('the page of each list in the URL', () => {
  it('one list loads more and keeps the other one where it was', () => {
    expect(trashPageHref('/admin/trash', { leadsPage: '2' }, 'bookings', 2)).toBe('/admin/trash?leadsPage=2&bookingsPage=2');
    expect(trashPageHref('/admin/trash', { bookingsPage: '3' }, 'leads', 2)).toBe('/admin/trash?bookingsPage=3&leadsPage=2');
    // Page 1 is the default: no param.
    expect(trashPageHref('/admin/trash', { bookingsPage: '2' }, 'bookings', 1)).toBe('/admin/trash');
    expect(TRASH_PAGE_PARAM).toEqual({ bookings: 'bookingsPage', leads: 'leadsPage' });
  });

  it('an empty list says what fills it', () => {
    expect(TRASH_EMPTY.bookings).toMatch(/^No archived bookings\. A booking lands here when/);
    expect(TRASH_EMPTY.leads).toMatch(/^No archived leads\. A lead lands here when/);
  });
});

describe('archived bookings', () => {
  it('a row has the customer, the tour, the money and when it was archived (Eastern)', () => {
    expect(toTrashedBookingRow(booking())).toMatchObject({
      id: 'b1',
      customer: 'Laura Walton',
      location: 'Santos',
      when: 'Oct 20, 2026 · 8:00 AM',
      total: '$600.00',
      money: '$300.00 collected',
      archived: 'Oct 12, 2026',
      archivedBy: 'dustin@example.com',
    });
  });

  it('the money is what was kept, net of refunds, from the one money module', () => {
    expect(trashedMoney(booking({ deposit_payment_status: 'unpaid' }))).toBe('Nothing collected');
    expect(trashedMoney(booking({ refunded_cents: 30000 }))).toBe('$300.00 refunded');
    expect(trashedMoney(booking({ refunded_cents: 5000 }))).toBe('$250.00 collected · $50.00 refunded');
    expect(trashedMoney(booking({ remaining_balance_status: 'paid' }))).toBe('$600.00 collected');
    // A manual booking: deposit_paid_cents is everything collected off-platform.
    expect(trashedMoney(booking({ booking_source: 'manual', deposit_payment_status: null, deposit_paid_cents: 60987 }))).toBe(
      '$609.87 collected',
    );
    // The total is after any discount.
    expect(toTrashedBookingRow(booking({ total_after_discount_cents: 54000 })).total).toBe('$540.00');
  });

  it('restore says where it lands and what it does not do; delete forever is danger and final', () => {
    const row = toTrashedBookingRow(booking());
    expect(row.restore.title).toBe('Restore Laura Walton’s booking?');
    expect(row.restore.description).toContain('as Cancelled');
    expect(row.restore.description).toContain('No calendar event is created, no money moves');
    expect(row.restore.danger).toBeFalsy();
    expect(row.purge).toMatchObject({ title: 'Delete Laura Walton’s booking forever?', confirmLabel: 'Delete forever', danger: true });
    expect(row.purge.description).toContain('its waiver records and its review request are deleted');
    expect(row.purge.description).toContain('can’t be undone');
  });

  it('without a customer or a time it still reads', () => {
    const row = toTrashedBookingRow(booking({ customer_name: null, time_slot: null, location_name: null }));
    expect(row).toMatchObject({ customer: 'Customer', when: 'Oct 20, 2026', location: null });
    expect(row.restore.title).toBe('Restore this booking?');
  });
});

describe('archived leads', () => {
  it('booked by a payment on a booking or by its own columns, lost, or open', () => {
    expect(trashedLeadStatus(lead(), true)).toBe(LEAD_STATUS.converted);
    expect(trashedLeadStatus(lead({ booking_id: 'b1' }), false)).toBe(LEAD_STATUS.converted);
    expect(trashedLeadStatus(lead({ status: 'converted' }), false)).toBe(LEAD_STATUS.converted);
    expect(trashedLeadStatus(lead({ status: 'lost' }), false)).toBe(LEAD_STATUS.lost);
    expect(trashedLeadStatus(lead({ lost_at: '2026-10-01T12:00:00Z' }), false)).toBe(LEAD_STATUS.lost);
    expect(trashedLeadStatus(lead(), false)).toBe(LEAD_STATUS.open);
  });

  it('a row has the lead, the interest and when it was archived', () => {
    expect(toTrashedLeadRow(lead(), false)).toMatchObject({
      id: 'l1',
      name: 'Sam Rivera',
      email: 'sam@example.com',
      interest: 'MTB · Santos',
      archived: 'Oct 12, 2026',
      archivedBy: null,
    });
    const bare = toTrashedLeadRow(lead({ full_name: '', selected_trail_type: null, selected_location_name: null }), false);
    expect(bare).toMatchObject({ name: 'sam@example.com', interest: null });
  });

  it('restore tells where the lead lands: a booked one stays off the open leads', () => {
    expect(toTrashedLeadRow(lead(), true).restore.description).toContain('counts as converted and won’t show among the open leads');
    expect(toTrashedLeadRow(lead({ status: 'lost' }), false).restore.description).toBe('The lead goes back to Leads, under Lost. Nothing is sent.');
    expect(toTrashedLeadRow(lead(), false).restore.description).toBe('The lead goes back to Leads. Nothing is sent.');
  });

  it('delete forever is danger and says what goes and what stays', () => {
    const { purge } = toTrashedLeadRow(lead(), true);
    expect(purge).toMatchObject({ title: 'Delete Sam Rivera forever?', confirmLabel: 'Delete forever', danger: true });
    expect(purge.description).toContain('its follow-up and its booking-flow history are deleted');
    expect(purge.description).toContain('Its bookings stay');
    expect(purge.description).toContain('can’t be undone');
  });
});

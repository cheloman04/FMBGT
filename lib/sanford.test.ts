import { describe, expect, it, vi } from 'vitest';

// No '@/' alias in vitest — point the imports at the real modules.
vi.mock('@/lib/location-status', () => import('./location-status'));
vi.mock('@/lib/booking-datetime', () => import('./booking-datetime'));
vi.mock('@/lib/discounts', () => import('./discounts'));
vi.mock('@/lib/sanford', () => import('./sanford'));

import { calculatePriceBreakdown, calculateSanfordGroupPrice, getPriceLineItems } from './pricing';
import { buildSanfordSlots, isSanfordLocation } from './sanford';

const NO_ADDONS = { gopro: false, pickup_dropoff: false, electric_upgrade: false };
const SANFORD = 'Sanford Historic Riverfront Tour';

describe('Sanford group pricing', () => {
  it('charges per group, with $59.99 for each rider after the 4th', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(calculateSanfordGroupPrice)).toEqual([
      9900, 16000, 23000, 30000, 35999, 41998, 47997,
    ]);
  });

  it('adds e-bike upgrades and 7% tax on top of the group price', () => {
    const breakdown = calculatePriceBreakdown(
      'standard',
      2,
      NO_ADDONS,
      'paved',
      [{ name: 'B', bike_rental: 'electric' }, { name: 'C', bike_rental: 'standard' }],
      { locationName: SANFORD }
    );
    expect(breakdown.base_price).toBe(23000);
    expect(breakdown.addons_price).toBe(2500);
    expect(breakdown.subtotal).toBe(25500);
    expect(breakdown.tax_amount).toBe(1785);
    expect(breakdown.total).toBe(27285);
  });

  it('keeps the per-rider price for other paved routes', () => {
    const breakdown = calculatePriceBreakdown('standard', 2, NO_ADDONS, 'paved', [{ name: 'B' }], {
      locationName: 'Spring to Spring Trail Tour – Blue Spring State Park',
    });
    expect(breakdown.base_price).toBe(23000);
  });

  it('shows the group as one line item', () => {
    const items = getPriceLineItems('standard', 2, NO_ADDONS, 'paved', [{ name: 'B' }], {
      locationName: SANFORD,
    });
    expect(items[0]).toEqual({ label: 'Sanford group tour - 2 hours, bikes included (2 riders)', amount: 16000 });
  });

  it('recognises the location whatever the spacing or case', () => {
    expect(isSanfordLocation(' sanford historic  riverfront tour ')).toBe(true);
    expect(isSanfordLocation('Markham Woods Trail, Lake Mary')).toBe(false);
  });
});

describe('buildSanfordSlots', () => {
  const now = new Date('2026-11-01T12:00:00Z');
  const range = { dateFrom: '2026-11-01', dateTo: '2026-11-30', now };

  it('only offers the 10:00 departure from Cal.com, with all seats free', () => {
    const slots = buildSanfordSlots({
      ...range,
      calSlots: [
        { date: '2026-11-10', time: '09:00', available: true },
        { date: '2026-11-10', time: '10:00', available: true },
      ],
      ridersBooked: new Map(),
      riders: 2,
    });
    expect(slots).toEqual([{ date: '2026-11-10', time: '10:00', available: true, seats_left: 7 }]);
  });

  it('adds back a day that already has groups while seats remain', () => {
    const slots = buildSanfordSlots({
      ...range,
      calSlots: [],
      ridersBooked: new Map([
        ['2026-11-12', 4],
        ['2026-11-13', 6],
      ]),
      riders: 2,
    });
    expect(slots).toEqual([
      { date: '2026-11-12', time: '10:00', available: true, seats_left: 3 },
      { date: '2026-11-13', time: '10:00', available: false, seats_left: 1 },
    ]);
  });

  it('counts groups still checking out on a departure Cal.com shows as open', () => {
    const slots = buildSanfordSlots({
      ...range,
      calSlots: [{ date: '2026-11-15', time: '10:00', available: true }],
      ridersBooked: new Map([['2026-11-15', 7]]),
      riders: 1,
    });
    expect(slots).toEqual([{ date: '2026-11-15', time: '10:00', available: false, seats_left: 0 }]);
  });

  it('respects the minimum notice and the requested range for joining groups', () => {
    const slots = buildSanfordSlots({
      ...range,
      now: new Date('2026-11-01T20:00:00Z'), // 3 PM Eastern
      calSlots: [],
      ridersBooked: new Map([
        ['2026-11-02', 2], // 10:00 tomorrow is under 20 hours away
        ['2026-12-05', 2], // outside the range
      ]),
      riders: 1,
    });
    expect(slots).toEqual([]);
  });
});

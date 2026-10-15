import { describe, expect, it, vi } from 'vitest';

// No '@/' alias in vitest — point the imports at the real modules.
vi.mock('@/lib/discounts', () => import('./discounts'));

import {
  PRICING,
  addonsNotOfferedOn,
  calculatePavedGroupPrice,
  calculatePriceBreakdown,
  getPriceLineItems,
} from './pricing';
import type { AdditionalParticipant, Addons, BikeRental, DurationHours } from '@/types/booking';

const NO_ADDONS: Addons = { gopro: false, pickup_dropoff: false, electric_upgrade: false };
const rider = (bike_rental: BikeRental): AdditionalParticipant => ({ name: 'B', bike_rental, height_inches: 66 });

/** Pre-tax subtotal and total, the way checkout charges them. */
function price(
  bike: BikeRental,
  hours: DurationHours,
  addons: Addons = NO_ADDONS,
  trail: 'mtb' | 'paved' = 'mtb',
  others: AdditionalParticipant[] = []
) {
  const b = calculatePriceBreakdown(bike, hours, addons, trail, others);
  return { subtotal: b.subtotal, total: b.total, breakdown: b };
}

describe('mountain bike prices (per rider, before tax)', () => {
  it('2 hours: $89.99 riding your own bike, $189.99 with ours', () => {
    expect(price('none', 2).subtotal).toBe(8999);
    expect(price('standard', 2).subtotal).toBe(18999);
  });

  it('each extra hour adds $50 per rider', () => {
    expect(price('none', 3).subtotal).toBe(13999);
    expect(price('standard', 3).subtotal).toBe(23999);
    expect(price('none', 4).subtotal).toBe(18999);
    expect(price('standard', 4).subtotal).toBe(28999);
    // two riders, 3 hours: the extra hour is charged to both
    expect(price('standard', 3, NO_ADDONS, 'mtb', [rider('none')]).subtotal).toBe(18999 + 8999 + 2 * 5000);
  });

  it('the e-bike is a $25 upgrade on the rental price', () => {
    expect(price('electric', 2).subtotal).toBe(21499);
    // chosen as an add-on on a standard rental: same price
    expect(price('standard', 2, { ...NO_ADDONS, electric_upgrade: true }).subtotal).toBe(21499);
  });

  it('pickup ($75) and GoPro ($49) are charged per rider', () => {
    const both = { ...NO_ADDONS, gopro: true, pickup_dropoff: true };
    expect(price('none', 2, both).subtotal).toBe(8999 + 4900 + 7500);
    expect(price('none', 2, both, 'mtb', [rider('standard')]).subtotal).toBe(8999 + 18999 + 2 * (4900 + 7500));
  });

  it('adds 7% Florida tax on top', () => {
    const { breakdown } = price('standard', 2);
    expect(breakdown.tax_amount).toBe(1330); // 7% of $189.99 = $13.2993
    expect(breakdown.total).toBe(20329);
  });
});

describe('paved tour (priced per group, bikes included)', () => {
  it('the price per rider drops as riders are added', () => {
    expect([1, 2, 3, 4, 5, 6].map(calculatePavedGroupPrice)).toEqual([9900, 16000, 23000, 30000, 35999, 41998]);
    const perRider = [1, 2, 3, 4, 5, 6].map((n) => calculatePavedGroupPrice(n) / n);
    for (let i = 1; i < perRider.length; i++) expect(perRider[i]).toBeLessThan(perRider[i - 1]);
  });

  it('charges the group price once, always 2 hours', () => {
    const group = [rider('standard'), rider('standard')];
    expect(price('standard', 2, NO_ADDONS, 'paved').subtotal).toBe(9900);
    expect(price('standard', 2, NO_ADDONS, 'paved', group).subtotal).toBe(23000);
    expect(price('standard', 4, NO_ADDONS, 'paved', group).subtotal).toBe(23000);
  });

  it('adds $25 for each rider on an e-bike', () => {
    expect(price('electric', 2, NO_ADDONS, 'paved', [rider('electric'), rider('standard')]).subtotal).toBe(23000 + 2 * 2500);
  });

  it('never charges GoPro or pickup (mountain bike extras)', () => {
    const extras = { ...NO_ADDONS, gopro: true, pickup_dropoff: true };
    expect(price('standard', 2, extras, 'paved', [rider('standard')]).subtotal).toBe(16000);
    const labels = getPriceLineItems('standard', 2, extras, 'paved', [rider('standard')]).map((i) => i.label);
    expect(labels.join(' | ')).not.toMatch(/GoPro|Pickup/);
  });
});

describe('addonsNotOfferedOn', () => {
  it('flags GoPro and pickup on a paved tour', () => {
    expect(addonsNotOfferedOn('paved', { gopro: true, pickup_dropoff: true })).toEqual(['gopro', 'pickup_dropoff']);
    expect(addonsNotOfferedOn('paved', { pickup_dropoff: true })).toEqual(['pickup_dropoff']);
  });

  it('allows them on mountain bike tours and lets paved riders pick an e-bike', () => {
    expect(addonsNotOfferedOn('mtb', { gopro: true, pickup_dropoff: true })).toEqual([]);
    expect(addonsNotOfferedOn('paved', NO_ADDONS)).toEqual([]);
    expect(addonsNotOfferedOn('paved', { electric_upgrade: true })).toEqual([]);
    expect(addonsNotOfferedOn('paved', undefined)).toEqual([]);
  });
});

describe('price summary lines', () => {
  const cases: Array<[string, Parameters<typeof getPriceLineItems>]> = [
    ['MTB 2 h with bike', ['standard', 2, NO_ADDONS, 'mtb', []]],
    ['MTB 3 h BYOB', ['none', 3, NO_ADDONS, 'mtb', []]],
    ['MTB e-bike + pickup, 2 riders', ['electric', 2, { ...NO_ADDONS, pickup_dropoff: true }, 'mtb', [rider('none')]]],
    ['MTB GoPro + add-on e-bike', ['standard', 4, { gopro: true, pickup_dropoff: false, electric_upgrade: true }, 'mtb', []]],
    ['paved, 1 rider', ['standard', 2, NO_ADDONS, 'paved', []]],
    ['paved, 4 riders with e-bikes', ['electric', 2, NO_ADDONS, 'paved', [rider('electric'), rider('standard'), rider('standard')]]],
  ];

  it.each(cases)('add up to what checkout charges: %s', (_name, args) => {
    const lines = getPriceLineItems(...args);
    const breakdown = calculatePriceBreakdown(...args);
    expect(lines.reduce((sum, line) => sum + line.amount, 0)).toBe(breakdown.total);
  });

  it('name the paved group size', () => {
    const lines = getPriceLineItems('standard', 2, NO_ADDONS, 'paved', [rider('standard'), rider('standard')]);
    expect(lines[0]).toEqual({ label: 'Guided Paved Tour - 2 hours, bikes included (3 riders)', amount: 23000 });
  });
});

describe('unchanged rules', () => {
  it('Friends & Family takes 20% off the total with tax', () => {
    const b = calculatePriceBreakdown('standard', 2, NO_ADDONS, 'mtb', [], { discountCode: 'fam-fmbgt' });
    expect(b.discount_amount).toBe(Math.floor(20329 * 0.2));
    expect(b.total_after_discount).toBe(20329 - Math.floor(20329 * 0.2));
  });

  it('the internal live test booking stays at $1.00', () => {
    expect(calculatePriceBreakdown('standard', 4, NO_ADDONS, 'mtb', [], { liveTestMode: true }).total).toBe(PRICING.LIVE_TEST_TOTAL);
  });
});

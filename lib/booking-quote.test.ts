import { describe, expect, it, vi } from 'vitest';

// No '@/' alias in vitest — point the imports at the real modules.
vi.mock('@/lib/pricing', () => import('./pricing'));
vi.mock('@/lib/discounts', () => import('./discounts'));

import { overrideQuote, quoteBooking, quoteToBookingPatch, type QuoteInput } from './booking-quote';

const NO_ADDONS = { gopro: false, pickup_dropoff: false, electric_upgrade: false };

// MTB, 2 riders with rental bikes, 2 hours: 2 × $189.99 = $379.98 + 7% tax = $406.58
const mtb = (overrides: Partial<QuoteInput> = {}): QuoteInput => ({
  trail_type: 'mtb',
  location_name: 'Markham Woods Trail, Lake Mary',
  bike_rental: 'standard',
  duration_hours: 2,
  addons: NO_ADDONS,
  participants: [{ name: 'B', bike_rental: 'standard', height_inches: 66 }],
  discount_percentage: null,
  gift_card_applied_cents: null,
  ...overrides,
});

describe('quoteBooking', () => {
  it('prices like checkout', () => {
    const quote = quoteBooking(mtb());
    expect(quote.total_price).toBe(40658);
    expect(quote.total_after_discount_cents).toBe(40658);
    expect(quote.discount_amount_cents).toBe(0);
  });

  it('adds the extra hours for every rider', () => {
    // 2 × ($189.99 + $50) = $479.98 + 7% = $513.58
    expect(quoteBooking(mtb({ duration_hours: 3 })).total_price).toBe(51358);
  });

  it('re-applies a percentage discount to the new total', () => {
    const quote = quoteBooking(mtb({ discount_percentage: 20 }));
    expect(quote.discount_amount_cents).toBe(8131);
    expect(quote.total_after_discount_cents).toBe(32527);
  });

  it('keeps the gift card amount, capped at the new total', () => {
    expect(quoteBooking(mtb({ gift_card_applied_cents: 10000 })).total_after_discount_cents).toBe(30658);
    const oneRider = quoteBooking(
      mtb({ bike_rental: 'none', participants: [], gift_card_applied_cents: 50000 })
    );
    expect(oneRider.discount_amount_cents).toBe(oneRider.total_price);
    expect(oneRider.total_after_discount_cents).toBe(0);
  });

  it('paved tours are always 2 hours', () => {
    const paved = mtb({ trail_type: 'paved', duration_hours: 4, participants: [] });
    expect(quoteBooking(paved).total_price).toBe(quoteBooking({ ...paved, duration_hours: 2 }).total_price);
  });

  it('prices a paved group once, without mountain bike extras', () => {
    // 2 riders: $160 for the group + 7% = $171.20; GoPro and pickup don't exist on paved
    const paved = mtb({ trail_type: 'paved', addons: { gopro: true, pickup_dropoff: true } });
    expect(quoteBooking(paved)).toMatchObject({ base_price: 16000, addons_price: 0, total_price: 17120 });
  });
});

describe('overrideQuote', () => {
  it('without a code, replaces the total', () => {
    const quote = overrideQuote(quoteBooking(mtb()), 35000, false);
    expect(quote).toMatchObject({ total_price: 35000, total_after_discount_cents: 35000, overridden: true });
    expect(quoteToBookingPatch(quote, false)).toEqual({ base_price: 37998, addons_price: 0, total_price: 35000 });
  });

  it('with a code, replaces what the customer pays and keeps the list price', () => {
    const quote = overrideQuote(quoteBooking(mtb({ discount_percentage: 20 })), 30000, true);
    expect(quoteToBookingPatch(quote, true)).toEqual({
      base_price: 37998,
      addons_price: 0,
      total_price: 40658,
      discount_amount_cents: 10658,
      subtotal_before_discount_cents: 40658,
      total_after_discount_cents: 30000,
    });
  });
});

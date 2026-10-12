// Re-pricing an online booking after an edit, with the same formula as checkout
// (calculatePriceBreakdown) and the code the customer used: a percentage
// discount is re-applied to the new total; a gift card keeps the amount it
// covered (single-use — capped at the new total). Pure.
//
// NOTE: calculatePriceBreakdown doesn't take the location yet. When Sanford's
// per-group price lands there, pass `location_name` through below.

import { calculatePriceBreakdown } from '@/lib/pricing';
import { calcDiscountAmount } from '@/lib/discounts';
import type { Addons, AdditionalParticipant, BikeRental, DurationHours, TrailType } from '@/types/booking';

export type QuoteInput = {
  trail_type: TrailType;
  location_name: string | null;
  bike_rental: BikeRental;
  duration_hours: number;
  addons: Addons;
  /** Riders 2..N. */
  participants: AdditionalParticipant[];
  /** The checkout code: a percentage discount… */
  discount_percentage: number | null;
  /** …or a gift card, with the amount it covered at checkout. */
  gift_card_applied_cents: number | null;
};

export type BookingQuote = {
  base_price: number;
  addons_price: number;
  /** Before the code, tax included. */
  total_price: number;
  discount_amount_cents: number;
  /** What the customer pays. */
  total_after_discount_cents: number;
  /** Set when the admin replaced the price. */
  overridden: boolean;
};

export function quoteBooking(input: QuoteInput): BookingQuote {
  // Paved tours always run 2 hours (checkout does the same).
  const duration = (input.trail_type === 'paved' ? 2 : input.duration_hours) as DurationHours;
  const breakdown = calculatePriceBreakdown(
    input.bike_rental,
    duration,
    input.addons,
    input.trail_type,
    input.participants
  );

  const discount =
    input.gift_card_applied_cents !== null
      ? Math.min(input.gift_card_applied_cents, breakdown.total)
      : input.discount_percentage
        ? calcDiscountAmount(breakdown.total, input.discount_percentage)
        : 0;

  return {
    base_price: breakdown.base_price, // as stored at checkout (without the extra-hours surcharge)
    addons_price: breakdown.addons_price,
    total_price: breakdown.total,
    discount_amount_cents: discount,
    total_after_discount_cents: breakdown.total - discount,
    overridden: false,
  };
}

/** The admin's own price: replaces what the customer pays. */
export function overrideQuote(quote: BookingQuote, totalCents: number, hasCode: boolean): BookingQuote {
  return hasCode
    ? {
        ...quote,
        discount_amount_cents: Math.max(0, quote.total_price - totalCents),
        total_after_discount_cents: totalCents,
        overridden: true,
      }
    : { ...quote, total_price: totalCents, discount_amount_cents: 0, total_after_discount_cents: totalCents, overridden: true };
}

/** Booking columns for a quote. Bookings without a code keep their total in total_price only. */
export function quoteToBookingPatch(quote: BookingQuote, hasCode: boolean): Record<string, number | null> {
  return {
    base_price: quote.base_price,
    addons_price: quote.addons_price,
    total_price: quote.total_price,
    ...(hasCode
      ? {
          discount_amount_cents: quote.discount_amount_cents,
          subtotal_before_discount_cents: quote.total_price,
          total_after_discount_cents: quote.total_after_discount_cents,
        }
      : {}),
  };
}

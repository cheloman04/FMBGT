import type { BikeRental, Addons, DurationHours, PriceBreakdown } from '@/types/booking';

// All prices in cents (USD)
export const PRICING = {
  BASE_NO_BIKE: 8900,        // $89.00 - 2hr tour, no bike
  BASE_WITH_BIKE: 18900,     // $189.00 - 2hr tour, standard bike included
  ADDITIONAL_HOUR: 5000,     // $50.00 per additional hour
  BASE_DURATION_HOURS: 2,

  ADDONS: {
    gopro: 4900,             // $49.00
    pickup_dropoff: 7500,    // $75.00
    electric_upgrade: 2500,  // $25.00
  } as const,

  BIKE_RENTAL: {
    none: 0,
    standard: 0,      // Included in base price (BASE_WITH_BIKE covers it)
    electric: 0,      // Electric upgrade is an addon on top of standard
  } as const,
} as const;

export function calculateBasePrice(bikeRental: BikeRental): number {
  if (bikeRental === 'none') {
    return PRICING.BASE_NO_BIKE;
  }
  // Both standard and electric start from the "with bike" base price
  return PRICING.BASE_WITH_BIKE;
}

export function calculateDurationSurcharge(durationHours: DurationHours): number {
  const additionalHours = durationHours - PRICING.BASE_DURATION_HOURS;
  return Math.max(0, additionalHours) * PRICING.ADDITIONAL_HOUR;
}

export function calculateAddonsPrice(addons: Addons): number {
  let total = 0;
  if (addons.gopro) total += PRICING.ADDONS.gopro;
  if (addons.pickup_dropoff) total += PRICING.ADDONS.pickup_dropoff;
  if (addons.electric_upgrade) total += PRICING.ADDONS.electric_upgrade;
  return total;
}

export function calculatePriceBreakdown(
  bikeRental: BikeRental,
  durationHours: DurationHours,
  addons: Addons
): PriceBreakdown {
  const base_price = calculateBasePrice(bikeRental);
  const duration_surcharge = calculateDurationSurcharge(durationHours);
  const addons_price = calculateAddonsPrice(addons);
  const total = base_price + duration_surcharge + addons_price;

  return {
    base_price,
    duration_surcharge,
    addons_price,
    total,
    currency: 'usd',
  };
}

// Format cents to display string
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

// Get line items for display
export function getPriceLineItems(
  bikeRental: BikeRental,
  durationHours: DurationHours,
  addons: Addons
): Array<{ label: string; amount: number }> {
  const items: Array<{ label: string; amount: number }> = [];

  const base = calculateBasePrice(bikeRental);
  const bikeLabel = bikeRental === 'none' ? 'Base tour (2 hours)' : 'Base tour with bike rental (2 hours)';
  items.push({ label: bikeLabel, amount: base });

  const additionalHours = durationHours - PRICING.BASE_DURATION_HOURS;
  if (additionalHours > 0) {
    items.push({
      label: `Additional ${additionalHours} hour${additionalHours > 1 ? 's' : ''}`,
      amount: calculateDurationSurcharge(durationHours),
    });
  }

  if (addons.gopro) {
    items.push({ label: 'GoPro Package', amount: PRICING.ADDONS.gopro });
  }
  if (addons.pickup_dropoff) {
    items.push({ label: 'Pickup + Dropoff', amount: PRICING.ADDONS.pickup_dropoff });
  }
  if (addons.electric_upgrade) {
    items.push({ label: 'Electric Bike Upgrade', amount: PRICING.ADDONS.electric_upgrade });
  }

  return items;
}

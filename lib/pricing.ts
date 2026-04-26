import type { BikeRental, Addons, DurationHours, PriceBreakdown, AdditionalParticipant } from '@/types/booking';

// All prices in cents (USD)
export const PRICING = {
  FLORIDA_STATE_TAX_RATE: 0.07,
  LIVE_TEST_TOTAL: 100,      // $1.00 total all-in for internal live payment verification
  PAVED_FLAT: 11500,         // $115.00 per rider - paved 2hr tour, bike always included
  BASE_NO_BIKE: 8900,        // $89.00 - MTB 2hr tour, BYOB (no bike)
  BASE_WITH_BIKE: 18900,     // $189.00 - MTB 2hr tour, standard bike included
  ADDITIONAL_HOUR: 5000,     // $50.00 per additional hour (MTB only)
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

interface PricingOptions {
  liveTestMode?: boolean;
}

function buildLiveTestBreakdown(participantCount: number): PriceBreakdown {
  return {
    base_price: PRICING.LIVE_TEST_TOTAL,
    duration_surcharge: 0,
    addons_price: 0,
    subtotal: PRICING.LIVE_TEST_TOTAL,
    tax_amount: 0,
    total: PRICING.LIVE_TEST_TOTAL,
    currency: 'usd',
    participant_count: participantCount,
    is_live_test_mode: true,
  };
}

export function calculateFloridaStateTax(subtotal: number): number {
  return Math.round(subtotal * PRICING.FLORIDA_STATE_TAX_RATE);
}

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

/** Base price per participant for a single rider (MTB only). */
export function calculateParticipantBasePrice(bikeRental: BikeRental): number {
  return calculateBasePrice(bikeRental);
}

export function calculatePriceBreakdown(
  bikeRental: BikeRental,
  durationHours: DurationHours,
  addons: Addons,
  trailType?: string,
  additionalParticipants?: AdditionalParticipant[],
  options: PricingOptions = {}
): PriceBreakdown {
  const participantCount = 1 + (additionalParticipants?.length ?? 0);

  if (options.liveTestMode) {
    return buildLiveTestBreakdown(participantCount);
  }

  // Paved tours: $115 per rider, bike always included, no duration surcharge
  if (trailType === 'paved') {
    const base_price = PRICING.PAVED_FLAT * participantCount;
    const gopro_price = addons.gopro ? PRICING.ADDONS.gopro * participantCount : 0;
    const pickup_price = addons.pickup_dropoff ? PRICING.ADDONS.pickup_dropoff * participantCount : 0;
    // Electric upgrades: count per-rider selections from bike_rental fields
    const rider1Electric = bikeRental === 'electric' ? 1 : 0;
    const addlElectric = additionalParticipants?.filter((p) => p.bike_rental === 'electric').length ?? 0;
    const totalElectric = rider1Electric + addlElectric;
    const electric_price = totalElectric * PRICING.ADDONS.electric_upgrade;
    const addons_price = gopro_price + pickup_price + electric_price;
    const subtotal = base_price + addons_price;
    const tax_amount = calculateFloridaStateTax(subtotal);

    return {
      base_price,
      duration_surcharge: 0,
      addons_price,
      subtotal,
      tax_amount,
      total: subtotal + tax_amount,
      currency: 'usd',
      participant_count: participantCount,
    };
  }

  // MTB: sum base price per participant
  let base_price = calculateBasePrice(bikeRental); // rider 1
  let electricCount = bikeRental === 'electric' ? 1 : 0;
  for (const p of additionalParticipants ?? []) {
    base_price += calculateBasePrice(p.bike_rental ?? 'none');
    if (p.bike_rental === 'electric') electricCount++;
  }

  const duration_surcharge = calculateDurationSurcharge(durationHours) * participantCount;

  // Addons: gopro and pickup multiply by participant count; electric is charged for
  // riders already assigned an e-bike plus a single rider-level upgrade chosen here.
  const gopro_price = addons.gopro ? PRICING.ADDONS.gopro * participantCount : 0;
  const pickup_price = addons.pickup_dropoff ? PRICING.ADDONS.pickup_dropoff * participantCount : 0;
  const addonElectricUpgradeCount = addons.electric_upgrade && bikeRental !== 'none' && bikeRental !== 'electric' ? 1 : 0;
  const electric_price = (electricCount + addonElectricUpgradeCount) * PRICING.ADDONS.electric_upgrade;
  const addons_price = gopro_price + pickup_price + electric_price;
  const subtotal = base_price + duration_surcharge + addons_price;
  const tax_amount = calculateFloridaStateTax(subtotal);

  return {
    base_price,
    duration_surcharge,
    addons_price,
    subtotal,
    tax_amount,
    total: subtotal + tax_amount,
    currency: 'usd',
    participant_count: participantCount,
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
  addons: Addons,
  trailType?: string,
  additionalParticipants?: AdditionalParticipant[],
  options: PricingOptions = {}
): Array<{ label: string; amount: number }> {
  const items: Array<{ label: string; amount: number }> = [];
  const participantCount = 1 + (additionalParticipants?.length ?? 0);
  const countLabel = participantCount > 1 ? ` x${participantCount}` : '';

  if (options.liveTestMode) {
    return [
      {
        label: 'Internal live payment verification booking',
        amount: PRICING.LIVE_TEST_TOTAL,
      },
    ];
  }

  if (trailType === 'paved') {
    items.push({
      label: `Guided Paved Tour - 2 hours (bike included)${countLabel}`,
      amount: PRICING.PAVED_FLAT * participantCount,
    });
  } else {
    // Group riders by bike type for cleaner display
    const allBikes: BikeRental[] = [bikeRental, ...(additionalParticipants?.map((p) => p.bike_rental ?? 'none') ?? [])];
    const noBike = allBikes.filter((b) => b === 'none').length;
    const withBike = allBikes.filter((b) => b !== 'none').length;

    if (noBike > 0 && withBike > 0) {
      items.push({ label: `Base tour (2 hours) x${noBike}`, amount: PRICING.BASE_NO_BIKE * noBike });
      items.push({ label: `Base tour with bike rental (2 hours) x${withBike}`, amount: PRICING.BASE_WITH_BIKE * withBike });
    } else if (noBike > 0) {
      items.push({ label: `Base tour (2 hours)${countLabel}`, amount: PRICING.BASE_NO_BIKE * participantCount });
    } else {
      items.push({ label: `Base tour with bike rental (2 hours)${countLabel}`, amount: PRICING.BASE_WITH_BIKE * participantCount });
    }

    const additionalHours = durationHours - PRICING.BASE_DURATION_HOURS;
    if (additionalHours > 0) {
      const surchargePerRider = additionalHours * PRICING.ADDITIONAL_HOUR;
      items.push({
        label: `Additional ${additionalHours} hour${additionalHours > 1 ? 's' : ''}${countLabel}`,
        amount: surchargePerRider * participantCount,
      });
    }
  }

  if (addons.gopro) {
    items.push({ label: `GoPro Package${countLabel}`, amount: PRICING.ADDONS.gopro * participantCount });
  }
  if (addons.pickup_dropoff) {
    items.push({ label: `Pickup + Dropoff${countLabel}`, amount: PRICING.ADDONS.pickup_dropoff * participantCount });
  }

  // Electric upgrade: per rider who chose electric plus one optional upgrade selected here.
  const allBikesForElectric: BikeRental[] = [bikeRental, ...(additionalParticipants?.map((p) => p.bike_rental ?? 'none') ?? [])];
  const electricCount = allBikesForElectric.filter((b) => b === 'electric').length;
  const addonElectricUpgradeCount = addons.electric_upgrade && bikeRental !== 'none' && bikeRental !== 'electric' ? 1 : 0;
  const totalElectricUpgradeCount = electricCount + addonElectricUpgradeCount;
  if (totalElectricUpgradeCount > 0) {
    items.push({
      label: `E-Bike Upgrade${totalElectricUpgradeCount > 1 ? ` x${totalElectricUpgradeCount}` : ''}`,
      amount: PRICING.ADDONS.electric_upgrade * totalElectricUpgradeCount,
    });
  }

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  items.push({
    label: 'Florida state tax (7%)',
    amount: calculateFloridaStateTax(subtotal),
  });

  return items;
}

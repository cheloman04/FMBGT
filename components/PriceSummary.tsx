'use client';

import { useBooking } from '@/context/BookingContext';
import type { Addons, BikeRental, DurationHours, TrailType, AdditionalParticipant } from '@/types/booking';
import { getPriceLineItems, formatPrice, calculatePriceBreakdown } from '@/lib/pricing';
import { Separator } from '@/components/ui/separator';

interface PriceSummaryProps {
  bikeRental?: BikeRental;
  durationHours?: DurationHours;
  addons?: Addons;
  trailType?: TrailType;
  additionalParticipants?: AdditionalParticipant[];
}

export function PriceSummary({
  bikeRental,
  durationHours,
  addons,
  trailType,
  additionalParticipants,
}: PriceSummaryProps = {}) {
  const { state } = useBooking();
  const effectiveBikeRental = bikeRental ?? state.bike_rental;
  const effectiveDurationHours = durationHours ?? state.duration_hours;
  const effectiveAddons = addons ?? state.addons;
  const effectiveTrailType = trailType ?? state.trail_type;
  const effectiveAdditionalParticipants = additionalParticipants ?? state.additional_participants;

  if (!effectiveBikeRental || !effectiveDurationHours || !effectiveAddons) return null;

  const lineItems = getPriceLineItems(
    effectiveBikeRental,
    effectiveDurationHours,
    effectiveAddons,
    effectiveTrailType,
    effectiveAdditionalParticipants
  );
  const breakdown = calculatePriceBreakdown(
    effectiveBikeRental,
    effectiveDurationHours,
    effectiveAddons,
    effectiveTrailType,
    effectiveAdditionalParticipants
  );

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h3 className="font-semibold text-foreground mb-3">Price Summary</h3>
      <div className="space-y-2">
        {lineItems.map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="text-foreground font-medium">{formatPrice(item.amount)}</span>
          </div>
        ))}
      </div>
      <Separator className="my-3" />
      <div className="flex justify-between font-semibold">
        <span className="text-foreground">Total</span>
        <span className="text-green-600">{formatPrice(breakdown.total)}</span>
      </div>
    </div>
  );
}

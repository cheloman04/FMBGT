'use client';

import { useBooking } from '@/context/BookingContext';
import { getPriceLineItems, formatPrice, calculatePriceBreakdown } from '@/lib/pricing';
import { Separator } from '@/components/ui/separator';

export function PriceSummary() {
  const { state } = useBooking();
  const { bike_rental, duration_hours, addons, trail_type, additional_participants } = state;

  if (!bike_rental || !duration_hours || !addons) return null;

  const lineItems = getPriceLineItems(bike_rental, duration_hours, addons, trail_type, additional_participants);
  const breakdown = calculatePriceBreakdown(bike_rental, duration_hours, addons, trail_type, additional_participants);

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

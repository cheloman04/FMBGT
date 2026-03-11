'use client';

import { useBooking } from '@/context/BookingContext';
import { getPriceLineItems, formatPrice, calculatePriceBreakdown } from '@/lib/pricing';
import { Separator } from '@/components/ui/separator';

export function PriceSummary() {
  const { state } = useBooking();
  const { bike_rental, duration_hours, addons } = state;

  if (!bike_rental || !duration_hours || !addons) return null;

  const lineItems = getPriceLineItems(bike_rental, duration_hours, addons);
  const breakdown = calculatePriceBreakdown(bike_rental, duration_hours, addons);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="font-semibold text-gray-900 mb-3">Price Summary</h3>
      <div className="space-y-2">
        {lineItems.map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-gray-600">{item.label}</span>
            <span className="text-gray-900 font-medium">{formatPrice(item.amount)}</span>
          </div>
        ))}
      </div>
      <Separator className="my-3" />
      <div className="flex justify-between font-semibold">
        <span>Total</span>
        <span className="text-green-600">{formatPrice(breakdown.total)}</span>
      </div>
    </div>
  );
}

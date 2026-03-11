'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useBooking } from '@/context/BookingContext';
import type { DurationHours } from '@/types/booking';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatPrice, PRICING, calculatePriceBreakdown } from '@/lib/pricing';

const DURATION_OPTIONS: Array<{
  hours: DurationHours;
  label: string;
  description: string;
}> = [
  {
    hours: 2,
    label: '2 Hours',
    description: 'Perfect intro to the trail. Covers the highlights.',
  },
  {
    hours: 3,
    label: '3 Hours',
    description: 'Extended ride with more trail coverage. Most popular.',
  },
  {
    hours: 4,
    label: '4 Hours',
    description: 'Full adventure. Maximum trail exploration.',
  },
];

export default function Step6DurationPage() {
  const router = useRouter();
  const { state, setDuration, setPriceBreakdown } = useBooking();
  const [selected, setSelected] = useState<DurationHours | undefined>(state.duration_hours);

  const getSurcharge = (hours: DurationHours) => {
    const extra = hours - PRICING.BASE_DURATION_HOURS;
    return extra > 0 ? extra * PRICING.ADDITIONAL_HOUR : 0;
  };

  const handleContinue = () => {
    if (!selected) return;
    setDuration(selected);

    // Update price breakdown
    if (state.bike_rental) {
      const breakdown = calculatePriceBreakdown(
        state.bike_rental,
        selected,
        state.addons ?? {}
      );
      setPriceBreakdown(breakdown);
    }

    router.push('/booking/step7-addons');
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Choose Duration</h2>
        <p className="text-gray-500 mt-1">
          Base tour is 2 hours. Additional hours are {formatPrice(PRICING.ADDITIONAL_HOUR)}/hr.
        </p>
      </div>

      <Button variant="ghost" onClick={() => router.back()} className="mb-4 text-gray-500">
        ← Back
      </Button>

      <div className="space-y-3 mb-6">
        {DURATION_OPTIONS.map((option) => {
          const surcharge = getSurcharge(option.hours);
          return (
            <button
              key={option.hours}
              onClick={() => setSelected(option.hours)}
              className="w-full text-left focus:outline-none focus:ring-2 focus:ring-green-500 rounded-lg"
            >
              <Card
                className={`transition-all cursor-pointer ${
                  selected === option.hours
                    ? 'border-green-500 bg-green-50'
                    : 'hover:border-gray-300'
                }`}
              >
                <CardHeader className="py-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-base">{option.label}</CardTitle>
                      <CardDescription>{option.description}</CardDescription>
                    </div>
                    <div className="text-sm font-semibold text-gray-900 ml-4 whitespace-nowrap">
                      {surcharge > 0 ? (
                        <span className="text-orange-600">+{formatPrice(surcharge)}</span>
                      ) : (
                        <span className="text-green-600">Included</span>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </button>
          );
        })}
      </div>

      <Button
        onClick={handleContinue}
        disabled={!selected}
        className="w-full bg-green-600 hover:bg-green-700 text-white"
        size="lg"
      >
        Continue
      </Button>
    </div>
  );
}

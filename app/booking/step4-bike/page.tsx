'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useBooking } from '@/context/BookingContext';
import type { BikeRental } from '@/types/booking';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { formatPrice, PRICING } from '@/lib/pricing';

const BIKE_OPTIONS: Array<{
  value: BikeRental;
  label: string;
  description: string;
  price: string;
}> = [
  {
    value: 'none',
    label: 'No Bike Rental',
    description: 'I have my own bike.',
    price: `Tour from ${formatPrice(PRICING.BASE_NO_BIKE)}`,
  },
  {
    value: 'standard',
    label: 'Standard Bike Rental',
    description: 'Quality rental bike included with your tour.',
    price: `Tour + bike from ${formatPrice(PRICING.BASE_WITH_BIKE)}`,
  },
  {
    value: 'electric',
    label: 'Electric Bike Rental',
    description: 'Motor-assisted bike for an easier, longer-range ride. Limited availability.',
    price: `Tour + e-bike from ${formatPrice(PRICING.BASE_WITH_BIKE + PRICING.ADDONS.electric_upgrade)}`,
  },
];

const HEIGHT_OPTIONS = [
  { label: "Under 5'0\" (< 60 inches)", value: 59 },
  { label: "5'0\" – 5'3\" (60–63 inches)", value: 62 },
  { label: "5'4\" – 5'7\" (64–67 inches)", value: 66 },
  { label: "5'8\" – 5'11\" (68–71 inches)", value: 70 },
  { label: "6'0\" – 6'3\" (72–75 inches)", value: 74 },
  { label: "Over 6'3\" (> 75 inches)", value: 76 },
];

export default function Step4BikePage() {
  const router = useRouter();
  const { state, setBikeRental, setRiderHeight } = useBooking();
  const [selectedBike, setSelectedBike] = useState<BikeRental | undefined>(state.bike_rental);
  const [height, setHeight] = useState<number | undefined>(state.rider_height_inches);

  const needsHeight = selectedBike && selectedBike !== 'none';

  const handleContinue = () => {
    if (!selectedBike) return;
    setBikeRental(selectedBike);
    if (needsHeight && height) {
      setRiderHeight(height);
    }
    router.push('/booking/step5-datetime');
  };

  const canContinue = selectedBike && (!needsHeight || height);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Bike Rental</h2>
        <p className="text-gray-500 mt-1">Do you need a bike for your tour?</p>
      </div>

      <Button variant="ghost" onClick={() => router.back()} className="mb-4 text-gray-500">
        ← Back
      </Button>

      <div className="space-y-3 mb-6">
        {BIKE_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => setSelectedBike(option.value)}
            className="w-full text-left focus:outline-none focus:ring-2 focus:ring-green-500 rounded-lg"
          >
            <Card
              className={`transition-all cursor-pointer ${
                selectedBike === option.value
                  ? 'border-green-500 bg-green-50'
                  : 'hover:border-gray-300'
              }`}
            >
              <CardHeader className="py-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base">{option.label}</CardTitle>
                    <CardDescription className="mt-1">{option.description}</CardDescription>
                  </div>
                  <span className="text-sm font-medium text-gray-700 whitespace-nowrap ml-4">
                    {option.price}
                  </span>
                </div>
              </CardHeader>
            </Card>
          </button>
        ))}
      </div>

      {needsHeight && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <Label className="block mb-2 font-medium text-gray-900">
            Rider Height (for bike sizing)
          </Label>
          <select
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
            value={height ?? ''}
            onChange={(e) => setHeight(Number(e.target.value))}
          >
            <option value="">Select your height...</option>
            {HEIGHT_OPTIONS.map((h) => (
              <option key={h.value} value={h.value}>
                {h.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <Button
        onClick={handleContinue}
        disabled={!canContinue}
        className="w-full bg-green-600 hover:bg-green-700 text-white"
        size="lg"
      >
        Continue
      </Button>
    </div>
  );
}

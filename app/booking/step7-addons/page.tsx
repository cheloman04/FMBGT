'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useBooking } from '@/context/BookingContext';
import type { Addons } from '@/types/booking';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PriceSummary } from '@/components/PriceSummary';
import { formatPrice, PRICING, calculatePriceBreakdown } from '@/lib/pricing';

interface AddonOption {
  key: keyof Addons;
  label: string;
  description: string;
  price: number;
  badge?: string;
}

const ADDON_OPTIONS: AddonOption[] = [
  {
    key: 'gopro',
    label: 'GoPro Package',
    description: 'Capture your adventure with a mounted GoPro camera. Footage delivered digitally.',
    price: PRICING.ADDONS.gopro,
    badge: 'Popular',
  },
  {
    key: 'pickup_dropoff',
    label: 'Pickup + Dropoff',
    description: 'Door-to-door transportation to and from the trail. Central Florida area.',
    price: PRICING.ADDONS.pickup_dropoff,
  },
  {
    key: 'electric_upgrade',
    label: 'Electric Bike Upgrade',
    description: 'Upgrade to a motor-assisted electric bike. Limited availability.',
    price: PRICING.ADDONS.electric_upgrade,
    badge: 'Limited',
  },
];

export default function Step7AddonsPage() {
  const router = useRouter();
  const { state, setAddons, setPriceBreakdown } = useBooking();
  const [selected, setSelected] = useState<Addons>(state.addons ?? {});

  const toggle = (key: keyof Addons) => {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleContinue = () => {
    setAddons(selected);
    if (state.bike_rental && state.duration_hours) {
      const breakdown = calculatePriceBreakdown(state.bike_rental, state.duration_hours, selected);
      setPriceBreakdown(breakdown);
    }
    router.push('/booking/step8-waiver');
  };

  // Filter out electric upgrade if already renting electric bike
  const availableAddons = ADDON_OPTIONS.filter((addon) => {
    if (addon.key === 'electric_upgrade' && state.bike_rental === 'electric') return false;
    return true;
  });

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Add-ons</h2>
        <p className="text-gray-500 mt-1">Enhance your experience with optional add-ons.</p>
      </div>

      <Button variant="ghost" onClick={() => router.back()} className="mb-4 text-gray-500">
        ← Back
      </Button>

      <div className="space-y-3 mb-6">
        {availableAddons.map((addon) => (
          <button
            key={addon.key}
            onClick={() => toggle(addon.key)}
            className="w-full text-left focus:outline-none focus:ring-2 focus:ring-green-500 rounded-lg"
          >
            <Card
              className={`transition-all cursor-pointer ${
                selected[addon.key]
                  ? 'border-green-500 bg-green-50'
                  : 'hover:border-gray-300'
              }`}
            >
              <CardHeader className="py-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{addon.label}</CardTitle>
                      {addon.badge && (
                        <Badge variant="secondary" className="text-xs">{addon.badge}</Badge>
                      )}
                    </div>
                    <CardDescription className="mt-1">{addon.description}</CardDescription>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                      +{formatPrice(addon.price)}
                    </span>
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        selected[addon.key]
                          ? 'bg-green-600 border-green-600'
                          : 'border-gray-300'
                      }`}
                    >
                      {selected[addon.key] && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </button>
        ))}
      </div>

      {/* Price Summary */}
      {state.bike_rental && state.duration_hours && (
        <div className="mb-6">
          <PriceSummary />
        </div>
      )}

      <Button
        onClick={handleContinue}
        className="w-full bg-green-600 hover:bg-green-700 text-white"
        size="lg"
      >
        Continue
      </Button>
    </div>
  );
}

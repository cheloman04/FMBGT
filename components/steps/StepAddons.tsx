'use client';

import { useState, useEffect } from 'react';
import { useBooking } from '@/context/BookingContext';
import type { Addons, InventoryStatus } from '@/types/booking';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PriceSummary } from '@/components/PriceSummary';
import { formatPrice, PRICING, calculatePriceBreakdown } from '@/lib/pricing';
import { BookingStepActions } from '@/components/BookingStepActions';

interface AddonOption {
  key: keyof Addons;
  label: string;
  description: string;
  price: number;
  badge?: string;
  inventoryItem?: string;
}

const ADDON_OPTIONS: AddonOption[] = [
  {
    key: 'gopro',
    label: 'GoPro Package',
    description: 'Capture your adventure with a mounted GoPro camera. Footage delivered digitally.',
    price: PRICING.ADDONS.gopro,
    badge: 'Popular',
    inventoryItem: 'gopro',
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
    inventoryItem: 'electric_bike',
  },
];

export function StepAddons() {
  const { state, setAddons, setPriceBreakdown, goNext, goPrev } = useBooking();
  const [selected, setSelected] = useState<Addons>(state.addons ?? {});
  const [inventory, setInventory] = useState<Record<string, InventoryStatus> | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(true);

  useEffect(() => {
    if (!state.date) {
      setInventoryLoading(false);
      return;
    }
    fetch('/api/validate-inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: state.date, bike_rental: state.bike_rental, addons: {} }),
    })
      .then((r) => r.json())
      .then((data) => setInventory(data.inventory ?? null))
      .catch(() => setInventory(null))
      .finally(() => setInventoryLoading(false));
  }, [state.date, state.bike_rental]);

  const isSoldOut = (option: AddonOption): boolean => {
    if (!option.inventoryItem || !inventory) return false;
    const item = inventory[option.inventoryItem];
    return item ? item.available <= 0 : false;
  };

  const toggle = (key: keyof Addons, soldOut: boolean) => {
    if (soldOut) return;
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleContinue = () => {
    setAddons(selected);
    if (state.bike_rental && state.duration_hours) {
      const breakdown = calculatePriceBreakdown(
        state.bike_rental,
        state.duration_hours,
        selected,
        state.trail_type,
        state.additional_participants
      );
      setPriceBreakdown(breakdown);
    }
    goNext();
  };

  const visibleAddons = ADDON_OPTIONS.filter((a) => {
    if (a.key !== 'electric_upgrade') return true;
    // E-bike is selected per-rider in StepBike for paved tours — hide addon here
    if (state.trail_type === 'paved') return false;
    // For MTB, hide if rider already chose electric as their bike
    if (state.bike_rental === 'electric') return false;
    if (state.bike_rental === 'none') return false;
    return true;
  });

  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-foreground">Add-ons</h2>
        <p className="text-muted-foreground mt-1">Enhance your experience with optional add-ons.</p>
      </div>

      <BookingStepActions onBack={goPrev} />

      <div className="space-y-3 mb-6">
        {visibleAddons.map((addon) => {
          const soldOut = isSoldOut(addon);
          const isSelected = !!selected[addon.key];
          const inventoryCount = addon.inventoryItem ? inventory?.[addon.inventoryItem]?.available : undefined;

          return (
            <button
              key={addon.key}
              onClick={() => toggle(addon.key, soldOut)}
              disabled={soldOut || inventoryLoading}
              className="w-full text-left focus:outline-none focus:ring-2 focus:ring-green-500 rounded-lg disabled:cursor-not-allowed"
            >
              <Card
                className={`transition-all ${
                  soldOut
                    ? 'opacity-50 bg-muted cursor-not-allowed'
                    : isSelected
                    ? 'border-green-500 bg-green-50 dark:bg-green-950/30 cursor-pointer'
                    : 'hover:border-border cursor-pointer'
                }`}
              >
                <CardHeader className="py-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-base">{addon.label}</CardTitle>
                        {soldOut ? (
                          <Badge variant="destructive" className="text-xs">Sold Out</Badge>
                        ) : addon.badge ? (
                          <Badge variant="secondary" className="text-xs">{addon.badge}</Badge>
                        ) : null}
                        {!soldOut && inventoryCount !== undefined && (
                          <span className="text-xs text-orange-600 font-medium">
                            {inventoryCount} left
                          </span>
                        )}
                      </div>
                      <CardDescription className="mt-1">{addon.description}</CardDescription>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                        +{formatPrice(addon.price)}
                      </span>
                      {!soldOut && (
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                            isSelected ? 'bg-green-600 border-green-600' : 'border-border'
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </button>
          );
        })}
      </div>

      {state.bike_rental && state.duration_hours && (
        <div className="mb-6">
          <PriceSummary
            bikeRental={state.bike_rental}
            durationHours={state.duration_hours}
            addons={selected}
            trailType={state.trail_type}
            additionalParticipants={state.additional_participants}
          />
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



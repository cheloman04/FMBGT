'use client';

import Image from 'next/image';
import { useBooking } from '@/context/BookingContext';
import type { TrailType } from '@/types/booking';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookingStepActions } from '@/components/BookingStepActions';

const TRAIL_OPTIONS: Array<{
  type: TrailType;
  label: string;
  description: string;
  image: string;
  badge: string;
}> = [
  {
    type: 'paved',
    label: 'Paved Trail',
    description: 'Smooth paved trails suitable for all riders. Great for scenic rides and relaxed exploration.',
    image: '/images/booking/trail-type-paved.png',
    badge: 'Paved',
  },
  {
    type: 'mtb',
    label: 'Mountain Bike Trail',
    description: 'Off-road trails with varying terrain. Choose your skill level and enjoy a guided mountain biking adventure.',
    image: '/images/booking/trail-type-mtb.png',
    badge: 'MTB',
  },
];

export function StepTrail() {
  const { setTrailType, goNext } = useBooking();

  const handleSelect = (type: TrailType) => {
    setTrailType(type);
    const newState = type === 'paved'
      ? { trail_type: type, bike_rental: 'standard' as const, duration_hours: 2 as const }
      : { trail_type: type };
    goNext(newState);
  };

  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-foreground">Choose Your Trail Type</h2>
        <p className="text-muted-foreground mt-1">Select the type of guided tour experience you want.</p>
      </div>

      <BookingStepActions />

      <div className="grid gap-4 sm:grid-cols-2">
        {TRAIL_OPTIONS.map((option) => (
          <div
            key={option.type}
            className="flex flex-col rounded-xl border border-border/80 bg-card overflow-hidden
                       transition-all duration-250 ease-in-out cursor-pointer
                       hover:border-green-500 hover:shadow-lg hover:-translate-y-1"
            onClick={() => handleSelect(option.type)}
          >
            {/* Image */}
            <div className="relative aspect-[4/3] w-full overflow-hidden">
              <Image
                src={option.image}
                alt={option.label}
                fill
                className="object-cover"
              />
              <div className="absolute top-2 right-2">
                <Badge variant="secondary" className="text-xs font-medium shadow">
                  {option.badge}
                </Badge>
              </div>
            </div>

            {/* Body */}
            <div className="flex flex-col flex-1 p-4 gap-3">
              <h3 className="font-semibold text-sm leading-snug text-foreground">{option.label}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed flex-1">{option.description}</p>
              <Button
                size="sm"
                className="w-full bg-green-600 hover:bg-green-700 text-white text-xs mt-1"
                onClick={(e) => { e.stopPropagation(); handleSelect(option.type); }}
              >
                Select
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

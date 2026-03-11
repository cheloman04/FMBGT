'use client';

import { useRouter } from 'next/navigation';
import { useBooking } from '@/context/BookingContext';
import type { TrailType } from '@/types/booking';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const TRAIL_OPTIONS: Array<{
  type: TrailType;
  label: string;
  description: string;
  emoji: string;
}> = [
  {
    type: 'paved',
    label: 'Paved Trail',
    description: 'Smooth, paved trails suitable for all riders. Great for scenic rides.',
    emoji: '🚴',
  },
  {
    type: 'mtb',
    label: 'Mountain Bike Trail',
    description: 'Off-road trails with varying terrain. Choose your skill level.',
    emoji: '⛰️',
  },
];

export default function Step1TrailPage() {
  const router = useRouter();
  const { setTrailType } = useBooking();

  const handleSelect = (type: TrailType) => {
    setTrailType(type);
    if (type === 'paved') {
      // Skip skill level for paved trails
      router.push('/booking/step3-location');
    } else {
      router.push('/booking/step2-skill');
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Choose Your Trail Type</h2>
        <p className="text-gray-500 mt-1">Select the type of guided tour experience you want.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {TRAIL_OPTIONS.map((option) => (
          <button
            key={option.type}
            onClick={() => handleSelect(option.type)}
            className="text-left focus:outline-none focus:ring-2 focus:ring-green-500 rounded-lg"
          >
            <Card className="h-full hover:border-green-500 hover:shadow-md transition-all cursor-pointer">
              <CardHeader>
                <div className="text-4xl mb-2">{option.emoji}</div>
                <CardTitle>{option.label}</CardTitle>
                <CardDescription>{option.description}</CardDescription>
              </CardHeader>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}

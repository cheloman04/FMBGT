'use client';

import { useRouter } from 'next/navigation';
import { useBooking } from '@/context/BookingContext';
import type { Location } from '@/types/booking';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Props {
  locations: Location[];
}

export function Step3LocationClient({ locations }: Props) {
  const router = useRouter();
  const { state, setLocation } = useBooking();

  // Filter locations based on trail type and skill level
  const filtered = locations.filter((loc) => {
    if (loc.tour_type !== state.trail_type) return false;
    if (loc.skill_levels && state.skill_level) {
      return loc.skill_levels.includes(state.skill_level);
    }
    return true;
  });

  const handleSelect = (location: Location) => {
    setLocation(location.id, location.name);
    router.push('/booking/step4-bike');
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Choose Your Location</h2>
        <p className="text-gray-500 mt-1">
          Select where you&apos;d like to ride.
          {state.skill_level && (
            <span className="ml-1 text-green-600 font-medium">
              Showing trails for your skill level.
            </span>
          )}
        </p>
      </div>

      <Button variant="ghost" onClick={() => router.back()} className="mb-4 text-gray-500">
        ← Back
      </Button>

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No locations available for your selection. Please go back and try different options.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((location) => (
            <button
              key={location.id}
              onClick={() => handleSelect(location)}
              className="text-left focus:outline-none focus:ring-2 focus:ring-green-500 rounded-lg"
            >
              <Card className="hover:border-green-500 hover:shadow-md transition-all cursor-pointer">
                <CardHeader className="py-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{location.name}</CardTitle>
                    <Badge variant="secondary">
                      {location.tour_type === 'paved' ? 'Paved' : 'MTB'}
                    </Badge>
                  </div>
                </CardHeader>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

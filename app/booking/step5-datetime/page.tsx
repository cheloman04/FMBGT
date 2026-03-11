'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useBooking } from '@/context/BookingContext';
import type { AvailabilitySlot } from '@/types/booking';
import { Button } from '@/components/ui/button';

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`;
}

// Get next 30 days
function getDateRange(): { dateFrom: string; dateTo: string } {
  const today = new Date();
  const future = new Date();
  future.setDate(today.getDate() + 30);
  return {
    dateFrom: today.toISOString().split('T')[0],
    dateTo: future.toISOString().split('T')[0],
  };
}

export default function Step5DateTimePage() {
  const router = useRouter();
  const { state, setDate, setTimeSlot } = useBooking();

  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [grouped, setGrouped] = useState<Record<string, AvailabilitySlot[]>>({});
  const [selectedDate, setSelectedDate] = useState<string | undefined>(state.date);
  const [selectedTime, setSelectedTime] = useState<string | undefined>(state.time_slot);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { dateFrom, dateTo } = getDateRange();

    fetch(`/api/availability?dateFrom=${dateFrom}&dateTo=${dateTo}`)
      .then((r) => r.json())
      .then((data) => {
        const available = (data.slots as AvailabilitySlot[]) ?? [];
        setSlots(available);

        // Group by date
        const byDate: Record<string, AvailabilitySlot[]> = {};
        for (const slot of available) {
          if (!byDate[slot.date]) byDate[slot.date] = [];
          byDate[slot.date].push(slot);
        }
        setGrouped(byDate);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load availability. Please try again.');
        setLoading(false);
      });
  }, []);

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setSelectedTime(undefined);
  };

  const handleContinue = () => {
    if (!selectedDate || !selectedTime) return;
    setDate(selectedDate);
    setTimeSlot(selectedTime);
    router.push('/booking/step6-duration');
  };

  const availableDates = Object.keys(grouped).filter(
    (date) => grouped[date].some((s) => s.available)
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Select Date &amp; Time</h2>
        <p className="text-gray-500 mt-1">Choose when you&apos;d like to ride.</p>
      </div>

      <Button variant="ghost" onClick={() => router.back()} className="mb-4 text-gray-500">
        ← Back
      </Button>

      {loading && (
        <div className="text-center py-8 text-gray-500">Loading availability...</div>
      )}

      {error && (
        <div className="text-center py-8 text-red-500">{error}</div>
      )}

      {!loading && !error && (
        <>
          {/* Date selection */}
          <div className="mb-6">
            <h3 className="font-medium text-gray-900 mb-3">Available Dates</h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {availableDates.map((date) => {
                const d = new Date(date + 'T00:00:00');
                return (
                  <button
                    key={date}
                    onClick={() => handleDateSelect(date)}
                    className={`p-2 rounded-lg border text-center text-sm transition-colors ${
                      selectedDate === date
                        ? 'border-green-500 bg-green-50 text-green-700 font-medium'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <div className="font-medium">{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    <div className="text-xs text-gray-500">{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time selection */}
          {selectedDate && (
            <div className="mb-6">
              <h3 className="font-medium text-gray-900 mb-3">
                Available Times — {formatDate(selectedDate)}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {grouped[selectedDate]?.map((slot) => (
                  <button
                    key={slot.time}
                    disabled={!slot.available}
                    onClick={() => slot.available && setSelectedTime(slot.time)}
                    className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                      !slot.available
                        ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                        : selectedTime === slot.time
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    {formatTime(slot.time)}
                    {!slot.available && (
                      <div className="text-xs mt-0.5">Booked</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={handleContinue}
            disabled={!selectedDate || !selectedTime}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            size="lg"
          >
            Continue
          </Button>
        </>
      )}
    </div>
  );
}

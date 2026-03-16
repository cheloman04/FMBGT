'use client';

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

function getDateRange(): { dateFrom: string; dateTo: string } {
  const today = new Date();
  today.setDate(today.getDate() + 1);
  const future = new Date(today);
  future.setDate(today.getDate() + 30);
  return {
    dateFrom: today.toISOString().split('T')[0],
    dateTo: future.toISOString().split('T')[0],
  };
}

export function StepDateTime() {
  const { state, setDate, setTimeSlot, goNext, goPrev } = useBooking();

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
        const slots = (data.slots as AvailabilitySlot[]) ?? [];
        const byDate: Record<string, AvailabilitySlot[]> = {};
        for (const slot of slots) {
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
    goNext();
  };

  const availableDates = Object.keys(grouped).filter(
    (date) => grouped[date].some((s) => s.available)
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Select Date &amp; Time</h2>
        <p className="text-muted-foreground mt-1">Choose when you&apos;d like to ride.</p>
      </div>

      <Button variant="outline" onClick={goPrev} className="mb-4 gap-1.5 border-border text-foreground hover:bg-muted">
        ← Back
      </Button>

      {loading && <div className="text-center py-8 text-muted-foreground">Loading availability...</div>}
      {error && <div className="text-center py-8 text-destructive">{error}</div>}

      {!loading && !error && (
        <>
          <div className="mb-6">
            <h3 className="font-medium text-foreground mb-3">Available Dates</h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {availableDates.map((date) => {
                const d = new Date(date + 'T00:00:00');
                return (
                  <button
                    key={date}
                    onClick={() => handleDateSelect(date)}
                    className={`p-2 rounded-lg border text-center text-sm transition-colors ${
                      selectedDate === date
                        ? 'border-green-500 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 font-medium'
                        : 'border-border hover:border-muted-foreground text-foreground'
                    }`}
                  >
                    <div className="font-medium">
                      {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {d.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedDate && (
            <div className="mb-6">
              <h3 className="font-medium text-foreground mb-3">
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
                        ? 'border-border bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                        : selectedTime === slot.time
                        ? 'border-green-500 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300'
                        : 'border-border hover:border-muted-foreground text-foreground'
                    }`}
                  >
                    {formatTime(slot.time)}
                    {!slot.available && <div className="text-xs mt-0.5">Booked</div>}
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

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useBooking } from '@/context/BookingContext';
import type { AvailabilitySlot } from '@/types/booking';
import { Button } from '@/components/ui/button';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', {
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

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getDateRange(): { dateFrom: string; dateTo: string; minDate: Date; maxDate: Date } {
  const minDate = new Date();
  minDate.setHours(0, 0, 0, 0);
  minDate.setDate(minDate.getDate() + 1);

  const maxDate = new Date(minDate);
  maxDate.setMonth(maxDate.getMonth() + 3);
  maxDate.setDate(0);

  return {
    dateFrom: toIsoDate(minDate),
    dateTo: toIsoDate(maxDate),
    minDate,
    maxDate,
  };
}

function getCalendarDays(month: Date): Date[] {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());

  const gridEnd = new Date(monthEnd);
  gridEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));

  const days: Date[] = [];
  for (let cursor = new Date(gridStart); cursor <= gridEnd; cursor.setDate(cursor.getDate() + 1)) {
    days.push(new Date(cursor));
  }
  return days;
}

function isSameMonth(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function compareDateOnly(left: Date, right: Date): number {
  const leftValue = startOfMonth(left).getTime() + left.getDate();
  const rightValue = startOfMonth(right).getTime() + right.getDate();
  return leftValue - rightValue;
}

export function StepDateTime() {
  const { state, setDate, setTimeSlot, goNext, goPrev } = useBooking();

  const [grouped, setGrouped] = useState<Record<string, AvailabilitySlot[]>>({});
  const [selectedDate, setSelectedDate] = useState<string | undefined>(state.date);
  const [selectedTime, setSelectedTime] = useState<string | undefined>(state.time_slot);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { dateFrom, dateTo, minDate, maxDate } = useMemo(() => getDateRange(), []);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    state.date ? startOfMonth(new Date(`${state.date}T00:00:00`)) : startOfMonth(minDate)
  );

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const url = `/api/availability?dateFrom=${dateFrom}&dateTo=${dateTo}&timeZone=${encodeURIComponent(tz)}`;
    console.log('[StepDateTime] Fetching availability:', url);

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        const slots = (data.slots as AvailabilitySlot[]) ?? [];
        console.log(`[StepDateTime] Received ${slots.length} slot(s)`);

        const byDate: Record<string, AvailabilitySlot[]> = {};
        for (const slot of slots) {
          if (!byDate[slot.date]) byDate[slot.date] = [];
          byDate[slot.date].push(slot);
        }

        const availableDays = Object.keys(byDate).filter((d) => byDate[d].some((s) => s.available));
        console.log(`[StepDateTime] Available dates (${availableDays.length}):`, availableDays.slice(0, 10));

        setGrouped(byDate);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[StepDateTime] Availability fetch error:', err);
        setError('Failed to load availability. Please try again.');
        setLoading(false);
      });
  }, [dateFrom, dateTo]);

  const availableDates = useMemo(
    () =>
      new Set(
        Object.keys(grouped).filter((date) => grouped[date].some((slot) => slot.available))
      ),
    [grouped]
  );

  const calendarDays = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);

  const selectedDateSlots = useMemo(() => {
    if (!selectedDate) return [];
    return [...(grouped[selectedDate] ?? [])].sort((left, right) => left.time.localeCompare(right.time));
  }, [grouped, selectedDate]);

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

  const canGoPrevMonth = visibleMonth > startOfMonth(minDate);
  const canGoNextMonth = visibleMonth < startOfMonth(maxDate);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Select Date &amp; Time</h2>
        <p className="text-muted-foreground mt-1">Choose when you&apos;d like to ride.</p>
      </div>

      <Button variant="outline" onClick={goPrev} className="mb-4 gap-1.5 border-border text-foreground hover:bg-muted">
        ← Back
      </Button>

      {loading && <div className="py-8 text-center text-muted-foreground">Loading availability...</div>}
      {error && <div className="py-8 text-center text-destructive">{error}</div>}

      {!loading && !error && (
        <>
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-medium text-foreground">Available Dates</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => canGoPrevMonth && setVisibleMonth((current) => addMonths(current, -1))}
                  disabled={!canGoPrevMonth}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ←
                </button>
                <div className="min-w-[9rem] text-center text-sm font-medium text-foreground">
                  {visibleMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </div>
                <button
                  type="button"
                  onClick={() => canGoNextMonth && setVisibleMonth((current) => addMonths(current, 1))}
                  disabled={!canGoNextMonth}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                >
                  →
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
              <div className="mb-2 grid grid-cols-7 gap-2">
                {WEEKDAY_LABELS.map((label) => (
                  <div key={label} className="py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {label}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day) => {
                  const isoDate = toIsoDate(day);
                  const inCurrentMonth = isSameMonth(day, visibleMonth);
                  const beforeMinDate = compareDateOnly(day, minDate) < 0;
                  const afterMaxDate = compareDateOnly(day, maxDate) > 0;
                  const isAvailable = availableDates.has(isoDate);
                  const isDisabled = !inCurrentMonth || beforeMinDate || afterMaxDate || !isAvailable;
                  const isSelected = selectedDate === isoDate;

                  return (
                    <button
                      key={isoDate}
                      type="button"
                      onClick={() => !isDisabled && handleDateSelect(isoDate)}
                      disabled={isDisabled}
                      className={`min-h-16 rounded-lg border p-2 text-center transition-colors sm:min-h-20 ${
                        isSelected
                          ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300'
                          : isDisabled
                          ? 'border-border bg-muted/40 text-muted-foreground opacity-45'
                          : 'border-border text-foreground hover:border-muted-foreground hover:bg-muted/40'
                      }`}
                    >
                      <div className="text-sm font-semibold">{day.getDate()}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-wide">
                        {isAvailable && inCurrentMonth ? 'Available' : 'Unavailable'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {selectedDate && (
            <div className="mb-6">
              <h3 className="mb-3 font-medium text-foreground">
                Available Times — {formatDate(selectedDate)}
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {selectedDateSlots.map((slot) => (
                  <button
                    key={slot.time}
                    disabled={!slot.available}
                    onClick={() => slot.available && setSelectedTime(slot.time)}
                    className={`rounded-lg border p-3 text-sm font-medium transition-colors ${
                      !slot.available
                        ? 'cursor-not-allowed border-border bg-muted text-muted-foreground opacity-50'
                        : selectedTime === slot.time
                        ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300'
                        : 'border-border text-foreground hover:border-muted-foreground'
                    }`}
                  >
                    {formatTime(slot.time)}
                    {!slot.available && <div className="mt-0.5 text-xs">Booked</div>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={handleContinue}
            disabled={!selectedDate || !selectedTime}
            className="w-full bg-green-600 text-white hover:bg-green-700"
            size="lg"
          >
            Continue
          </Button>
        </>
      )}
    </div>
  );
}

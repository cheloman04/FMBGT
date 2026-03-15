'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { useBooking } from '@/context/BookingContext';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/pricing';

interface BookingDetails {
  id: string;
  trail_type: string;
  location_name: string | null;
  date: string;
  time_slot: string;
  duration_hours: number;
  bike_rental: string;
  addons: Record<string, boolean>;
  participant_count: number;
  participant_info: Array<{ name: string; bike_rental?: string }>;
  total_price: number; // cents
  status: string;
  customer_name: string | null;
  customer_email: string | null;
}

interface Props {
  booking: BookingDetails | null;
  bookingId: string | null;
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`;
}

function formatTrailType(type: string) {
  return type === 'mtb' ? 'Mountain Bike Trail' : 'Paved Trail';
}

function formatBikeRental(rental: string) {
  if (rental === 'none') return 'No rental (own bike)';
  if (rental === 'standard') return 'Standard bike rental';
  return 'Electric bike rental';
}

export function ConfirmationClient({ booking, bookingId }: Props) {
  const { reset } = useBooking();

  // Reset booking state when the user leaves this page
  useEffect(() => {
    return () => { reset(); };
  }, [reset]);

  const activeAddons = booking
    ? Object.entries(booking.addons)
        .filter(([, v]) => v)
        .map(([k]) => {
          if (k === 'gopro') return 'GoPro Package';
          if (k === 'pickup_dropoff') return 'Pickup + Dropoff';
          if (k === 'electric_upgrade') return 'Electric Bike Upgrade';
          return k;
        })
    : [];

  const hasGroup = booking && booking.participant_count > 1;

  return (
    <div className="text-center py-8">
      {/* Success icon */}
      <div className="w-16 h-16 bg-green-100 dark:bg-green-950/40 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 className="text-3xl font-bold text-foreground mb-2">Booking Confirmed!</h2>
      <p className="text-muted-foreground mb-1">Your guided tour is booked. Get ready to ride!</p>

      {bookingId && (
        <p className="text-sm text-muted-foreground mb-6">
          Booking ID:{' '}
          <span className="font-mono font-medium text-foreground">{bookingId}</span>
        </p>
      )}

      {/* Booking details */}
      {booking ? (
        <div className="bg-card border border-border rounded-lg p-5 max-w-md mx-auto mb-6 text-left space-y-2 text-sm">
          <h3 className="font-semibold text-foreground mb-3">Booking Details</h3>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Trail Type</span>
            <span className="font-medium text-foreground">{formatTrailType(booking.trail_type)}</span>
          </div>

          {booking.location_name && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Location</span>
              <span className="font-medium text-foreground">{booking.location_name}</span>
            </div>
          )}

          <div className="flex justify-between">
            <span className="text-muted-foreground">Date</span>
            <span className="font-medium text-foreground">{formatDate(booking.date)}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Time</span>
            <span className="font-medium text-foreground">{formatTime(booking.time_slot)}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Duration</span>
            <span className="font-medium text-foreground">{booking.duration_hours} hours</span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Bike</span>
            <span className="font-medium text-foreground">{formatBikeRental(booking.bike_rental)}</span>
          </div>

          {hasGroup && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Riders</span>
              <span className="font-medium text-foreground">{booking.participant_count} people</span>
            </div>
          )}

          {hasGroup && booking.participant_info.length > 0 && (
            <div className="pt-1">
              <p className="text-muted-foreground mb-1">Additional riders:</p>
              <ul className="space-y-0.5 pl-2">
                {booking.participant_info.map((p, i) => (
                  <li key={i} className="text-foreground text-xs">
                    • {p.name}{p.bike_rental && p.bike_rental !== 'none' ? ` — ${formatBikeRental(p.bike_rental)}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeAddons.length > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Add-ons</span>
              <span className="font-medium text-foreground text-right">{activeAddons.join(', ')}</span>
            </div>
          )}

          <div className="border-t border-border pt-2 mt-2 flex justify-between font-semibold">
            <span className="text-foreground">Total Paid</span>
            <span className="text-green-600 dark:text-green-400">{formatPrice(booking.total_price)}</span>
          </div>

          {booking.customer_email && (
            <p className="text-xs text-muted-foreground pt-1">
              Confirmation sent to {booking.customer_email}
            </p>
          )}
        </div>
      ) : (
        bookingId && (
          <div className="bg-card border border-border rounded-lg p-4 max-w-md mx-auto mb-6 text-sm text-muted-foreground">
            Booking details are being processed. Check your email for confirmation.
          </div>
        )
      )}

      {/* What happens next */}
      <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-5 max-w-md mx-auto mb-8 text-left">
        <h3 className="font-semibold text-green-900 dark:text-green-300 mb-3">What happens next?</h3>
        <ul className="space-y-2 text-sm text-green-800 dark:text-green-300">
          <li className="flex items-start gap-2">
            <span className="mt-0.5">📧</span>
            <span>A confirmation email will be sent with your booking details.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">📅</span>
            <span>A calendar invite will be sent so you don&apos;t forget your ride.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">📞</span>
            <span>Our team will reach out 24 hours before your tour with meeting point details.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">🚴</span>
            <span>Wear comfortable clothing and closed-toe shoes. Helmets are provided.</span>
          </li>
        </ul>
      </div>

      <div className="flex gap-3 justify-center flex-wrap">
        <Link href="/booking" className={cn(buttonVariants({ variant: 'outline' }))}>
          Book Another Tour
        </Link>
        <a
          href="https://floridamtbguidedtours.com"
          className={cn(buttonVariants({ variant: 'default' }), 'bg-green-600 hover:bg-green-700 text-white')}
        >
          Return to Website
        </a>
      </div>
    </div>
  );
}

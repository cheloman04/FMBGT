'use client';

import { useState } from 'react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/pricing';
import { formatFloridaCalendarDate } from '@/lib/display-time';

interface BookingResult {
  id: string;
  trail_type: string;
  date: string;
  time_slot: string;
  duration_hours: number;
  bike_rental: string;
  total_price: number;
  status: string;
  location_name: string;
  addons: Record<string, boolean>;
}

function formatDate(d: string) {
  return formatFloridaCalendarDate(d, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 dark:bg-yellow-950/30 text-yellow-800 dark:text-yellow-300',
  confirmed: 'bg-green-100 dark:bg-green-950/30 text-green-800 dark:text-green-300',
  cancelled: 'bg-muted text-muted-foreground',
  refunded: 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300',
};

export default function LookupPage() {
  const [email, setEmail] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BookingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/booking-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), booking_id: bookingId.trim() }),
      });

      if (res.status === 404) {
        setError('No booking found with that email and booking ID.');
        return;
      }

      if (!res.ok) {
        setError('Something went wrong. Please try again.');
        return;
      }

      const data = await res.json();
      setResult(data);
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Find Your Booking</h1>
          <p className="text-muted-foreground mt-1 text-sm">Enter your email and booking ID to look up your reservation.</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          {!result ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-input bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Booking ID</label>
                <input
                  type="text"
                  required
                  value={bookingId}
                  onChange={(e) => setBookingId(e.target.value)}
                  placeholder="e.g. 3f2a1b4c-..."
                  className="w-full border border-input bg-background text-foreground rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground mt-1">Found in your confirmation email.</p>
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {loading ? 'Looking up...' : 'Find Booking'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-foreground">Booking Details</h2>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[result.status] ?? 'bg-muted text-muted-foreground'}`}>
                  {result.status}
                </span>
              </div>

              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Booking ID</dt>
                  <dd className="font-mono text-xs text-foreground truncate ml-4 max-w-[200px]">{result.id}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Location</dt>
                  <dd className="text-foreground">{result.location_name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Date</dt>
                  <dd className="text-foreground">{formatDate(result.date)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Time</dt>
                  <dd className="text-foreground">{result.time_slot}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Trail</dt>
                  <dd className="text-foreground">{result.trail_type === 'mtb' ? 'Mountain Bike' : 'Paved'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Duration</dt>
                  <dd className="text-foreground">{result.duration_hours} hours</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Bike Rental</dt>
                  <dd className="text-foreground capitalize">{result.bike_rental === 'none' ? 'None' : result.bike_rental}</dd>
                </div>
                {result.addons && Object.entries(result.addons).some(([, v]) => v) && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Add-ons</dt>
                    <dd className="text-foreground">
                      {Object.entries(result.addons)
                        .filter(([, v]) => v)
                        .map(([k]) => k.replace(/_/g, ' '))
                        .join(', ')}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-2 mt-2">
                  <dt className="font-medium text-foreground">Total Paid</dt>
                  <dd className="font-semibold text-foreground">{formatPrice(result.total_price)}</dd>
                </div>
              </dl>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setResult(null); setBookingId(''); setEmail(''); }}
                  className="flex-1 border border-border text-muted-foreground text-sm py-2 rounded-lg hover:bg-muted transition-colors"
                >
                  Look Up Another
                </button>
                <Link
                  href="/booking"
                  className={cn(buttonVariants({ variant: 'default' }), 'flex-1 bg-green-600 hover:bg-green-700 text-white text-sm text-center')}
                >
                  Book Another Tour
                </Link>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Need help?{' '}
          <a href="mailto:info@floridamtbtours.com" className="underline">Contact us</a>
        </p>
      </div>
    </div>
  );
}

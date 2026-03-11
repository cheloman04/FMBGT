'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useBooking } from '@/context/BookingContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PriceSummary } from '@/components/PriceSummary';
import { formatPrice } from '@/lib/pricing';

export default function Step9PaymentPage() {
  const router = useRouter();
  const { state, setCustomer } = useBooking();

  const [form, setForm] = useState({
    name: state.customer?.name ?? '',
    email: state.customer?.email ?? '',
    phone: state.customer?.phone ?? '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const customer = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      height_inches: state.rider_height_inches,
    };
    setCustomer(customer);

    try {
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_state: { ...state, customer },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      window.location.href = data.checkout_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Your Details &amp; Payment</h2>
        <p className="text-gray-500 mt-1">
          You&apos;ll be redirected to Stripe&apos;s secure checkout.
        </p>
      </div>

      <Button variant="ghost" onClick={() => router.back()} className="mb-4 text-gray-500">
        ← Back
      </Button>

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="Jane Smith"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder="jane@example.com"
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">Confirmation will be sent here.</p>
          </div>

          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              placeholder="(555) 555-5555"
              className="mt-1"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || !form.name || !form.email}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            size="lg"
          >
            {loading ? 'Redirecting to checkout...' : `Pay ${state.price_breakdown ? formatPrice(state.price_breakdown.total) : ''} Securely →`}
          </Button>

          <p className="text-xs text-gray-400 text-center">
            🔒 Secured by Stripe. We never store your card details.
          </p>
        </form>

        <div>
          <PriceSummary />

          {/* Booking summary */}
          <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4 space-y-2 text-sm">
            <h4 className="font-semibold text-gray-900">Booking Summary</h4>
            {state.trail_type && (
              <div className="flex justify-between">
                <span className="text-gray-500">Trail Type</span>
                <span className="capitalize">{state.trail_type === 'mtb' ? 'Mountain Bike' : 'Paved'}</span>
              </div>
            )}
            {state.location_name && (
              <div className="flex justify-between">
                <span className="text-gray-500">Location</span>
                <span>{state.location_name}</span>
              </div>
            )}
            {state.date && (
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span>{new Date(state.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              </div>
            )}
            {state.time_slot && (
              <div className="flex justify-between">
                <span className="text-gray-500">Time</span>
                <span>{state.time_slot}</span>
              </div>
            )}
            {state.duration_hours && (
              <div className="flex justify-between">
                <span className="text-gray-500">Duration</span>
                <span>{state.duration_hours} hours</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

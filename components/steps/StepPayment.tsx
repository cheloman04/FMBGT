'use client';

import { useState } from 'react';
import { useBooking } from '@/context/BookingContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PriceSummary } from '@/components/PriceSummary';
import { formatPrice } from '@/lib/pricing';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function StepPayment() {
  const { state, setCustomer, goPrev } = useBooking();

  const [form, setForm] = useState({
    name: state.customer?.name ?? '',
    email: state.customer?.email ?? '',
    phone: state.customer?.phone ?? '',
    zip_code: state.customer?.zip_code ?? '',
    marketing_source: state.customer?.marketing_source ?? '',
  });
  const [errors, setErrors] = useState<Partial<typeof form>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validate = (): boolean => {
    const next: Partial<typeof form> = {};
    if (!form.name.trim()) next.name = 'Full name is required.';
    if (!form.email.trim()) next.email = 'Email address is required.';
    else if (!EMAIL_REGEX.test(form.email)) next.email = 'Enter a valid email address.';
    if (form.phone && !/^[\d\s\-()+]+$/.test(form.phone)) {
      next.phone = 'Enter a valid phone number.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setApiError(null);
    setLoading(true);

    const customer = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim() || undefined,
      height_inches: state.rider_height_inches,
      zip_code: form.zip_code.trim() || undefined,
      marketing_source: form.marketing_source || undefined,
    };
    setCustomer(customer);

    try {
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_state: { ...state, customer } }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to create checkout session');
      }

      window.location.href = data.checkout_url;
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const participantCount = state.participant_count ?? 1;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Your Details &amp; Payment</h2>
        <p className="text-muted-foreground mt-1">
          You&apos;ll be redirected to Stripe&apos;s secure checkout.
        </p>
      </div>

      <Button variant="ghost" onClick={goPrev} className="hidden">
        ← Back
      </Button>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Button variant="outline" onClick={goPrev} className="mb-2 gap-1.5 border-border text-foreground hover:bg-muted">
            ← Back
          </Button>

          <div>
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Jane Smith"
              className="mt-1"
            />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
          </div>

          <div>
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="jane@example.com"
              className="mt-1"
            />
            {errors.email ? (
              <p className="text-xs text-destructive mt-1">{errors.email}</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">Confirmation will be sent here.</p>
            )}
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
            {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
          </div>

          <div>
            <Label htmlFor="zip_code">ZIP Code</Label>
            <Input
              id="zip_code"
              name="zip_code"
              value={form.zip_code}
              onChange={handleChange}
              placeholder="32789"
              maxLength={10}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="marketing_source">How did you hear about us?</Label>
            <select
              id="marketing_source"
              name="marketing_source"
              value={form.marketing_source}
              onChange={handleChange}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select an option</option>
              <option value="Facebook">Facebook</option>
              <option value="Instagram">Instagram</option>
              <option value="YouTube">YouTube</option>
              <option value="Google">Google</option>
              <option value="ChatGPT">ChatGPT</option>
            </select>
          </div>

          {apiError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-700 dark:text-red-300">
              {apiError}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            size="lg"
          >
            {loading
              ? 'Redirecting to checkout...'
              : `Pay ${state.price_breakdown ? formatPrice(state.price_breakdown.total) : ''} Securely →`}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            🔒 Secured by Stripe. We never store your card details.
          </p>
        </form>

        <div className="self-start">
          <PriceSummary />

          <div className="mt-4 bg-card border border-border rounded-lg p-4 space-y-2 text-sm">
            <h4 className="font-semibold text-foreground">Booking Summary</h4>
            {participantCount > 1 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Riders</span>
                <span className="text-foreground">{participantCount} people</span>
              </div>
            )}
            {state.trail_type && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Trail Type</span>
                <span className="capitalize text-foreground">{state.trail_type === 'mtb' ? 'Mountain Bike' : 'Paved'}</span>
              </div>
            )}
            {state.location_name && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location</span>
                <span className="text-foreground">{state.location_name}</span>
              </div>
            )}
            {state.date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span className="text-foreground">
                  {new Date(state.date + 'T00:00:00').toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}
            {state.time_slot && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time</span>
                <span className="text-foreground">{state.time_slot}</span>
              </div>
            )}
            {state.duration_hours && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span className="text-foreground">{state.duration_hours} hours</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

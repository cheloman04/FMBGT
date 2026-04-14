'use client';

import { useState } from 'react';
import { useBooking } from '@/context/BookingContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PriceSummary } from '@/components/PriceSummary';
import { formatPrice } from '@/lib/pricing';
import { BookingStepActions } from '@/components/BookingStepActions';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const HEARD_OPTIONS = ['Facebook', 'Instagram', 'YouTube', 'Google', 'ChatGPT'] as const;

function formatDueDate(tourDateStr: string): string {
  const [y, m, d] = tourDateStr.split('-').map(Number) as [number, number, number];
  const dueDate = new Date(y, m - 1, d - 1);
  return dueDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function StepPayment() {
  const { state, setCustomer, goPrev } = useBooking();

  // Fields are pre-filled from lead capture — user can still edit before paying
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

    // Fire lead progress — payment_started (best-effort)
    if (state.lead_id) {
      fetch(`/api/leads/${state.lead_id}/progress`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: state.lead_session_id,
          last_step_completed: 'payment_started',
        }),
      }).catch(() => {});
    }

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

  const total = state.price_breakdown?.total ?? 0;
  const subtotal = state.price_breakdown?.subtotal ?? 0;
  const taxAmount = state.price_breakdown?.tax_amount ?? 0;
  const depositAmount = Math.round(total / 2);
  const remainingBalance = total - depositAmount;
  const participantCount = state.participant_count ?? 1;
  const dueDateLabel = state.date ? formatDueDate(state.date) : 'the day before your tour';

  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-foreground">Review &amp; Pay Deposit</h2>
        <p className="mt-1 text-muted-foreground">
          Confirm your details below, then pay your deposit to secure your ride.
        </p>
      </div>

      <div className="mb-6 space-y-1.5 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
        <p className="text-sm font-semibold text-green-800 dark:text-green-300">
          50% deposit due today - remaining balance charged automatically
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
          <span className="text-muted-foreground">Due now (50% deposit):</span>
          <span className="font-semibold text-foreground">{formatPrice(depositAmount)}</span>
          <span className="text-muted-foreground">Remaining balance:</span>
          <span className="text-foreground">{formatPrice(remainingBalance)}</span>
          <span className="text-muted-foreground">Balance charged on:</span>
          <span className="text-foreground">{dueDateLabel}</span>
          <span className="text-muted-foreground">Total booking value:</span>
          <span className="text-foreground">{formatPrice(total)}</span>
        </div>
        {taxAmount > 0 && (
          <p className="text-xs text-muted-foreground">
            Includes {formatPrice(taxAmount)} in Florida state tax on a subtotal of {formatPrice(subtotal)}.
          </p>
        )}
        <p className="border-t border-green-200 pt-1 text-xs text-green-700 dark:border-green-800 dark:text-green-400">
          By completing checkout you authorize Florida Mountain Bike Guides LLC to charge
          the remaining {formatPrice(remainingBalance)} to your saved card on {dueDateLabel}.
        </p>
      </div>

      <div className="grid items-start gap-6 md:grid-cols-2">
        <form id="payment-details-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
          <BookingStepActions onBack={goPrev} />

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
            {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
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
              <p className="mt-1 text-xs text-destructive">{errors.email}</p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Deposit receipt and booking confirmation sent here.
              </p>
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
            {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone}</p>}
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
              {HEARD_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {apiError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
              {apiError}
            </div>
          )}
        </form>

        <div className="self-start space-y-4">
          <PriceSummary />

          <div className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
            <h4 className="font-semibold text-foreground">Payment Schedule</h4>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Deposit (today)</span>
              <span className="font-semibold text-green-600">{formatPrice(depositAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Balance ({dueDateLabel})</span>
              <span className="text-foreground">{formatPrice(remainingBalance)}</span>
            </div>
            {taxAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Florida state tax</span>
                <span className="text-foreground">{formatPrice(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 font-semibold">
              <span className="text-foreground">Total</span>
              <span className="text-foreground">{formatPrice(total)}</span>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
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
                <span className="capitalize text-foreground">
                  {state.trail_type === 'mtb' ? 'Mountain Bike' : 'Paved'}
                </span>
              </div>
            )}
            {state.location_name && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location</span>
                <span className="max-w-[180px] text-right text-foreground">{state.location_name}</span>
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

        <div className="md:col-span-2">
          <Button
            type="submit"
            form="payment-details-form"
            disabled={loading}
            className="w-full bg-green-600 text-white hover:bg-green-700"
            size="lg"
          >
            {loading
              ? 'Redirecting to checkout...'
              : `Pay ${formatPrice(depositAmount)} Deposit Securely ->`}
          </Button>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            Stripe secures your payment. Your card is saved for the automatic balance charge on {dueDateLabel}.
          </p>
        </div>
      </div>
    </div>
  );
}

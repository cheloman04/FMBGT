'use client';

import { useState } from 'react';
import { useBooking } from '@/context/BookingContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const HEARD_OPTIONS = [
  'Facebook',
  'Instagram',
  'YouTube',
  'Google',
  'ChatGPT',
] as const;

export function StepLeadCapture() {
  const { state, setCustomer, setLeadId, goNext } = useBooking();

  // Pre-fill from existing customer state (e.g. if user goes back and returns)
  const [form, setForm] = useState({
    full_name: state.customer?.name ?? '',
    email: state.customer?.email ?? '',
    phone: state.customer?.phone ?? '',
    zip_code: state.customer?.zip_code ?? '',
    heard_about_us: state.customer?.marketing_source ?? '',
    communication_consent: false,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // If a lead was already created for this session, skip re-creation and just advance
  const alreadyCaptured = !!state.lead_id;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleConsentChange = (checked: boolean) => {
    setForm((prev) => ({ ...prev, communication_consent: checked }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof typeof form, string>> = {};
    if (!form.full_name.trim()) next.full_name = 'Your name is required.';
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

    // If lead already exists (user went back), just advance without recreating
    if (alreadyCaptured) {
      goNext();
      return;
    }

    if (!validate()) return;

    setApiError(null);
    setLoading(true);

    const customer = {
      name: form.full_name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim() || undefined,
      zip_code: form.zip_code.trim() || undefined,
      marketing_source: form.heard_about_us || undefined,
    };

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: customer.name,
          email: customer.email,
          phone: customer.phone,
          zip_code: customer.zip_code,
          heard_about_us: customer.marketing_source,
          selected_trail_type: state.trail_type,
          utm_source: state.utm_source,
          utm_medium: state.utm_medium,
          utm_campaign: state.utm_campaign,
          utm_content: state.utm_content,
          utm_term: state.utm_term,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Could not save your info. Please try again.');
      }

      // Store lead ID and customer info in booking state
      setLeadId(data.id);
      setCustomer(customer);

      // Advance — pass stateOverride with lead_id so goNext routing sees it
      goNext({ ...state, lead_id: data.id, customer });
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-foreground">Secure Your Spot</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We&apos;ll use this to hold your ride details and send your confirmation.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-md space-y-4" noValidate>
        <div>
          <Label htmlFor="full_name">Full Name *</Label>
          <Input
            id="full_name"
            name="full_name"
            value={form.full_name}
            onChange={handleChange}
            placeholder="Jane Smith"
            autoComplete="name"
            className="mt-1"
            disabled={alreadyCaptured}
          />
          {errors.full_name && <p className="mt-1 text-xs text-destructive">{errors.full_name}</p>}
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
            autoComplete="email"
            className="mt-1"
            disabled={alreadyCaptured}
          />
          {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
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
            autoComplete="tel"
            className="mt-1"
            disabled={alreadyCaptured}
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
            autoComplete="postal-code"
            className="mt-1"
            disabled={alreadyCaptured}
          />
        </div>

        <div>
          <Label htmlFor="heard_about_us">How did you hear about us?</Label>
          <select
            id="heard_about_us"
            name="heard_about_us"
            value={form.heard_about_us}
            onChange={handleChange}
            disabled={alreadyCaptured}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">Select an option</option>
            {HEARD_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <div className="flex items-start gap-3 rounded-md border border-border/60 bg-muted/20 p-3">
          <Checkbox
            id="communication_consent"
            checked={form.communication_consent}
            onCheckedChange={(checked) => handleConsentChange(checked === true)}
            disabled={alreadyCaptured}
            aria-label="Consent to email and SMS communications"
            className="mt-0.5"
          />
          <Label
            htmlFor="communication_consent"
            className="text-sm leading-6 font-normal text-muted-foreground"
          >
            By checking this box, you consent to receive informational and marketing communications
            from Florida Mountain Bike Trail Guided Tours via email and SMS.
          </Label>
        </div>

        {apiError && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            {apiError}
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 text-white hover:bg-green-700"
          size="lg"
        >
          {loading ? 'Saving...' : 'Continue →'}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          No spam. Your info is only used to manage your booking.
        </p>
      </form>
    </div>
  );
}

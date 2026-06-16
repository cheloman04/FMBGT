'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ─── Types ────────────────────────────────────────────────────────────────────

type TrailType = 'paved' | 'mtb';
type SkillLevel = 'first_time' | 'beginner' | 'intermediate' | 'advanced';

interface LocationRow {
  id: string;
  name: string;
  tour_type: TrailType;
  skill_levels: string[] | null;
}

interface BookingRow {
  id: string;
  created_at: string;
  date: string;
  time_slot: string;
  duration_hours: number | null;
  trail_type: TrailType;
  skill_level: SkillLevel | null;
  status: string;
  payment_method: string | null;
  deposit_paid_cents: number | null;
  total_price: number | null;
  waiver_accepted: boolean | null;
  waiver_accepted_at: string | null;
  waiver_link_token: string | null;
  admin_notes: string | null;
  bike_rental: string | null;
  participant_count: number | null;
  customers: { name?: string; email?: string; phone?: string } | null;
  locations: { name?: string } | null;
}

interface Props {
  initialLocations: LocationRow[];
  initialBookings: BookingRow[];
}

const SKILL_LABELS: Record<SkillLevel, string> = {
  first_time: 'First Time',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

function fmtMoney(cents: number | null | undefined): string {
  return `$${((cents ?? 0) / 100).toFixed(2)}`;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function ManualBookingClient({ initialLocations, initialBookings }: Props) {
  const [bookings, setBookings] = useState<BookingRow[]>(initialBookings);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [trailType, setTrailType] = useState<TrailType>('mtb');
  const [skillLevel, setSkillLevel] = useState<SkillLevel | ''>('');
  const [locationId, setLocationId] = useState('');
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('09:00');
  const [durationHours, setDurationHours] = useState(2);
  const [bikeRental, setBikeRental] = useState<'none' | 'standard' | 'electric'>('none');
  const [additional, setAdditional] = useState<string[]>([]);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'zelle' | 'venmo' | 'other'>('cash');
  const [adminNotes, setAdminNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // ── Location filtering by trail type + skill ──────────────────────────────────
  const filteredLocations = useMemo(() => {
    return initialLocations.filter((loc) => {
      if (loc.tour_type !== trailType) return false;
      if (trailType === 'mtb' && skillLevel) {
        if (loc.skill_levels && !loc.skill_levels.includes(skillLevel)) return false;
      }
      return true;
    });
  }, [initialLocations, trailType, skillLevel]);

  // Reset selected location if it falls out of the filtered set.
  useEffect(() => {
    if (locationId && !filteredLocations.some((l) => l.id === locationId)) {
      setLocationId('');
    }
  }, [filteredLocations, locationId]);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
    } catch {
      /* clipboard blocked — user can long-press the link */
    }
  };

  const resetForm = () => {
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setSkillLevel('');
    setLocationId('');
    setDate('');
    setTimeSlot('09:00');
    setDurationHours(2);
    setBikeRental('none');
    setAdditional([]);
    setAmount('');
    setPaymentMethod('cash');
    setAdminNotes('');
  };

  const refreshList = async () => {
    try {
      const res = await fetch('/api/admin/manual-booking');
      if (res.ok) {
        const { bookings: rows } = await res.json();
        setBookings(rows ?? []);
      }
    } catch {
      /* keep current list on transient error */
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amountCents = Math.round(parseFloat(amount || '0') * 100);
    if (!customerName.trim()) return setError('Customer name is required.');
    if (!customerEmail.trim()) return setError('Customer email is required (used to send the waiver link).');
    if (trailType === 'mtb' && !skillLevel) return setError('Pick a skill level for the MTB tour.');
    if (!locationId) return setError('Pick a location.');
    if (!date) return setError('Pick a date.');
    if (!timeSlot) return setError('Pick a time.');
    if (!Number.isFinite(amountCents) || amountCents < 0) return setError('Enter a valid amount collected.');

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/manual-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customerName.trim(),
          customer_email: customerEmail.trim(),
          customer_phone: customerPhone.trim() || undefined,
          trail_type: trailType,
          skill_level: trailType === 'mtb' ? skillLevel : null,
          location_id: locationId,
          date,
          time_slot: timeSlot,
          duration_hours: durationHours,
          bike_rental: bikeRental,
          additional_participants: additional.map((name) => ({ name: name.trim() })).filter((p) => p.name),
          amount_collected_cents: amountCents,
          payment_method: paymentMethod,
          admin_notes: adminNotes.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to create booking');

      setCreatedLink(data.waiver_url ?? null);
      resetForm();
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async (id: string) => {
    setError(null);
    try {
      const res = await fetch('/api/admin/manual-booking', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'resend' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to resend');
      setCopied(`resent-${id}`);
      window.setTimeout(() => setCopied((c) => (c === `resent-${id}` ? null : c)), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend email');
    }
  };

  const inputCls =
    'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground';

  return (
    <div className="space-y-6">
      {/* ── Created-link banner ── */}
      {createdLink && (
        <div className="rounded-2xl border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/20">
          <p className="text-sm font-semibold text-green-800 dark:text-green-300">
            ✓ Booking created. Confirmation email sent with the waiver link.
          </p>
          <p className="mt-1 text-xs text-green-700/90 dark:text-green-400/90">
            Hand this link to the customer in person (kiosk) or share it directly — it’s the same link.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <code className="flex-1 truncate rounded-md border border-green-300/70 bg-white/70 px-3 py-2 text-xs text-green-900 dark:bg-black/20 dark:text-green-200">
              {createdLink}
            </code>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => copy(createdLink, 'created')} className="bg-green-600 hover:bg-green-700 text-white">
                {copied === 'created' ? 'Copied!' : 'Copy link'}
              </Button>
              <a
                href={createdLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-md border border-green-400 px-3 py-1.5 text-sm font-medium text-green-800 hover:bg-green-100 dark:text-green-300 dark:hover:bg-green-900/30"
              >
                Open kiosk
              </a>
              <button
                type="button"
                onClick={() => setCreatedLink(null)}
                className="rounded-md px-2 text-sm text-green-700/70 hover:text-green-900 dark:text-green-400/70"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create form ── */}
      <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold text-foreground">New cash / off-platform booking</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Records the tour, books the calendar, logs the cash in Fin Log, and generates a waiver link — no payment is charged.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}

        {/* Customer */}
        <fieldset className="mt-5 space-y-3">
          <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Name *</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Full name" />
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Email *</Label>
              <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="name@email.com" />
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Phone</Label>
              <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="(optional)" />
            </div>
          </div>
        </fieldset>

        {/* Tour */}
        <fieldset className="mt-5 space-y-3">
          <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tour</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Trail type *</Label>
              <select value={trailType} onChange={(e) => setTrailType(e.target.value as TrailType)} className={inputCls}>
                <option value="mtb">Mountain Bike</option>
                <option value="paved">Paved Trail</option>
              </select>
            </div>
            {trailType === 'mtb' && (
              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">Skill level *</Label>
                <select value={skillLevel} onChange={(e) => setSkillLevel(e.target.value as SkillLevel | '')} className={inputCls}>
                  <option value="">Select…</option>
                  {(['first_time', 'beginner', 'intermediate', 'advanced'] as SkillLevel[]).map((s) => (
                    <option key={s} value={s}>{SKILL_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            )}
            <div className={trailType === 'mtb' ? 'sm:col-span-2' : ''}>
              <Label className="mb-1 block text-xs text-muted-foreground">Location *</Label>
              <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={inputCls}>
                <option value="">{filteredLocations.length ? 'Select a location…' : 'No locations for this selection'}</option>
                {filteredLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Date *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">Time *</Label>
                <Input type="time" value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">Hours</Label>
                <Input
                  type="number"
                  min={1}
                  max={8}
                  value={durationHours}
                  onChange={(e) => setDurationHours(Math.max(1, Math.min(8, Number(e.target.value) || 1)))}
                />
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Bike rental</Label>
              <select value={bikeRental} onChange={(e) => setBikeRental(e.target.value as typeof bikeRental)} className={inputCls}>
                <option value="none">None (own bike)</option>
                <option value="standard">Standard rental</option>
                <option value="electric">Electric rental</option>
              </select>
            </div>
          </div>
        </fieldset>

        {/* Participants */}
        <fieldset className="mt-5 space-y-3">
          <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Additional participants
          </legend>
          <p className="text-xs text-muted-foreground">
            The customer above is participant 1. Add other riders by name — minors / guardians are handled when they sign the waiver.
          </p>
          {additional.map((name, idx) => (
            <div key={idx} className="flex gap-2">
              <Input
                value={name}
                onChange={(e) => setAdditional((prev) => prev.map((n, i) => (i === idx ? e.target.value : n)))}
                placeholder={`Rider ${idx + 2} name`}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => setAdditional((prev) => prev.filter((_, i) => i !== idx))}>
                Remove
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setAdditional((prev) => [...prev, ''])} className="border-border">
            + Add participant
          </Button>
        </fieldset>

        {/* Payment */}
        <fieldset className="mt-5 space-y-3">
          <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment (cash collected)</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Amount collected ($) *</Label>
              <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Method</Label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)} className={inputCls}>
                <option value="cash">Cash</option>
                <option value="zelle">Zelle</option>
                <option value="venmo">Venmo</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Notes (internal)</Label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={2}
              placeholder="Anything to remember about this deal…"
              className={inputCls}
            />
          </div>
        </fieldset>

        <Button type="submit" disabled={submitting} className="mt-6 w-full bg-green-600 hover:bg-green-700 text-white" size="lg">
          {submitting ? 'Creating…' : 'Create booking & generate waiver link'}
        </Button>
      </form>

      {/* ── Bookings list ── */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold text-foreground">Manual bookings</h2>
        {bookings.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No manual bookings yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {bookings.map((b) => {
              const waiverUrl = origin && b.waiver_link_token ? `${origin}/waiver/${b.waiver_link_token}` : null;
              const signed = Boolean(b.waiver_accepted);
              return (
                <div key={b.id} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {b.customers?.name ?? 'Unknown'}{' '}
                        <span className="font-normal text-muted-foreground">· {b.customers?.email ?? 'no email'}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {b.date} at {b.time_slot} · {b.locations?.name ?? '—'} ·{' '}
                        {b.trail_type === 'mtb' ? 'MTB' : 'Paved'}
                        {b.skill_level ? ` (${SKILL_LABELS[b.skill_level]})` : ''} ·{' '}
                        {fmtMoney(b.deposit_paid_cents)} {b.payment_method ?? 'cash'}
                      </p>
                    </div>
                    <span
                      className={[
                        'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
                        signed
                          ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
                      ].join(' ')}
                    >
                      {signed ? 'Waiver signed' : 'Waiver pending'}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {waiverUrl && (
                      <>
                        <Button size="sm" variant="outline" className="border-border" onClick={() => copy(waiverUrl, `link-${b.id}`)}>
                          {copied === `link-${b.id}` ? 'Copied!' : 'Copy link'}
                        </Button>
                        <a
                          href={waiverUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
                        >
                          Open kiosk
                        </a>
                      </>
                    )}
                    {!signed && b.customers?.email && (
                      <Button size="sm" variant="outline" className="border-border" onClick={() => handleResend(b.id)}>
                        {copied === `resent-${b.id}` ? 'Email sent!' : 'Resend email'}
                      </Button>
                    )}
                    {signed && b.waiver_accepted_at && (
                      <span className="text-xs text-muted-foreground">Signed {new Date(b.waiver_accepted_at).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

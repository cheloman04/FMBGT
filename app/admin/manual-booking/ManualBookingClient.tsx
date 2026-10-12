'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isLocationComingSoon } from '@/lib/location-status';
import { SANFORD_DEPARTURE_TIME, isSanfordLocation } from '@/lib/sanford';

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
  remaining_balance_amount: number | null;
  remaining_balance_status: string | null;
  waiver_accepted: boolean | null;
  waiver_accepted_at: string | null;
  waiver_link_token: string | null;
  admin_notes: string | null;
  bike_rental: string | null;
  participant_count: number | null;
  participant_info: Array<{ name?: string }> | null;
  cal_booking_status: string | null;
  webhook_sent: boolean | null;
  customers: { name?: string; email?: string; phone?: string } | null;
  locations: { name?: string } | null;
}

interface Props {
  initialLocations: LocationRow[];
  initialBookings: BookingRow[];
}

type PaymentMethod = 'cash' | 'zelle' | 'venmo' | 'other';

const SKILL_LABELS: Record<SkillLevel, string> = {
  first_time: 'First Time',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

function fmtMoney(cents: number | null | undefined): string {
  return `$${((cents ?? 0) / 100).toFixed(2)}`;
}

/** "12.50" → 1250; blank → 0; invalid → NaN. */
function toCents(value: string): number {
  return Math.round(parseFloat(value || '0') * 100);
}

const INPUT_CLS = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground';

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
  const [total, setTotal] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [adminNotes, setAdminNotes] = useState('');
  const [sendConfirmation, setSendConfirmation] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [createdStatus, setCreatedStatus] = useState<{ emailSent: boolean; calBooked: boolean } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // ── Per-booking panels (edit / record payment) + result notices ─────────────
  const [openPanel, setOpenPanel] = useState<{ id: string; kind: 'edit' | 'payment' } | null>(null);
  const [notices, setNotices] = useState<Record<string, string>>({});
  const [retryingCal, setRetryingCal] = useState<string | null>(null);

  const totalCents = toCents(total);
  const collectedCents = toCents(amount);
  const balanceCents = totalCents - collectedCents;

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
    setTotal('');
    setAmount('');
    setPaymentMethod('cash');
    setAdminNotes('');
    setSendConfirmation(true);
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

    if (!customerName.trim()) return setError('Customer name is required.');
    if (!customerEmail.trim()) return setError('Customer email is required (used to send the waiver link).');
    if (trailType === 'mtb' && !skillLevel) return setError('Pick a skill level for the MTB tour.');
    if (!locationId) return setError('Pick a location.');
    if (!date) return setError('Pick a date.');
    if (!timeSlot) return setError('Pick a time.');
    if (!total.trim() || !Number.isFinite(totalCents) || totalCents < 0) return setError('Enter the tour total.');
    if (!Number.isFinite(collectedCents) || collectedCents < 0) return setError('Enter a valid amount collected.');
    if (collectedCents > totalCents) return setError('Amount collected cannot be more than the total.');

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
          total_cents: totalCents,
          amount_collected_cents: collectedCents,
          payment_method: paymentMethod,
          admin_notes: adminNotes.trim() || undefined,
          send_confirmation: sendConfirmation,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to create booking');

      setCreatedLink(data.waiver_url ?? null);
      setCreatedStatus({ emailSent: Boolean(data.email_queued), calBooked: Boolean(data.cal_booked) });
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
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, webhook_sent: true } : b)));
    } catch (err) {
      setNotices((prev) => ({ ...prev, [id]: err instanceof Error ? err.message : 'Failed to resend email' }));
    }
  };

  const handleRetryCal = async (id: string) => {
    setRetryingCal(id);
    try {
      const res = await fetch('/api/admin/retry-cal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: id }),
      });
      const data = await res.json().catch(() => ({}));
      setNotices((prev) => ({
        ...prev,
        [id]: res.ok ? 'Calendar event created — the slot is now blocked.' : `Calendar: ${data.error ?? 'failed'}`,
      }));
      await refreshList();
    } finally {
      setRetryingCal(null);
    }
  };

  const handlePanelDone = async (id: string, notice: string) => {
    setOpenPanel(null);
    setNotices((prev) => ({ ...prev, [id]: notice }));
    await refreshList();
  };

  const inputCls = INPUT_CLS;

  return (
    <div className="space-y-6">
      {/* ── Created-link banner ── */}
      {createdLink && (
        <div className="rounded-2xl border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/20">
          <p className="text-sm font-semibold text-green-800 dark:text-green-300">
            ✓ Booking created.{' '}
            {createdStatus?.emailSent
              ? 'Confirmation email sent with the waiver link.'
              : 'No email sent yet — use “Send email” on the booking when you’re ready.'}
          </p>
          {createdStatus && !createdStatus.calBooked && (
            <p className="mt-1 text-sm font-semibold text-orange-700 dark:text-orange-300">
              ⚠ The calendar event could not be created — use “Retry calendar” on the booking below.
            </p>
          )}
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
                onClick={() => { setCreatedLink(null); setCreatedStatus(null); }}
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
              <select
                value={locationId}
                onChange={(e) => {
                  setLocationId(e.target.value);
                  // Sanford's shared departure leaves at 10:00 — groups join that tour.
                  const picked = filteredLocations.find((loc) => loc.id === e.target.value);
                  if (isSanfordLocation(picked?.name)) setTimeSlot(SANFORD_DEPARTURE_TIME);
                }}
                className={inputCls}
              >
                <option value="">{filteredLocations.length ? 'Select a location…' : 'No locations for this selection'}</option>
                {filteredLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                    {isLocationComingSoon(loc.name) ? ' (coming soon — not bookable online)' : ''}
                  </option>
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
          <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment (off-platform)</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Tour total ($) *</Label>
              <Input type="number" min={0} step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Collected now ($)</Label>
              <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Method</Label>
              <PaymentMethodSelect value={paymentMethod} onChange={setPaymentMethod} />
            </div>
          </div>
          {total.trim() !== '' && Number.isFinite(balanceCents) && balanceCents > 0 && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              {collectedCents > 0 ? `${fmtMoney(collectedCents)} collected now. ` : 'Nothing collected yet — this just holds the date. '}
              The booking will show <strong>Payment pending</strong> ({fmtMoney(balanceCents)} due) until you use “Record payment”.
            </p>
          )}
          {total.trim() !== '' && totalCents === 0 && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              The tour total is $0 — the confirmation email will show $0. Enter the agreed price if there is one.
            </p>
          )}
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

        <label className="mt-5 flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={sendConfirmation}
            onChange={(e) => setSendConfirmation(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            Email the confirmation + waiver link to the customer now
            <span className="block text-xs text-muted-foreground">
              Uncheck to just hold the date — you can send it later with “Send email”.
            </span>
          </span>
        </label>

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
              // Not accepted but signed before = riders changed after signing.
              const waiverNeedsUpdate = !signed && Boolean(b.waiver_accepted_at);
              const active = b.status === 'confirmed' || b.status === 'completed';
              const balanceDue = b.remaining_balance_status === 'pending' ? b.remaining_balance_amount ?? 0 : 0;
              const noCalendar = b.status === 'confirmed' && b.cal_booking_status !== 'created';
              const riders = (b.participant_info ?? []).map((p) => p.name).filter(Boolean);
              const panel = openPanel?.id === b.id ? openPanel.kind : null;
              return (
                <div key={b.id} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {b.customers?.name ?? 'Unknown'}{' '}
                        <span className="font-normal text-muted-foreground">· {b.customers?.email ?? 'no email'}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {b.date} at {b.time_slot}
                        {b.duration_hours ? ` (${b.duration_hours}h)` : ''} · {b.locations?.name ?? '—'} ·{' '}
                        {b.trail_type === 'mtb' ? 'MTB' : 'Paved'}
                        {b.skill_level ? ` (${SKILL_LABELS[b.skill_level]})` : ''} ·{' '}
                        {fmtMoney(b.deposit_paid_cents)} of {fmtMoney(b.total_price)} paid · {b.payment_method ?? 'cash'}
                      </p>
                      {riders.length > 0 && (
                        <p className="mt-0.5 text-xs text-muted-foreground">Other riders: {riders.join(', ')}</p>
                      )}
                      {b.status !== 'confirmed' && (
                        <p className="mt-0.5 text-xs font-semibold capitalize text-muted-foreground">{b.status}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      {balanceDue > 0 && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                          Payment pending · {fmtMoney(balanceDue)}
                        </span>
                      )}
                      {noCalendar && (
                        <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
                          No Cal event
                        </span>
                      )}
                      {active && b.webhook_sent === false && (
                        <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
                          Email not sent
                        </span>
                      )}
                      <span
                        className={[
                          'rounded-full px-2.5 py-1 text-xs font-semibold',
                          signed
                            ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
                        ].join(' ')}
                      >
                        {signed ? 'Waiver signed' : waiverNeedsUpdate ? 'Waiver needs update' : 'Waiver pending'}
                      </span>
                    </div>
                  </div>

                  {notices[b.id] && (
                    <div className="mt-3 flex items-start justify-between gap-2 rounded-md bg-muted px-3 py-2 text-xs text-foreground">
                      <span>{notices[b.id]}</span>
                      <button
                        type="button"
                        onClick={() => setNotices((prev) => ({ ...prev, [b.id]: '' }))}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Dismiss"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {active && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-border"
                        onClick={() => setOpenPanel(panel === 'edit' ? null : { id: b.id, kind: 'edit' })}
                      >
                        {panel === 'edit' ? 'Close edit' : 'Edit'}
                      </Button>
                    )}
                    {active && balanceDue > 0 && (
                      <Button
                        size="sm"
                        className="bg-green-600 text-white hover:bg-green-700"
                        onClick={() => setOpenPanel(panel === 'payment' ? null : { id: b.id, kind: 'payment' })}
                      >
                        Record payment
                      </Button>
                    )}
                    {noCalendar && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-orange-400 text-orange-700 dark:text-orange-300"
                        disabled={retryingCal === b.id}
                        onClick={() => handleRetryCal(b.id)}
                      >
                        {retryingCal === b.id ? 'Retrying…' : 'Retry calendar'}
                      </Button>
                    )}
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
                    {active && b.customers?.email && (!signed || b.webhook_sent === false) && (
                      <Button size="sm" variant="outline" className="border-border" onClick={() => handleResend(b.id)}>
                        {copied === `resent-${b.id}` ? 'Email sent!' : b.webhook_sent === false ? 'Send email' : 'Resend email'}
                      </Button>
                    )}
                    {signed && b.waiver_accepted_at && (
                      <span className="text-xs text-muted-foreground">Signed {new Date(b.waiver_accepted_at).toLocaleString()}</span>
                    )}
                  </div>

                  {panel === 'edit' && (
                    <EditBookingPanel booking={b} onCancel={() => setOpenPanel(null)} onDone={(n) => handlePanelDone(b.id, n)} />
                  )}
                  {panel === 'payment' && (
                    <RecordPaymentPanel
                      booking={b}
                      balanceDue={balanceDue}
                      onCancel={() => setOpenPanel(null)}
                      onDone={(n) => handlePanelDone(b.id, n)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared bits ──────────────────────────────────────────────────────────────────

const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'zelle', 'venmo', 'other'];

function asPaymentMethod(value: string | null): PaymentMethod {
  return PAYMENT_METHODS.includes(value as PaymentMethod) ? (value as PaymentMethod) : 'cash';
}

function PaymentMethodSelect({ value, onChange }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as PaymentMethod)} className={INPUT_CLS}>
      <option value="cash">Cash</option>
      <option value="zelle">Zelle</option>
      <option value="venmo">Venmo</option>
      <option value="other">Other</option>
    </select>
  );
}

type PanelProps = { booking: BookingRow; onCancel: () => void; onDone: (notice: string) => void };

// ─── Edit panel ──────────────────────────────────────────────────────────────────

function EditBookingPanel({ booking, onCancel, onDone }: PanelProps) {
  const [name, setName] = useState(booking.customers?.name ?? '');
  const [email, setEmail] = useState(booking.customers?.email ?? '');
  const [phone, setPhone] = useState(booking.customers?.phone ?? '');
  const [date, setDate] = useState(booking.date);
  const [time, setTime] = useState(booking.time_slot);
  const [hours, setHours] = useState(booking.duration_hours ?? 2);
  const [riders, setRiders] = useState<string[]>((booking.participant_info ?? []).map((p) => p.name ?? ''));
  const [total, setTotal] = useState(((booking.total_price ?? 0) / 100).toFixed(2));
  const [method, setMethod] = useState<PaymentMethod>(asPaymentMethod(booking.payment_method));
  const [notes, setNotes] = useState(booking.admin_notes ?? '');
  const [notify, setNotify] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const collected = booking.deposit_paid_cents ?? 0;

  const save = async () => {
    setError(null);
    const totalCents = toCents(total);
    if (!name.trim()) return setError('Customer name is required.');
    if (!email.trim()) return setError('Customer email is required.');
    if (!date || !time) return setError('Date and time are required.');
    if (!Number.isFinite(totalCents) || totalCents < 0) return setError('Enter a valid total.');
    if (totalCents < collected) {
      return setError(`The total can't be less than what has already been collected (${fmtMoney(collected)}).`);
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/manual-booking', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          id: booking.id,
          customer_name: name.trim(),
          customer_email: email.trim(),
          customer_phone: phone.trim() || null,
          date,
          time_slot: time,
          duration_hours: hours,
          additional_participants: riders.map((n) => ({ name: n.trim() })).filter((p) => p.name),
          total_cents: totalCents,
          payment_method: method,
          admin_notes: notes.trim() || null,
          notify_customer: notify,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to save changes');

      const parts = [data.changed?.length ? 'Changes saved.' : 'No changes to save.'];
      if (data.calendar_ok === true) parts.push('Calendar updated.');
      if (data.calendar_ok === false) {
        parts.push(`⚠ Calendar NOT updated (${data.calendar_error ?? 'unknown error'}) — use “Retry calendar”.`);
      }
      if (data.waiver_reset) parts.push('New riders need to sign — the waiver link is open again.');
      if (data.email_sent === true) parts.push('Updated details emailed to the customer.');
      if (data.email_sent === false) parts.push(`⚠ Email not sent (${data.email_error ?? 'unknown error'}).`);
      onDone(parts.join(' '));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 space-y-4 rounded-lg border border-border bg-card p-4">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">Contact changes apply to every booking of this customer.</p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date &amp; time</p>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="col-span-2 sm:col-span-1" />
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          <Input
            type="number"
            min={1}
            max={8}
            value={hours}
            onChange={(e) => setHours(Math.max(1, Math.min(8, Number(e.target.value) || 1)))}
            aria-label="Hours"
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">Changing these moves the event on your calendar.</p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Other riders</p>
        <div className="mt-2 space-y-2">
          {riders.map((rider, idx) => (
            <div key={idx} className="flex gap-2">
              <Input
                value={rider}
                onChange={(e) => setRiders((prev) => prev.map((n, i) => (i === idx ? e.target.value : n)))}
                placeholder={`Rider ${idx + 2} name`}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => setRiders((prev) => prev.filter((_, i) => i !== idx))}>
                Remove
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="border-border" onClick={() => setRiders((prev) => [...prev, ''])}>
            + Add rider
          </Button>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Price</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Tour total ($)</Label>
            <Input type="number" min={0} step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Method</Label>
            <PaymentMethodSelect value={method} onChange={setMethod} />
          </div>
          <div className="text-xs text-muted-foreground sm:pt-6">
            Collected so far: {fmtMoney(collected)}. Add payments with “Record payment”.
          </div>
        </div>
      </div>

      <div>
        <Label className="mb-1 block text-xs text-muted-foreground">Notes (internal)</Label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={INPUT_CLS} />
      </div>

      <label className="flex items-start gap-2 text-sm text-foreground">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="mt-0.5 h-4 w-4" />
        <span>Email the updated details to the customer</span>
      </label>

      <div className="flex gap-2">
        <Button onClick={save} disabled={saving} className="bg-green-600 text-white hover:bg-green-700">
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        <Button variant="outline" className="border-border" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── Record payment panel ────────────────────────────────────────────────────────

function RecordPaymentPanel({ booking, balanceDue, onCancel, onDone }: PanelProps & { balanceDue: number }) {
  const [amount, setAmount] = useState((balanceDue / 100).toFixed(2));
  const [method, setMethod] = useState<PaymentMethod>(asPaymentMethod(booking.payment_method));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    const cents = toCents(amount);
    if (!Number.isFinite(cents) || cents <= 0) return setError('Enter the amount received.');
    if (cents > balanceDue) {
      return setError(`That's more than the balance due (${fmtMoney(balanceDue)}). Use Edit to change the tour total first.`);
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/manual-booking', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'record_payment', id: booking.id, amount_cents: cents, payment_method: method }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to record payment');
      const remaining = Number(data.remaining_cents ?? 0);
      onDone(
        `Payment of ${fmtMoney(cents)} (${method}) recorded.` +
          (remaining > 0 ? ` ${fmtMoney(remaining)} still due.` : ' Paid in full.')
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-border bg-card p-4">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}
      <p className="text-sm text-foreground">
        Balance due: <strong>{fmtMoney(balanceDue)}</strong>
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label className="mb-1 block text-xs text-muted-foreground">Amount received ($)</Label>
          <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <Label className="mb-1 block text-xs text-muted-foreground">Method</Label>
          <PaymentMethodSelect value={method} onChange={setMethod} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={save} disabled={saving} className="bg-green-600 text-white hover:bg-green-700">
          {saving ? 'Saving…' : 'Record payment'}
        </Button>
        <Button variant="outline" className="border-border" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

'use client';

// One booking, online or manual: everything about it, an Edit form with a
// preview of what saving will do (price, balance charge, calendar, waiver), the
// money actions an edit may call for, and its history from Fin Log.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  bookingTotalCents,
  formatUsd,
  netCollectedCents,
  scheduledChargeCents,
  unsettledCents,
} from '@/lib/booking-money';
import { formatFloridaCalendarDate, formatFloridaDateTime, formatTourTime } from '@/lib/display-time';
import type { BikeRental, SkillLevel, TrailType } from '@/types/booking';

// ─── Types (filled by page.tsx) ─────────────────────────────────────────────────

export type DetailRider = { name?: string; bike_rental?: BikeRental; height_inches?: number | null };

export type DetailBooking = {
  id: string;
  status: string;
  booking_source: 'online' | 'manual';
  created_at: string;
  trail_type: TrailType;
  skill_level: SkillLevel | null;
  date: string;
  time_slot: string;
  duration_hours: number;
  location_id: string | null;
  location_name: string;
  bike_rental: BikeRental;
  rider_height_inches: number | null;
  addons: { gopro?: boolean; pickup_dropoff?: boolean; electric_upgrade?: boolean } | null;
  participant_count: number | null;
  participant_info: DetailRider[] | null;
  total_price: number | null;
  total_after_discount_cents: number | null;
  discount_code: string | null;
  discount_label: string | null;
  discount_percentage: number | null;
  discount_amount_cents: number | null;
  gift_card_id: string | null;
  deposit_paid_cents: number | null;
  deposit_payment_status: string | null;
  remaining_balance_amount: number | null;
  remaining_balance_status: string | null;
  remaining_balance_due_at: string | null;
  remaining_balance_payment_intent_id: string | null;
  stripe_payment_method_id: string | null;
  extra_paid_cents: number | null;
  refunded_cents: number | null;
  payment_method: string | null;
  waiver_accepted: boolean | null;
  waiver_link_token: string | null;
  cal_booking_status: string | null;
  webhook_sent: boolean | null;
  admin_notes: string | null;
  customer: { name?: string; email?: string; phone?: string | null };
};

export type DetailWaiver = {
  id: string;
  signer_name: string;
  signer_role: string;
  participants_covered: string[] | null;
  agreed_at: string;
  pdf_url: string | null;
};

export type DetailHistoryEntry = {
  id: string;
  event_name: string;
  message: string | null;
  amount: number | null;
  severity: string | null;
  occurred_at: string;
};

export type DetailLocation = { id: string; name: string; tour_type: TrailType; skill_levels: SkillLevel[] | null };

type Props = {
  booking: DetailBooking;
  waivers: DetailWaiver[];
  history: DetailHistoryEntry[];
  locations: DetailLocation[];
  appUrl: string;
};

type EditPreview = {
  changes: Array<{ field: string; label: string; from: string | null; to: string | null }>;
  price: { from: number; to: number; quoted: number; overridden: boolean } | null;
  balance: { scheduled_from: number; scheduled_to: number; due_at: string | null; unsettled: number };
  calendar: 'reschedule' | 'recreate' | null;
  waiver_needs: string[];
  warnings: string[];
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

const INPUT_CLS = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground';
const CARD_CLS = 'rounded-2xl border border-border/70 bg-card/80 p-4';
const CARD_TITLE_CLS = 'mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground';

const HEIGHT_OPTIONS = [
  { label: 'Under 5\'0"', value: 59 },
  { label: '5\'0"–5\'3"', value: 62 },
  { label: '5\'4"–5\'7"', value: 66 },
  { label: '5\'8"–5\'11"', value: 70 },
  { label: '6\'0"–6\'3"', value: 74 },
  { label: 'Over 6\'3"', value: 76 },
];

const SKILL_LABELS: Record<SkillLevel, string> = {
  first_time: 'First time',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  cancelled: 'bg-muted text-muted-foreground',
  refunded: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

function bikeLabel(bike: BikeRental | undefined): string {
  if (bike === 'electric') return 'E-bike';
  if (bike === 'standard') return 'Rental bike';
  return 'Own bike (BYOB)';
}

function heightLabel(height: number | null | undefined): string {
  if (!height) return 'height missing';
  return HEIGHT_OPTIONS.find((h) => h.value === height)?.label ?? `${height}"`;
}

function toCents(dollars: string): number | null {
  if (dollars.trim() === '') return null;
  const value = Number(dollars);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
}

const fmtDate = (date: string) =>
  formatFloridaCalendarDate(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

function newRequestId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`;
}

async function sendJson(url: string, method: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    window.location.href = '/admin/login';
    return { ok: false, data: { error: 'Your session expired — sign in again.' } };
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, data };
}

// ─── Edit form state ────────────────────────────────────────────────────────────

type RiderForm = { name: string; bike_rental: BikeRental; height_inches: number | null };

type FormState = {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  location_id: string;
  skill_level: SkillLevel | '';
  date: string;
  time_slot: string;
  duration_hours: number;
  bike_rental: BikeRental;
  rider_height_inches: number | null;
  riders: RiderForm[];
  gopro: boolean;
  pickup_dropoff: boolean;
  admin_notes: string;
  custom_price: boolean;
  price_override: string;
  price_override_reason: string;
  manual_total: string;
  manual_payment_method: string;
  notify_customer: boolean;
};

function initialForm(b: DetailBooking): FormState {
  const isPaved = b.trail_type === 'paved';
  return {
    customer_name: b.customer.name ?? '',
    customer_email: b.customer.email ?? '',
    customer_phone: b.customer.phone ?? '',
    location_id: b.location_id ?? '',
    skill_level: b.skill_level ?? '',
    date: b.date,
    time_slot: b.time_slot,
    duration_hours: b.duration_hours,
    bike_rental: b.bike_rental,
    rider_height_inches: b.rider_height_inches,
    riders: (b.participant_info ?? []).map((r) => ({
      name: r.name ?? '',
      // Manual bookings used to store names only: those riders ride the lead's bike.
      bike_rental: r.bike_rental ?? (isPaved ? 'standard' : b.bike_rental),
      height_inches: r.height_inches ?? null,
    })),
    gopro: Boolean(b.addons?.gopro),
    pickup_dropoff: Boolean(b.addons?.pickup_dropoff),
    admin_notes: b.admin_notes ?? '',
    custom_price: false,
    price_override: '',
    price_override_reason: '',
    manual_total: ((b.total_price ?? 0) / 100).toFixed(2),
    manual_payment_method: b.payment_method ?? 'cash',
    notify_customer: false,
  };
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function BookingDetailClient({ booking, waivers, history, locations, appUrl }: Props) {
  const router = useRouter();
  const isManual = booking.booking_source === 'manual';
  const isPaved = booking.trail_type === 'paved';
  const editable = booking.status === 'confirmed';

  const total = bookingTotalCents(booking);
  const collected = netCollectedCents(booking);
  const scheduled = scheduledChargeCents(booking);
  const unsettled = unsettledCents(booking);
  const riders: DetailRider[] = [
    { name: booking.customer.name, bike_rental: booking.bike_rental, height_inches: booking.rider_height_inches },
    ...(booking.participant_info ?? []).map((r) => ({ ...r, bike_rental: r.bike_rental ?? booking.bike_rental })),
  ];
  const waiverUrl = booking.waiver_link_token ? `${appUrl}/waiver/${booking.waiver_link_token}` : null;

  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const retryCalendar = async () => {
    setBusy('calendar');
    const { ok, data } = await sendJson('/api/admin/retry-cal', 'POST', { booking_id: booking.id });
    setBusy(null);
    setNotice(ok ? { tone: 'ok', text: 'Calendar event created.' } : { tone: 'error', text: String(data.error ?? 'Retry failed') });
    router.refresh();
  };

  const resendEmail = async () => {
    setBusy('email');
    const { ok, data } = await sendJson(`/api/admin/retrigger-webhook/${booking.id}`, 'POST', {});
    setBusy(null);
    setNotice(ok ? { tone: 'ok', text: 'Confirmation email sent.' } : { tone: 'error', text: String(data.error ?? 'Failed to send') });
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          ← Back to dashboard
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {isManual ? `Manual · ${booking.payment_method ?? 'cash'}` : 'Online · Stripe'}
          </span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_COLORS[booking.status] ?? 'bg-muted text-muted-foreground'}`}>
            {booking.status}
          </span>
          {editable && !editing && (
            <Button size="sm" className="bg-green-600 text-white hover:bg-green-700" onClick={() => { setEditing(true); setNotice(null); }}>
              Edit booking
            </Button>
          )}
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            notice.tone === 'ok'
              ? 'border-green-500/40 bg-green-500/10 text-green-800 dark:text-green-300'
              : notice.tone === 'warn'
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300'
                : 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
          }`}
        >
          {notice.text}
        </div>
      )}

      {editing && (
        <EditPanel
          booking={booking}
          locations={locations}
          onCancel={() => setEditing(false)}
          onSaved={(text, tone) => {
            setEditing(false);
            setNotice({ tone, text });
            router.refresh();
          }}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className={CARD_CLS}>
          <h2 className={CARD_TITLE_CLS}>Tour</h2>
          <p className="font-semibold text-foreground">{booking.location_name}</p>
          <p className="mt-1 text-sm text-foreground">
            {fmtDate(booking.date)} · {formatTourTime(booking.time_slot, { withZone: true })}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isPaved ? 'Paved' : 'Mountain bike'} · {booking.duration_hours} h
            {booking.skill_level ? ` · ${SKILL_LABELS[booking.skill_level]}` : ''}
          </p>
          {(booking.addons?.gopro || booking.addons?.pickup_dropoff) && (
            <p className="mt-1 text-sm text-muted-foreground">
              Add-ons: {[booking.addons?.gopro && 'GoPro', booking.addons?.pickup_dropoff && 'Pickup + dropoff'].filter(Boolean).join(', ')}
            </p>
          )}
        </section>

        <section className={CARD_CLS}>
          <h2 className={CARD_TITLE_CLS}>Customer</h2>
          <p className="font-semibold text-foreground">{booking.customer.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{booking.customer.email}</p>
          {booking.customer.phone && <p className="text-sm text-muted-foreground">{booking.customer.phone}</p>}
          {booking.admin_notes && (
            <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-sm text-foreground">{booking.admin_notes}</p>
          )}
        </section>

        <section className={CARD_CLS}>
          <h2 className={CARD_TITLE_CLS}>Riders ({riders.length})</h2>
          <ul className="space-y-1.5 text-sm">
            {riders.map((rider, index) => (
              <li key={index} className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium text-foreground">{rider.name || `Rider ${index + 1}`}</span>
                {index === 0 && <span className="text-xs text-muted-foreground">(lead)</span>}
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{bikeLabel(rider.bike_rental)}</span>
                {rider.bike_rental !== 'none' && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs ${
                      rider.height_inches ? 'bg-muted text-muted-foreground' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                    }`}
                  >
                    {heightLabel(rider.height_inches)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className={CARD_CLS}>
          <h2 className={CARD_TITLE_CLS}>Payment</h2>
          <dl className="space-y-1.5 text-sm">
            <Row label="Total" value={formatUsd(total)} strong />
            {booking.discount_code && (
              <Row
                label={booking.discount_label ?? booking.discount_code}
                value={`−${formatUsd(booking.discount_amount_cents ?? 0)}`}
                muted
              />
            )}
            <Row label="Collected" value={formatUsd(collected)} />
            {(booking.refunded_cents ?? 0) > 0 && <Row label="…of which refunded" value={formatUsd(booking.refunded_cents ?? 0)} muted />}
            {scheduled > 0 && (
              <Row
                label={
                  booking.remaining_balance_status === 'failed'
                    ? 'Balance charge FAILED'
                    : `Card charge ${booking.remaining_balance_due_at ? formatFloridaCalendarDate(booking.remaining_balance_due_at.slice(0, 10)) : ''}`
                }
                value={formatUsd(scheduled)}
              />
            )}
            {unsettled > 0 && <Row label="Still owed (not scheduled)" value={formatUsd(unsettled)} warn />}
            {unsettled < 0 && <Row label="Refund owed" value={formatUsd(-unsettled)} warn />}
            {unsettled === 0 && scheduled === 0 && <Row label="Balance" value="Paid in full" />}
          </dl>
          {(booking.status === 'confirmed' || booking.status === 'completed') && (
            <MoneyActions booking={booking} unsettled={unsettled} collected={collected} onDone={(text, tone) => { setNotice({ text, tone }); router.refresh(); }} />
          )}
        </section>

        <section className={CARD_CLS}>
          <h2 className={CARD_TITLE_CLS}>Waiver</h2>
          {waivers.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {waivers.map((w) => (
                <li key={w.id} className="text-foreground">
                  {w.signer_name} <span className="text-muted-foreground">({w.signer_role})</span> —{' '}
                  {(w.participants_covered ?? []).join(', ')}
                  {w.pdf_url && (
                    <a href={w.pdf_url} target="_blank" rel="noopener noreferrer" className="ml-1 text-xs font-medium text-green-600 hover:underline">
                      PDF
                    </a>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No signatures yet.</p>
          )}
          <p className={`mt-2 text-sm font-medium ${booking.waiver_accepted ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-300'}`}>
            {booking.waiver_accepted ? 'Every rider is covered' : 'Signature needed'}
          </p>
          {waiverUrl && !booking.waiver_accepted && (
            <button
              type="button"
              onClick={() => { void navigator.clipboard.writeText(waiverUrl); setNotice({ tone: 'ok', text: 'Waiver link copied.' }); }}
              className="mt-2 text-xs font-semibold text-green-600 hover:underline"
            >
              Copy waiver link
            </button>
          )}
        </section>

        <section className={CARD_CLS}>
          <h2 className={CARD_TITLE_CLS}>Calendar &amp; email</h2>
          <p className="text-sm text-foreground">
            Cal.com event:{' '}
            <span className={booking.cal_booking_status === 'created' ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-300'}>
              {booking.cal_booking_status ?? 'none'}
            </span>
          </p>
          {booking.status === 'confirmed' && booking.cal_booking_status !== 'created' && (
            <button type="button" onClick={retryCalendar} disabled={busy === 'calendar'} className="mt-1 text-xs font-semibold text-orange-600 hover:underline disabled:opacity-50">
              {busy === 'calendar' ? 'Retrying…' : 'Retry calendar'}
            </button>
          )}
          <p className="mt-2 text-sm text-foreground">
            Confirmation email: {booking.webhook_sent ? 'sent' : <span className="text-amber-700 dark:text-amber-300">not sent</span>}
          </p>
          {booking.status === 'confirmed' && (
            <button type="button" onClick={resendEmail} disabled={busy === 'email'} className="mt-1 text-xs font-semibold text-green-600 hover:underline disabled:opacity-50">
              {busy === 'email' ? 'Sending…' : booking.webhook_sent ? 'Resend confirmation email' : 'Send confirmation email'}
            </button>
          )}
        </section>
      </div>

      <section className={CARD_CLS}>
        <h2 className={CARD_TITLE_CLS}>History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
        ) : (
          <ul className="divide-y divide-border/60 text-sm">
            {history.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span className="text-foreground">{entry.message ?? entry.event_name}</span>
                <span className="text-xs text-muted-foreground">
                  {entry.amount !== null && entry.amount !== 0 ? `${formatUsd(entry.amount)} · ` : ''}
                  {formatFloridaDateTime(entry.occurred_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Booked {formatFloridaDateTime(booking.created_at)}</p>
      </section>
    </div>
  );
}

function Row({ label, value, strong, muted, warn }: { label: string; value: string; strong?: boolean; muted?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={muted ? 'text-muted-foreground' : warn ? 'font-medium text-amber-700 dark:text-amber-300' : 'text-foreground'}>{label}</dt>
      <dd className={`${strong ? 'font-semibold' : ''} ${warn ? 'font-semibold text-amber-700 dark:text-amber-300' : 'text-foreground'}`}>{value}</dd>
    </div>
  );
}

// ─── Money actions ──────────────────────────────────────────────────────────────

type MoneyMode = 'charge_card' | 'record_payment' | 'refund_card' | 'record_refund' | 'manual_payment';

function MoneyActions({
  booking,
  unsettled,
  collected,
  onDone,
}: {
  booking: DetailBooking;
  unsettled: number;
  collected: number;
  onDone: (text: string, tone: 'ok' | 'warn' | 'error') => void;
}) {
  const isManual = booking.booking_source === 'manual';
  const owed = Math.max(0, unsettled);
  const refundOwed = Math.max(0, -unsettled);
  const hasCard = Boolean(booking.stripe_payment_method_id);

  const [mode, setMode] = useState<MoneyMode | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [reason, setReason] = useState('');
  const [requestId, setRequestId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = (next: MoneyMode, cents: number) => {
    setMode(next);
    setAmount(cents > 0 ? (cents / 100).toFixed(2) : '');
    setReason('');
    setError(null);
    setRequestId(newRequestId()); // one id per attempt: a double click can't move money twice
  };

  const submit = async () => {
    const cents = toCents(amount);
    if (!cents || cents <= 0) return setError('Enter an amount.');
    setSaving(true);
    setError(null);
    const { ok, data } =
      mode === 'manual_payment'
        ? await sendJson('/api/admin/manual-booking', 'PATCH', {
            action: 'record_payment',
            id: booking.id,
            amount_cents: cents,
            payment_method: method,
          })
        : await sendJson(`/api/admin/bookings/${booking.id}/payments`, 'POST', {
            action: mode,
            amount_cents: cents,
            request_id: requestId,
            ...(mode === 'record_payment' || mode === 'record_refund' ? { method } : {}),
            ...(mode === 'refund_card' || mode === 'record_refund' ? { reason: reason || null } : {}),
          });
    setSaving(false);
    if (!ok) return setError(String(data.error ?? 'Something went wrong'));
    setMode(null);
    onDone(String(data.message ?? 'Payment recorded.'), 'ok');
  };

  if (isManual) {
    if (owed <= 0) return null;
    return (
      <div className="mt-4 border-t border-border/60 pt-3">
        {mode === null ? (
          <Button size="sm" variant="outline" onClick={() => open('manual_payment', owed)}>
            Record payment
          </Button>
        ) : (
          <MoneyForm
            title="Record a payment"
            amount={amount}
            setAmount={setAmount}
            method={method}
            setMethod={setMethod}
            showMethod
            confirmLabel="Record payment"
            saving={saving}
            error={error}
            onSubmit={submit}
            onCancel={() => setMode(null)}
          />
        )}
      </div>
    );
  }

  const titles: Record<MoneyMode, string> = {
    charge_card: 'Charge the saved card',
    record_payment: 'Record a payment (cash, Zelle…)',
    refund_card: 'Refund to the card',
    record_refund: 'Record a refund given outside Stripe',
    manual_payment: 'Record a payment',
  };

  return (
    <div className="mt-4 space-y-2 border-t border-border/60 pt-3">
      {mode === null ? (
        <div className="flex flex-wrap gap-2">
          {owed > 0 && hasCard && (
            <Button size="sm" className="bg-green-600 text-white hover:bg-green-700" onClick={() => open('charge_card', owed)}>
              Charge card {formatUsd(owed)}
            </Button>
          )}
          {owed > 0 && (
            <Button size="sm" variant="outline" onClick={() => open('record_payment', owed)}>
              Record payment
            </Button>
          )}
          {collected > 0 && (
            <Button size="sm" variant="outline" onClick={() => open('refund_card', refundOwed)}>
              {refundOwed > 0 ? `Refund ${formatUsd(refundOwed)} to card` : 'Refund to card'}
            </Button>
          )}
          {collected > 0 && (
            <Button size="sm" variant="outline" onClick={() => open('record_refund', refundOwed)}>
              Record cash refund
            </Button>
          )}
        </div>
      ) : (
        <MoneyForm
          title={titles[mode]}
          amount={amount}
          setAmount={setAmount}
          method={method}
          setMethod={setMethod}
          showMethod={mode === 'record_payment' || mode === 'record_refund'}
          reason={reason}
          setReason={mode === 'refund_card' || mode === 'record_refund' ? setReason : undefined}
          confirmLabel={
            mode === 'charge_card'
              ? `Charge ${amount ? `$${amount}` : ''} now`
              : mode === 'refund_card'
                ? `Refund ${amount ? `$${amount}` : ''} now`
                : 'Record it'
          }
          danger={mode === 'charge_card' || mode === 'refund_card'}
          saving={saving}
          error={error}
          onSubmit={submit}
          onCancel={() => setMode(null)}
        />
      )}
    </div>
  );
}

function MoneyForm(props: {
  title: string;
  amount: string;
  setAmount: (v: string) => void;
  method: string;
  setMethod: (v: string) => void;
  showMethod: boolean;
  reason?: string;
  setReason?: (v: string) => void;
  confirmLabel: string;
  danger?: boolean;
  saving: boolean;
  error: string | null;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-background/60 p-3">
      <p className="text-sm font-semibold text-foreground">{props.title}</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="mb-1 block text-xs text-muted-foreground">Amount ($)</Label>
          <Input type="number" min="0" step="0.01" value={props.amount} onChange={(e) => props.setAmount(e.target.value)} />
        </div>
        {props.showMethod && (
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Method</Label>
            <select value={props.method} onChange={(e) => props.setMethod(e.target.value)} className={INPUT_CLS}>
              <option value="cash">Cash</option>
              <option value="zelle">Zelle</option>
              <option value="venmo">Venmo</option>
              <option value="other">Other</option>
            </select>
          </div>
        )}
      </div>
      {props.setReason && (
        <div>
          <Label className="mb-1 block text-xs text-muted-foreground">Reason (internal)</Label>
          <Input value={props.reason ?? ''} onChange={(e) => props.setReason?.(e.target.value)} placeholder="e.g. tour shortened to 2 h" />
        </div>
      )}
      {props.error && <p className="text-xs text-red-600 dark:text-red-400">{props.error}</p>}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={props.onSubmit}
          disabled={props.saving}
          className={props.danger ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-green-600 text-white hover:bg-green-700'}
        >
          {props.saving ? 'Working…' : props.confirmLabel}
        </Button>
        <Button size="sm" variant="outline" onClick={props.onCancel} disabled={props.saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── Edit panel ─────────────────────────────────────────────────────────────────

function EditPanel({
  booking,
  locations,
  onCancel,
  onSaved,
}: {
  booking: DetailBooking;
  locations: DetailLocation[];
  onCancel: () => void;
  onSaved: (text: string, tone: 'ok' | 'warn') => void;
}) {
  const isManual = booking.booking_source === 'manual';
  const isPaved = booking.trail_type === 'paved';
  const [form, setForm] = useState<FormState>(() => initialForm(booking));
  const [preview, setPreview] = useState<EditPreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setPreview(null); // any change invalidates the reviewed preview
  };
  const setRider = (index: number, patch: Partial<RiderForm>) =>
    set('riders', form.riders.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const bikeOptions: BikeRental[] = isPaved ? ['standard', 'electric'] : ['none', 'standard', 'electric'];
  const selectedLocation = locations.find((l) => l.id === form.location_id);
  const skillOptions = useMemo(
    () => (selectedLocation?.skill_levels?.length ? selectedLocation.skill_levels : (Object.keys(SKILL_LABELS) as SkillLevel[])),
    [selectedLocation]
  );

  const onlinePayload = (dryRun: boolean) => ({
    dry_run: dryRun,
    customer_name: form.customer_name,
    customer_email: form.customer_email,
    customer_phone: form.customer_phone || null,
    date: form.date,
    time_slot: form.time_slot,
    duration_hours: isPaved ? 2 : form.duration_hours,
    location_id: form.location_id || undefined,
    skill_level: form.skill_level || null,
    bike_rental: form.bike_rental,
    rider_height_inches: form.rider_height_inches,
    participants: form.riders.map((r) => ({ name: r.name, bike_rental: r.bike_rental, height_inches: r.height_inches })),
    addons: isPaved ? undefined : { gopro: form.gopro, pickup_dropoff: form.pickup_dropoff },
    admin_notes: form.admin_notes || null,
    price_override_cents: form.custom_price ? toCents(form.price_override) : null,
    price_override_reason: form.custom_price ? form.price_override_reason || null : null,
    notify_customer: form.notify_customer,
  });

  const review = async () => {
    if (form.custom_price && toCents(form.price_override) === null) return setError('Enter the custom price.');
    setSaving(true);
    setError(null);
    const { ok, data } = await sendJson(`/api/admin/bookings/${booking.id}`, 'PATCH', onlinePayload(true));
    setSaving(false);
    if (!ok) return setError(String(data.error ?? 'Could not check the changes'));
    setPreview(data.preview as EditPreview);
  };

  const saveOnline = async () => {
    setSaving(true);
    setError(null);
    const { ok, data } = await sendJson(`/api/admin/bookings/${booking.id}`, 'PATCH', onlinePayload(false));
    setSaving(false);
    if (!ok) return setError(String(data.error ?? 'Could not save the changes'));
    onSaved(...describeSave(data));
  };

  const saveManual = async () => {
    const totalCents = toCents(form.manual_total);
    if (totalCents === null) return setError('Enter the agreed total.');
    setSaving(true);
    setError(null);
    const { ok, data } = await sendJson('/api/admin/manual-booking', 'PATCH', {
      action: 'update',
      id: booking.id,
      customer_name: form.customer_name,
      customer_email: form.customer_email,
      customer_phone: form.customer_phone || null,
      date: form.date,
      time_slot: form.time_slot,
      duration_hours: form.duration_hours,
      bike_rental: form.bike_rental,
      rider_height_inches: form.rider_height_inches,
      additional_participants: form.riders.map((r) => ({ name: r.name, bike_rental: r.bike_rental, height_inches: r.height_inches })),
      total_cents: totalCents,
      payment_method: form.manual_payment_method,
      admin_notes: form.admin_notes || null,
      notify_customer: form.notify_customer,
    });
    setSaving(false);
    if (!ok) return setError(String(data.error ?? 'Could not save the changes'));
    onSaved(...describeSave(data));
  };

  const noChanges = preview !== null && preview.changes.length === 0;

  return (
    <section className="space-y-5 rounded-2xl border border-green-500/40 bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground">Edit booking</h2>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>
          Close
        </Button>
      </div>

      <FieldGroup title="Customer">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Name">
            <Input value={form.customer_name} onChange={(e) => set('customer_name', e.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.customer_email} onChange={(e) => set('customer_email', e.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={form.customer_phone} onChange={(e) => set('customer_phone', e.target.value)} />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">Contact changes apply to every booking of this customer.</p>
      </FieldGroup>

      <FieldGroup title="Tour">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Location">
            {isManual ? (
              <p className="py-2 text-sm text-muted-foreground">{booking.location_name} — to move a manual booking, cancel it and book again.</p>
            ) : (
              <select value={form.location_id} onChange={(e) => set('location_id', e.target.value)} className={INPUT_CLS}>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {!isPaved && !isManual && (
            <Field label="Skill level">
              <select value={form.skill_level} onChange={(e) => set('skill_level', e.target.value as SkillLevel)} className={INPUT_CLS}>
                {skillOptions.map((level) => (
                  <option key={level} value={level}>
                    {SKILL_LABELS[level]}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Date">
            <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <Field label="Time (Eastern)">
            <Input type="time" step={900} value={form.time_slot} onChange={(e) => set('time_slot', e.target.value)} />
          </Field>
          <Field label="Duration">
            {isPaved ? (
              <p className="py-2 text-sm text-muted-foreground">2 hours (paved)</p>
            ) : (
              <select value={form.duration_hours} onChange={(e) => set('duration_hours', Number(e.target.value))} className={INPUT_CLS}>
                {[2, 3, 4].map((h) => (
                  <option key={h} value={h}>
                    {h} hours
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        {!isPaved && !isManual && (
          <div className="flex flex-wrap gap-4 text-sm text-foreground">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.gopro} onChange={(e) => set('gopro', e.target.checked)} /> GoPro package
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.pickup_dropoff} onChange={(e) => set('pickup_dropoff', e.target.checked)} /> Pickup + dropoff
            </label>
          </div>
        )}
      </FieldGroup>

      <FieldGroup title="Riders">
        <RiderRow
          label="Rider 1 (lead)"
          name={form.customer_name}
          nameReadOnly
          bike={form.bike_rental}
          height={form.rider_height_inches}
          bikeOptions={bikeOptions}
          onBike={(bike) => set('bike_rental', bike)}
          onHeight={(height) => set('rider_height_inches', height)}
        />
        {form.riders.map((rider, index) => (
          <RiderRow
            key={index}
            label={`Rider ${index + 2}`}
            name={rider.name}
            bike={rider.bike_rental}
            height={rider.height_inches}
            bikeOptions={bikeOptions}
            onName={(name) => setRider(index, { name })}
            onBike={(bike) => setRider(index, { bike_rental: bike })}
            onHeight={(height) => setRider(index, { height_inches: height })}
            onRemove={() => set('riders', form.riders.filter((_, i) => i !== index))}
          />
        ))}
        <Button
          size="sm"
          variant="outline"
          onClick={() => set('riders', [...form.riders, { name: '', bike_rental: isPaved ? 'standard' : form.bike_rental, height_inches: null }])}
        >
          + Add rider
        </Button>
      </FieldGroup>

      <FieldGroup title="Price">
        {isManual ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Agreed total ($)">
              <Input type="number" min="0" step="0.01" value={form.manual_total} onChange={(e) => set('manual_total', e.target.value)} />
            </Field>
            <Field label="Payment method">
              <select value={form.manual_payment_method} onChange={(e) => set('manual_payment_method', e.target.value)} className={INPUT_CLS}>
                <option value="cash">Cash</option>
                <option value="zelle">Zelle</option>
                <option value="venmo">Venmo</option>
                <option value="other">Other</option>
              </select>
            </Field>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Riders, bikes, duration, add-ons and location re-price the tour with the website prices
              {booking.discount_code ? ` (the ${booking.discount_label ?? booking.discount_code} is applied again)` : ''}.
            </p>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={form.custom_price} onChange={(e) => set('custom_price', e.target.checked)} />
              Set a custom price instead
            </label>
            {form.custom_price && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Final price the customer pays ($)">
                  <Input type="number" min="0" step="0.01" value={form.price_override} onChange={(e) => set('price_override', e.target.value)} />
                </Field>
                <Field label="Reason (internal, required)">
                  <Input value={form.price_override_reason} onChange={(e) => set('price_override_reason', e.target.value)} placeholder="e.g. returning customer" />
                </Field>
              </div>
            )}
          </>
        )}
      </FieldGroup>

      <FieldGroup title="Notes (internal)">
        <textarea
          value={form.admin_notes}
          onChange={(e) => set('admin_notes', e.target.value)}
          rows={2}
          className={`${INPUT_CLS} resize-y`}
        />
      </FieldGroup>

      <label className="flex items-start gap-2 text-sm text-foreground">
        <input type="checkbox" className="mt-0.5" checked={form.notify_customer} onChange={(e) => set('notify_customer', e.target.checked)} />
        <span>
          Email the customer the updated booking
          <span className="block text-xs text-muted-foreground">Sends “Your booking was updated” with the changes (and the waiver link if a new rider must sign).</span>
        </span>
      </label>

      {preview && <PreviewPanel preview={preview} booking={booking} />}
      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {isManual ? (
          <Button onClick={saveManual} disabled={saving} className="bg-green-600 text-white hover:bg-green-700">
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        ) : preview && !noChanges ? (
          <Button onClick={saveOnline} disabled={saving} className="bg-green-600 text-white hover:bg-green-700">
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        ) : (
          <Button onClick={review} disabled={saving} className="bg-green-600 text-white hover:bg-green-700">
            {saving ? 'Checking…' : 'Review changes'}
          </Button>
        )}
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </section>
  );
}

/** Result banner after a save (online or manual API). */
function describeSave(data: Record<string, unknown>): [string, 'ok' | 'warn'] {
  const parts = ['Booking updated.'];
  let tone: 'ok' | 'warn' = 'ok';
  if (data.calendar_ok === true) parts.push('Calendar updated.');
  if (data.calendar_ok === false) {
    parts.push(`Calendar NOT updated (${String(data.calendar_error ?? 'Cal.com error')}) — use "Retry calendar".`);
    tone = 'warn';
  }
  if (data.waiver_reset === true) parts.push('The waiver reopened for the new riders.');
  if (data.email_sent === true) parts.push('The customer was emailed.');
  if (data.email_sent === false) {
    parts.push(`Email NOT sent (${String(data.email_error ?? 'error')}).`);
    tone = 'warn';
  }
  const preview = data.preview as EditPreview | undefined;
  if (preview && preview.balance.unsettled > 0) parts.push(`The customer still owes ${formatUsd(preview.balance.unsettled)} — collect it under Payment.`);
  if (preview && preview.balance.unsettled < 0) parts.push(`${formatUsd(-preview.balance.unsettled)} is owed back — refund it under Payment.`);
  return [parts.join(' '), tone];
}

function PreviewPanel({ preview, booking }: { preview: EditPreview; booking: DetailBooking }) {
  if (preview.changes.length === 0) {
    return <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Nothing changed.</p>;
  }
  const { balance } = preview;
  return (
    <div className="space-y-3 rounded-xl border border-border bg-background/60 p-4">
      <p className="text-sm font-semibold text-foreground">Saving will:</p>
      <ul className="space-y-1 text-sm">
        {preview.changes.map((change) => (
          <li key={change.field} className="text-foreground">
            <span className="font-medium">{change.label}:</span>{' '}
            <span className="text-muted-foreground line-through">{change.from ?? '—'}</span> → {change.to ?? '—'}
          </li>
        ))}
      </ul>
      <ul className="space-y-1 text-sm text-foreground">
        {preview.price && (
          <li>
            💲 Price {formatUsd(preview.price.from)} → <strong>{formatUsd(preview.price.to)}</strong>
            {preview.price.overridden ? ` (custom — website price would be ${formatUsd(preview.price.quoted)})` : ' (website prices)'}
          </li>
        )}
        {balance.scheduled_from !== balance.scheduled_to && (
          <li>
            💳 Automatic card charge {formatUsd(balance.scheduled_from)} → <strong>{formatUsd(balance.scheduled_to)}</strong>
            {balance.due_at ? ` on ${formatFloridaCalendarDate(balance.due_at.slice(0, 10))}` : ''}
          </li>
        )}
        {balance.scheduled_from === balance.scheduled_to && balance.scheduled_to > 0 && balance.due_at !== booking.remaining_balance_due_at && balance.due_at && (
          <li>💳 Card charge moves to {formatFloridaCalendarDate(balance.due_at.slice(0, 10))}</li>
        )}
        {balance.unsettled > 0 && <li>⚠️ The customer will owe {formatUsd(balance.unsettled)} that nothing charges automatically — collect it after saving.</li>}
        {balance.unsettled < 0 && <li>↩️ {formatUsd(-balance.unsettled)} will be owed back to the customer — refund it after saving.</li>}
        {preview.calendar === 'reschedule' && <li>📅 The Cal.com event moves to the new time.</li>}
        {preview.calendar === 'recreate' && <li>📅 The Cal.com event is replaced with one at the new location.</li>}
        {preview.waiver_needs.length > 0 && <li>✍️ {preview.waiver_needs.join(', ')} still need to sign the waiver — the link reopens.</li>}
      </ul>
      {preview.warnings.map((warning) => (
        <p key={warning} className="text-sm text-amber-700 dark:text-amber-300">⚠️ {warning}</p>
      ))}
    </div>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function RiderRow(props: {
  label: string;
  name: string;
  nameReadOnly?: boolean;
  bike: BikeRental;
  height: number | null;
  bikeOptions: BikeRental[];
  onName?: (name: string) => void;
  onBike: (bike: BikeRental) => void;
  onHeight: (height: number | null) => void;
  onRemove?: () => void;
}) {
  const heightOptions = props.height && !HEIGHT_OPTIONS.some((h) => h.value === props.height)
    ? [...HEIGHT_OPTIONS, { label: `${props.height}"`, value: props.height }]
    : HEIGHT_OPTIONS;
  return (
    <div className="grid items-end gap-2 rounded-lg border border-border/60 p-3 sm:grid-cols-[1fr_10rem_10rem_auto]">
      <Field label={props.label}>
        {props.nameReadOnly ? (
          <p className="py-2 text-sm text-foreground">{props.name || '—'}</p>
        ) : (
          <Input value={props.name} onChange={(e) => props.onName?.(e.target.value)} placeholder="Full name" />
        )}
      </Field>
      <Field label="Bike">
        <select value={props.bike} onChange={(e) => props.onBike(e.target.value as BikeRental)} className={INPUT_CLS}>
          {props.bikeOptions.map((bike) => (
            <option key={bike} value={bike}>
              {bikeLabel(bike)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Height">
        <select
          value={props.height ?? ''}
          onChange={(e) => props.onHeight(e.target.value ? Number(e.target.value) : null)}
          className={INPUT_CLS}
          disabled={props.bike === 'none'}
        >
          <option value="">Unknown</option>
          {heightOptions.map((h) => (
            <option key={h.value} value={h.value}>
              {h.label}
            </option>
          ))}
        </select>
      </Field>
      {props.onRemove ? (
        <Button size="sm" variant="outline" onClick={props.onRemove}>
          Remove
        </Button>
      ) : (
        <span />
      )}
    </div>
  );
}

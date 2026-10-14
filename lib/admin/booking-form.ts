// The booking form of the admin: the edit of any booking (/admin/bookings/[id]/edit)
// and, from step 4b, the creation of a manual one. The form's state, what each
// API receives, what it says before it saves and after. Pure — the island is
// app/admin/(panel)/_components/BookingForm.tsx, and the APIs check it all again.
//
// Two APIs edit a booking: an online one goes to /api/admin/bookings/[id]
// (re-priced with the website prices, a "Review changes" preview first), a
// manual one to /api/admin/manual-booking (its agreed total, no preview).
import type { EditPreview } from '@/lib/booking-edit';
import { formatUsd } from '@/lib/booking-money';
import { formatFloridaCalendarDate, formatTourTime } from '@/lib/display-time';
import type { BikeRental, SkillLevel, TrailType } from '@/types/booking';
import { single, type Raw } from './params';

// ─── Choices ────────────────────────────────────────────────────────────────

/** The height bands of the booking flow (inches: the middle of each band). */
export const HEIGHT_OPTIONS = [
  { label: 'Under 5\'0"', value: 59 },
  { label: '5\'0"–5\'3"', value: 62 },
  { label: '5\'4"–5\'7"', value: 66 },
  { label: '5\'8"–5\'11"', value: 70 },
  { label: '6\'0"–6\'3"', value: 74 },
  { label: 'Over 6\'3"', value: 76 },
];

/** The bands, plus a stored height that matches none (an older booking). */
export function heightOptions(current: number | null): { label: string; value: number }[] {
  return current && !HEIGHT_OPTIONS.some((h) => h.value === current)
    ? [...HEIGHT_OPTIONS, { label: `${current}"`, value: current }]
    : HEIGHT_OPTIONS;
}

export const SKILL_LABELS: Record<SkillLevel, string> = {
  first_time: 'First time',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

/** Same words as the booking's rider list. */
export const BIKE_LABELS: Record<BikeRental, string> = {
  none: 'Own bike',
  standard: 'Regular bike',
  electric: 'E-bike',
};

/** A paved tour always rides a rental: there is no "own bike" on it. */
export function bikeOptions(trail: TrailType): BikeRental[] {
  return trail === 'paved' ? ['standard', 'electric'] : ['none', 'standard', 'electric'];
}

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'other', label: 'Other' },
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value'];

export function asPaymentMethod(value: string | null | undefined): PaymentMethod {
  return PAYMENT_METHODS.some((m) => m.value === value) ? (value as PaymentMethod) : 'cash';
}

/** A paved tour lasts two hours; a mountain bike tour two to four. */
export const DURATIONS = [2, 3, 4] as const;

const FIRST_SLOT = 6 * 60;
const LAST_SLOT = 19 * 60;

/** Start times every 15 minutes, 6:00 AM to 7:00 PM Eastern, plus the stored one if it's off the grid. */
export function timeOptions(current: string): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let m = FIRST_SLOT; m <= LAST_SLOT; m += 15) {
    const value = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    options.push({ value, label: formatTourTime(value) });
  }
  if (/^\d{2}:\d{2}$/.test(current) && !options.some((o) => o.value === current)) {
    options.push({ value: current, label: formatTourTime(current) });
    options.sort((a, b) => a.value.localeCompare(b.value));
  }
  return options;
}

/** "45" or "45.5" dollars → cents; null when empty or not a number. */
export function toCents(dollars: string): number | null {
  if (dollars.trim() === '') return null;
  const value = Number(dollars);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
}

// ─── The form ───────────────────────────────────────────────────────────────

export type FormLocation = { id: string; name: string; tour_type: TrailType; skill_levels: SkillLevel[] | null };

/** What the form reads of a booking. */
export type EditableBooking = {
  id: string;
  booking_source: string | null;
  trail_type: string;
  skill_level: string | null;
  date: string;
  time_slot: string | null;
  duration_hours: number | null;
  location_id: string | null;
  bike_rental: string | null;
  rider_height_inches: number | null;
  participant_info: { name?: string | null; bike_rental?: string | null; height_inches?: number | null }[] | null;
  addons: { gopro?: boolean; pickup_dropoff?: boolean } | null;
  total_price: number | null;
  payment_method: string | null;
  admin_notes: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
};

export type RiderForm = { name: string; bike_rental: BikeRental; height_inches: number | null };

export type BookingFormState = {
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
  /** Riders after the lead (the customer is rider 1). */
  riders: RiderForm[];
  gopro: boolean;
  pickup_dropoff: boolean;
  admin_notes: string;
  custom_price: boolean;
  price_override: string;
  price_override_reason: string;
  /** A manual booking's agreed total, in dollars. */
  manual_total: string;
  manual_payment_method: PaymentMethod;
  notify_customer: boolean;
};

const asBike = (value: string | null | undefined): BikeRental | null =>
  value === 'none' || value === 'standard' || value === 'electric' ? value : null;

const asSkill = (value: string | null | undefined): SkillLevel | '' =>
  value && value in SKILL_LABELS ? (value as SkillLevel) : '';

export const isManualBooking = (b: Pick<EditableBooking, 'booking_source'>) => b.booking_source === 'manual';
export const trailOf = (b: Pick<EditableBooking, 'trail_type'>): TrailType => (b.trail_type === 'paved' ? 'paved' : 'mtb');

export function initialForm(b: EditableBooking): BookingFormState {
  const paved = trailOf(b) === 'paved';
  const lead = asBike(b.bike_rental) ?? (paved ? 'standard' : 'none');
  return {
    customer_name: b.customer_name ?? '',
    customer_email: b.customer_email ?? '',
    customer_phone: b.customer_phone ?? '',
    location_id: b.location_id ?? '',
    skill_level: asSkill(b.skill_level),
    date: b.date,
    time_slot: b.time_slot ?? '',
    duration_hours: paved ? 2 : b.duration_hours ?? 2,
    bike_rental: lead,
    rider_height_inches: b.rider_height_inches,
    riders: (b.participant_info ?? []).map((r) => ({
      name: r.name ?? '',
      // Manual bookings used to store names only: those riders ride the lead's bike.
      bike_rental: asBike(r.bike_rental) ?? lead,
      height_inches: r.height_inches ?? null,
    })),
    gopro: Boolean(b.addons?.gopro),
    pickup_dropoff: Boolean(b.addons?.pickup_dropoff),
    admin_notes: b.admin_notes ?? '',
    custom_price: false,
    price_override: '',
    price_override_reason: '',
    manual_total: ((b.total_price ?? 0) / 100).toFixed(2),
    manual_payment_method: asPaymentMethod(b.payment_method),
    notify_customer: false,
  };
}

/** A new rider rides the lead's bike until told otherwise. */
export function newRider(form: Pick<BookingFormState, 'bike_rental'>): RiderForm {
  return { name: '', bike_rental: form.bike_rental, height_inches: null };
}

/** The skill levels a location takes (all of them when it doesn't say). */
export function skillOptions(locations: readonly FormLocation[], locationId: string): SkillLevel[] {
  const location = locations.find((l) => l.id === locationId);
  return location?.skill_levels?.length ? location.skill_levels : (Object.keys(SKILL_LABELS) as SkillLevel[]);
}

/** What stops a save before the API is asked: one sentence, or null. The API checks again. */
export function formProblem(form: BookingFormState, manual: boolean): string | null {
  if (!form.customer_name.trim()) return 'The customer needs a name.';
  if (!/^\S+@\S+\.\S+$/.test(form.customer_email.trim())) return 'The customer needs a valid email.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return 'Pick the tour date.';
  if (!/^\d{2}:\d{2}$/.test(form.time_slot)) return 'Pick the start time.';
  const unnamed = form.riders.findIndex((r) => !r.name.trim());
  if (unnamed >= 0) return `Rider ${unnamed + 2} needs a name, or remove the rider.`;
  if (manual) {
    if (toCents(form.manual_total) === null) return 'Enter the agreed total.';
  } else if (form.custom_price) {
    if (toCents(form.price_override) === null) return 'Enter the custom price.';
    if (!form.price_override_reason.trim()) return 'Say why the price is custom (internal).';
  }
  return null;
}

const riderPayload = (form: BookingFormState) =>
  form.riders.map((r) => ({ name: r.name.trim(), bike_rental: r.bike_rental, height_inches: r.height_inches }));

/** PATCH /api/admin/bookings/[id]: `dryRun` returns the preview, false saves it. */
export function onlineEditPayload(form: BookingFormState, trail: TrailType, dryRun: boolean) {
  const paved = trail === 'paved';
  return {
    dry_run: dryRun,
    customer_name: form.customer_name.trim(),
    customer_email: form.customer_email.trim(),
    customer_phone: form.customer_phone.trim() || null,
    date: form.date,
    time_slot: form.time_slot,
    duration_hours: paved ? 2 : form.duration_hours,
    location_id: form.location_id || undefined,
    skill_level: paved ? null : form.skill_level || null,
    bike_rental: form.bike_rental,
    rider_height_inches: form.rider_height_inches,
    participants: riderPayload(form),
    addons: paved ? undefined : { gopro: form.gopro, pickup_dropoff: form.pickup_dropoff },
    admin_notes: form.admin_notes.trim() || null,
    price_override_cents: form.custom_price ? toCents(form.price_override) : null,
    price_override_reason: form.custom_price ? form.price_override_reason.trim() || null : null,
    notify_customer: form.notify_customer,
  };
}

/** PATCH /api/admin/manual-booking, `action: "update"`. A manual booking keeps its location. */
export function manualEditPayload(form: BookingFormState, id: string) {
  return {
    action: 'update' as const,
    id,
    customer_name: form.customer_name.trim(),
    customer_email: form.customer_email.trim(),
    customer_phone: form.customer_phone.trim() || null,
    date: form.date,
    time_slot: form.time_slot,
    duration_hours: form.duration_hours,
    bike_rental: form.bike_rental,
    rider_height_inches: form.rider_height_inches,
    additional_participants: riderPayload(form),
    total_cents: toCents(form.manual_total) ?? 0,
    payment_method: form.manual_payment_method,
    admin_notes: form.admin_notes.trim() || null,
    notify_customer: form.notify_customer,
  };
}

// ─── Before saving: the preview of an online edit ───────────────────────────

export type PreviewLine = { key: string; text: string; attention?: boolean };

const day = (iso: string) => formatFloridaCalendarDate(iso.slice(0, 10));

/** What saving will do, one line each, from the API's dry run. */
export function previewLines(preview: EditPreview, currentDueAt: string | null): PreviewLine[] {
  const lines: PreviewLine[] = preview.changes.map((c) => ({
    key: `change-${c.field}`,
    text: `${c.label}: ${c.from ?? '—'} → ${c.to ?? '—'}`,
  }));
  const { price, balance } = preview;
  if (price) {
    lines.push({
      key: 'price',
      text: `Price ${formatUsd(price.from)} → ${formatUsd(price.to)}${
        price.overridden ? ` (custom; the website price would be ${formatUsd(price.quoted)})` : ' (website prices)'
      }`,
    });
  }
  if (balance.scheduled_from !== balance.scheduled_to) {
    lines.push({
      key: 'charge',
      text: `Automatic card charge ${formatUsd(balance.scheduled_from)} → ${formatUsd(balance.scheduled_to)}${
        balance.due_at ? ` on ${day(balance.due_at)}` : ''
      }`,
    });
  } else if (balance.scheduled_to > 0 && balance.due_at && balance.due_at !== currentDueAt) {
    lines.push({ key: 'charge', text: `The card charge moves to ${day(balance.due_at)}` });
  }
  if (balance.unsettled > 0) {
    lines.push({
      key: 'owed',
      text: `The customer will owe ${formatUsd(balance.unsettled)} that nothing charges automatically: collect it after saving.`,
      attention: true,
    });
  }
  if (balance.unsettled < 0) {
    lines.push({
      key: 'refund',
      text: `${formatUsd(-balance.unsettled)} will be owed back to the customer: refund it after saving.`,
      attention: true,
    });
  }
  if (preview.calendar === 'reschedule') lines.push({ key: 'calendar', text: 'The Cal.com event moves to the new time.' });
  if (preview.calendar === 'recreate') lines.push({ key: 'calendar', text: 'The Cal.com event is replaced with one at the new location.' });
  if (preview.waiver_needs.length) {
    const who = preview.waiver_needs.join(', ');
    lines.push({
      key: 'waiver',
      text: `${who} ${preview.waiver_needs.length === 1 ? 'still needs' : 'still need'} to sign the waiver: the link reopens.`,
      attention: true,
    });
  }
  preview.warnings.forEach((warning, i) => lines.push({ key: `warning-${i}`, text: warning, attention: true }));
  return lines;
}

// ─── After saving: what the booking page says ───────────────────────────────

/** The answer of either API to a save (only what this reads). */
export type SaveResponse = {
  calendar_ok?: boolean | null;
  email_sent?: boolean | null;
  waiver_reset?: boolean;
  preview?: Pick<EditPreview, 'balance' | 'waiver_needs'>;
};

/**
 * The outcome of a save as the booking page's query (?saved=…): the form goes
 * back to the booking and the booking says what happened. Codes, never text, so
 * a link can't put words on the page.
 */
export function savedQuery(data: SaveResponse): string {
  const params = new URLSearchParams({ saved: '1' });
  if (data.calendar_ok === true) params.set('cal', 'ok');
  if (data.calendar_ok === false) params.set('cal', 'failed');
  if (data.email_sent === true) params.set('email', 'sent');
  if (data.email_sent === false) params.set('email', 'failed');
  if (data.waiver_reset || data.preview?.waiver_needs.length) params.set('waiver', 'reopened');
  const unsettled = data.preview?.balance.unsettled ?? 0;
  if (unsettled > 0) params.set('owed', String(unsettled));
  if (unsettled < 0) params.set('refund', String(-unsettled));
  return params.toString();
}

/** The params savedQuery() writes, so the page can drop them all at once. */
export const SAVED_PARAMS = ['saved', 'cal', 'email', 'waiver', 'owed', 'refund'] as const;

const cents = (raw: Raw) => {
  const n = Number.parseInt(single(raw) ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** The booking page's line after a save, or null when the URL doesn't carry one. */
export function savedNotice(params: Record<string, Raw>): { attention: boolean; lines: string[] } | null {
  if (single(params.saved) !== '1') return null;
  const lines = ['Booking updated.'];
  let attention = false;
  const cal = single(params.cal);
  if (cal === 'ok') lines.push('Calendar updated.');
  if (cal === 'failed') {
    lines.push('The calendar was NOT updated: use Retry calendar below.');
    attention = true;
  }
  if (single(params.waiver) === 'reopened') lines.push('The waiver link reopened for the riders who still have to sign.');
  const email = single(params.email);
  if (email === 'sent') lines.push('The customer was emailed the changes.');
  if (email === 'failed') {
    lines.push('The email to the customer was NOT sent.');
    attention = true;
  }
  const owed = cents(params.owed);
  const refund = cents(params.refund);
  if (owed) {
    lines.push(`The customer still owes ${formatUsd(owed)}: collect it under Payment.`);
    attention = true;
  }
  if (refund) {
    lines.push(`${formatUsd(refund)} is owed back to the customer: refund it under Payment.`);
    attention = true;
  }
  return { attention, lines };
}

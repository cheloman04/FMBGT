// The bookings list of the admin (/admin/bookings): the DB record, the filter
// and search that live in the URL (§4.7), the row the list renders and the
// quick view of the drawer. Pure — the queries are in ./loaders.ts.
//
// Money comes from lib/booking-money.ts, like the overview and the booking
// detail (KIGARU_DASHBOARD_STANDARD_V1.md §8.2).
import { resolveStatus, withParam, type FilterSheetOption, type Metric, type SearchParamsInput, type StatusMeta } from '@/components/kit';
import { bookingTotalCents, netCollectedCents } from '@/lib/booking-money';
import { formatFloridaCalendarDate, formatFloridaDateTime, formatTourTime } from '@/lib/display-time';
import { formatPrice } from '@/lib/pricing';
import {
  BALANCE_STATUS,
  BOOKING_STATUS,
  CAL_STATUS,
  CONFIRMATION_EMAIL,
  FAILED_CHARGE,
  REVIEW_STATUS,
  SIZING_STATUS,
  WAIVER_STATUS,
} from './status-meta';

// ─── Records ────────────────────────────────────────────────────────────────

export type RiderInfo = { name?: string | null; bike_rental?: string | null; height_inches?: number | null };

/** A booking as the list and the drawer read it: its row plus the customer's and location's names. */
export type BookingRecord = {
  id: string;
  lead_id: string | null;
  booking_source: string | null;
  trail_type: string;
  date: string;
  time_slot: string | null;
  duration_hours: number | null;
  bike_rental: string | null;
  rider_height_inches: number | null;
  participant_count: number | null;
  participant_info: RiderInfo[] | null;
  total_price: number;
  status: string;
  created_at: string;
  location_id: string | null;
  customer_id: string | null;
  waiver_session_id: string | null;
  zip_code: string | null;
  marketing_source: string | null;
  attribution_snapshot: Record<string, unknown> | null;
  deposit_amount: number | null;
  deposit_paid_cents: number | null;
  deposit_payment_status: string | null;
  remaining_balance_amount: number | null;
  remaining_balance_due_at: string | null;
  remaining_balance_status: string | null;
  stripe_payment_method_id: string | null;
  extra_paid_cents: number | null;
  refunded_cents: number | null;
  cal_booking_status: string | null;
  webhook_sent: boolean | null;
  webhook_last_attempt_at: string | null;
  webhook_last_status_code: number | null;
  webhook_last_error: string | null;
  discount_code: string | null;
  discount_label: string | null;
  discount_percentage: number | null;
  discount_amount_cents: number | null;
  subtotal_before_discount_cents: number | null;
  total_after_discount_cents: number | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  location_name: string | null;
};

export type WaiverRecord = {
  id: string;
  booking_id: string | null;
  session_id: string | null;
  signer_name: string;
  signer_role: string;
  participants_covered: string[] | null;
  agreed_at: string;
  pdf_url: string | null;
  signature_url: string | null;
  guardian_relationship: string | null;
};

export type ReviewEnrollment = {
  id: string;
  booking_id: string;
  status: string;
  enrolled_at: string;
  next_step_due_at: string | null;
  review_left_at: string | null;
  review_platform: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  stop_reason: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * A waiver is filed under its booking or, signed before the booking existed,
 * under the checkout session. A booking takes the ones filed under its id, else
 * the ones of its session.
 */
export function groupWaivers<W extends Pick<WaiverRecord, 'booking_id' | 'session_id'>>(
  bookings: readonly Pick<BookingRecord, 'id' | 'waiver_session_id'>[],
  waivers: readonly W[],
): Map<string, W[]> {
  const byKey = new Map<string, W[]>();
  for (const w of waivers) {
    const key = w.booking_id ?? w.session_id;
    if (!key) continue;
    byKey.set(key, [...(byKey.get(key) ?? []), w]);
  }
  return new Map(
    bookings.map((b) => [b.id, byKey.get(b.id) ?? (b.waiver_session_id ? byKey.get(b.waiver_session_id) : undefined) ?? []]),
  );
}

/** The newest review request of each booking. `enrollments` comes newest first. */
export function latestReviewByBooking(enrollments: readonly ReviewEnrollment[]): Map<string, ReviewEnrollment> {
  const latest = new Map<string, ReviewEnrollment>();
  for (const e of enrollments) if (!latest.has(e.booking_id)) latest.set(e.booking_id, e);
  return latest;
}

/** The path inside the private `waivers` bucket, from a stored path or any of its URLs. */
export function extractWaiverStoragePath(urlOrPath: string | null): string | null {
  if (!urlOrPath) return null;
  if (!urlOrPath.startsWith('http://') && !urlOrPath.startsWith('https://')) return urlOrPath;
  try {
    const { pathname } = new URL(urlOrPath);
    for (const marker of [
      '/storage/v1/object/public/waivers/',
      '/storage/v1/object/sign/waivers/',
      '/storage/v1/object/authenticated/waivers/',
    ]) {
      const at = pathname.indexOf(marker);
      if (at >= 0) return decodeURIComponent(pathname.slice(at + marker.length));
    }
  } catch {
    return null;
  }
  return null;
}

// ─── The view in the URL: ?status= ?q= ?page= ───────────────────────────────

export const BOOKING_FILTERS = ['all', 'confirmed', 'completed', 'cancelled', 'refunded', 'failed'] as const;
export type BookingFilter = (typeof BOOKING_FILTERS)[number];
export type BookingCounts = Record<BookingFilter, number>;

/** Rows per "Load more". */
export const PAGE_SIZE = 50;
const MAX_PAGES = 20;
const MAX_SEARCH = 80;

type Raw = string | string[] | undefined;
const single = (raw: Raw) => (Array.isArray(raw) ? raw[0] : raw);

export function parseBookingFilter(raw: Raw): BookingFilter {
  const value = single(raw);
  return (BOOKING_FILTERS as readonly string[]).includes(value ?? '') ? (value as BookingFilter) : 'all';
}

/**
 * The search as it goes to the database. The characters PostgREST reads as
 * filter syntax (`,` `(` `)` `"` `\`) and the LIKE wildcards (`%` `*`) are
 * dropped: they never carry meaning in a name, an email or a phone.
 */
export function parseSearch(raw: Raw): string {
  return (single(raw) ?? '')
    .replace(/[,()"\\%*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SEARCH);
}

/** How many pages of PAGE_SIZE are showing ("Load more" adds one). */
export function parsePage(raw: Raw): number {
  const page = Number.parseInt(single(raw) ?? '', 10);
  return Number.isFinite(page) && page >= 1 ? Math.min(page, MAX_PAGES) : 1;
}

/** The id of the booking open in the drawer, if it looks like one. */
export function parseBookingId(raw: Raw): string | null {
  const value = single(raw);
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value.toLowerCase() : null;
}

/** A balance charge that failed on a tour that still happens (or happened): the operator can retry it. */
export function isFailedCharge(b: { status: string; remaining_balance_status?: string | null }): boolean {
  return b.remaining_balance_status === 'failed' && (b.status === 'confirmed' || b.status === 'completed');
}

export function matchesFilter(b: { status: string; remaining_balance_status?: string | null }, filter: BookingFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'failed') return isFailedCharge(b);
  return b.status === filter;
}

export function countByFilter(bookings: readonly { status: string; remaining_balance_status?: string | null }[]): BookingCounts {
  const counts = Object.fromEntries(BOOKING_FILTERS.map((f) => [f, 0])) as BookingCounts;
  for (const b of bookings) for (const f of BOOKING_FILTERS) if (matchesFilter(b, f)) counts[f] += 1;
  return counts;
}

/** A booking the search found: just what it takes to count, filter and sort. */
export type BookingMatch = {
  id: string;
  status: string;
  date: string;
  time_slot: string | null;
  remaining_balance_status: string | null;
};

/**
 * Newest tour date first, as the list without a search orders it in the
 * database (`date desc, time_slot desc`: Postgres puts a null time first).
 */
export function byTourDateDesc(a: BookingMatch, b: BookingMatch): number {
  const slot = (m: BookingMatch) => m.time_slot ?? '\uffff';
  return b.date.localeCompare(a.date) || slot(b).localeCompare(slot(a)) || a.id.localeCompare(b.id);
}

/**
 * The search runs as three queries (customer, location, the booking's own
 * columns). This joins them: one entry per booking, the counts of every
 * filter over the matches, and the ids of the page to show.
 */
export function searchResults(
  matches: readonly BookingMatch[],
  filter: BookingFilter,
  limit: number,
): { ids: string[]; total: number; counts: BookingCounts } {
  const unique = [...new Map(matches.map((m) => [m.id, m])).values()];
  const hits = unique.filter((m) => matchesFilter(m, filter)).sort(byTourDateDesc);
  return { ids: hits.slice(0, limit).map((m) => m.id), total: hits.length, counts: countByFilter(unique) };
}

const FILTER_LABEL: Record<BookingFilter, string> = {
  all: 'All bookings',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  failed: 'Charge failed',
};

export const FILTER_TITLE: Record<BookingFilter, string> = {
  all: 'All bookings',
  confirmed: 'Confirmed bookings',
  completed: 'Completed tours',
  cancelled: 'Cancelled bookings',
  refunded: 'Refunded bookings',
  failed: 'Failed balance charges',
};

/** The filters of the strip. Failed charges have their own line above the list, only when there are some. */
const STRIP_FILTERS: readonly BookingFilter[] = ['all', 'confirmed', 'completed', 'cancelled', 'refunded'];

/** The list's URL with one filter, keeping the search and dropping the drawer and the page. */
export function filterHref(path: string, params: SearchParamsInput, filter: BookingFilter): string {
  return withParam(path, withoutBooking(params), 'status', filter === 'all' ? null : filter);
}

function withoutBooking(params: SearchParamsInput): URLSearchParams {
  const copy = new URLSearchParams();
  const entries = params instanceof URLSearchParams ? [...params.entries()] : Object.entries(params);
  for (const [key, value] of entries) {
    if (key === 'booking') continue;
    for (const v of Array.isArray(value) ? value : [value]) if (v !== undefined) copy.append(key, v);
  }
  return copy;
}

/** The strip doubles as the status filter on a wide screen (§4.7). */
export function bookingFilterMetrics(counts: BookingCounts, active: BookingFilter, path: string, params: SearchParamsInput): Metric[] {
  return STRIP_FILTERS.map((f) => ({
    key: f,
    // "All bookings" doesn't fit five tiles on a tablet; the section below names it in full.
    label: f === 'all' ? 'All' : FILTER_LABEL[f],
    value: String(counts[f]),
    href: filterHref(path, params, f),
    active: f === active,
  }));
}

/** The same filter on the phone, in a FilterSheet. */
export function bookingFilterOptions(counts: BookingCounts, active: BookingFilter, path: string, params: SearchParamsInput): FilterSheetOption[] {
  const filters = counts.failed > 0 || active === 'failed' ? [...STRIP_FILTERS, 'failed' as const] : STRIP_FILTERS;
  return filters.map((f) => ({
    value: f === 'all' ? null : f,
    label: FILTER_LABEL[f],
    count: counts[f],
    href: filterHref(path, params, f),
  }));
}

/** What an empty list says: what's missing and how it fills (§8.5). */
export function bookingsEmpty(filter: BookingFilter, q: string): string {
  if (q) {
    return `No bookings match “${q}”. The search looks at the customer's name, email and phone, the location, the ZIP, the source and the discount code.`;
  }
  return {
    all: 'No bookings yet. They appear here when a customer pays online or you add a manual booking.',
    confirmed: 'No confirmed bookings. A booking is confirmed once it is paid online or added by hand.',
    completed: 'No completed tours yet. A booking lands here when it is marked completed after the ride.',
    cancelled: 'No cancelled bookings. A booking lands here when it is cancelled.',
    refunded: 'No refunded bookings. A booking lands here when its payment is refunded.',
    failed: 'No failed balance charges. A booking shows up here when the saved card is declined the day before the tour.',
  }[filter];
}

// ─── Riders ─────────────────────────────────────────────────────────────────

export type RiderView = {
  key: string;
  label: string;
  name: string;
  bike: string;
  height: string;
  needsSize: boolean;
};

function bikeLabel(bikeRental: string | null | undefined): string {
  if (!bikeRental || bikeRental === 'none') return 'Own bike';
  if (bikeRental === 'electric') return 'E-bike';
  return 'Regular bike';
}

/**
 * The lead rider (the customer) and then everyone in participant_info. A rider
 * without a bike of their own (manual bookings store names only) rides what
 * the lead rides — the rule of bookingBikeCounts() in lib/bike-counts.ts.
 */
export function bookingRiders(b: BookingRecord): RiderView[] {
  const rider = (key: string, label: string, name: string, bike: string | null | undefined, height: number | null | undefined): RiderView => ({
    key,
    label,
    name,
    bike: bikeLabel(bike),
    height: height ? `${height}"` : 'Size missing',
    // A rented bike has to be fitted: without a height there is nothing to fit.
    needsSize: (bike ?? 'none') !== 'none' && !height,
  });
  return [
    rider('lead', 'Lead rider', b.customer_name || 'Customer', b.bike_rental, b.rider_height_inches),
    ...(b.participant_info ?? []).map((p, i) =>
      rider(`rider-${i + 2}`, `Rider ${i + 2}`, p.name || 'Name not given', p.bike_rental ?? b.bike_rental, p.height_inches),
    ),
  ];
}

/** "2 Regular bike · 1 E-bike". */
export function bikeMix(riders: readonly RiderView[]): string {
  const counts = new Map<string, number>();
  for (const r of riders) counts.set(r.bike, (counts.get(r.bike) ?? 0) + 1);
  return [...counts].map(([bike, n]) => `${n} ${bike}`).join(' · ');
}

// ─── The row of the list ────────────────────────────────────────────────────

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const trailLabel = (trail: string) => (trail === 'mtb' ? 'MTB' : 'Paved');

function tourWhen(b: Pick<BookingRecord, 'date' | 'time_slot'>): string {
  return `${formatFloridaCalendarDate(b.date)}${b.time_slot ? ` · ${formatTourTime(b.time_slot)}` : ''}`;
}

/** "Paid in full", "$225.00 paid · $225.00 due", "$50.00 refunded"… from the one money module. */
export function paymentLine(b: BookingRecord): string {
  const collected = netCollectedCents(b);
  if (b.status === 'refunded') return b.refunded_cents ? `${formatPrice(b.refunded_cents)} refunded` : 'Refunded';
  if (b.status === 'cancelled') return collected > 0 ? `${formatPrice(collected)} collected` : 'Nothing collected';
  const due = Math.max(0, bookingTotalCents(b) - collected);
  if (due === 0) return 'Paid in full';
  return collected > 0 ? `${formatPrice(collected)} paid · ${formatPrice(due)} due` : `${formatPrice(due)} due`;
}

/**
 * What needs the operator on a booking. Past the tour (completed, cancelled,
 * refunded) only a failed charge still matters.
 */
export function bookingFlags(b: BookingRecord, waiverCount: number): StatusMeta[] {
  const flags: StatusMeta[] = [];
  if (isFailedCharge(b)) flags.push(FAILED_CHARGE);
  if (b.status !== 'confirmed') return flags;
  if (b.cal_booking_status === 'failed') flags.push(CAL_STATUS.failed);
  if (b.webhook_sent === false) flags.push(CONFIRMATION_EMAIL.notSent);
  if (bookingRiders(b).some((r) => r.needsSize)) flags.push(SIZING_STATUS.missing);
  if (waiverCount === 0) flags.push(WAIVER_STATUS.missing);
  return flags;
}

export type BookingRow = {
  id: string;
  customer: string;
  email: string | null;
  when: string;
  location: string | null;
  tour: string;
  total: string;
  payment: string;
  status: StatusMeta;
  flags: StatusMeta[];
};

export function toBookingRow(b: BookingRecord, waiverCount: number): BookingRow {
  const riders = b.participant_count ?? bookingRiders(b).length;
  return {
    id: b.id,
    customer: b.customer_name || 'Customer',
    email: b.customer_email,
    when: tourWhen(b),
    location: b.location_name,
    tour: [trailLabel(b.trail_type), b.duration_hours ? `${b.duration_hours}h` : null, plural(riders, 'rider')].filter(Boolean).join(' · '),
    total: formatPrice(bookingTotalCents(b)),
    payment: paymentLine(b),
    status: resolveStatus(BOOKING_STATUS, b.status),
    flags: bookingFlags(b, waiverCount),
  };
}

// ─── The quick view of the drawer ───────────────────────────────────────────

export type Fact = { label: string; value: string };

export type FollowThrough = { key: string; label: string; meta: StatusMeta; detail: string | null };

export type WaiverView = {
  id: string;
  signer: string;
  coverage: string;
  signedAt: string;
  pdfUrl: string | null;
  signatureUrl: string | null;
};

/**
 * What the drawer offers on a booking, each where the API would accept it (the
 * route checks again: this only hides a button that would be refused).
 */
export type BookingActions = {
  /** The booking's status, for the status menu. */
  status: string;
  /** A failed balance charge on the saved card, and its amount. */
  retryCharge: { amount: string } | null;
  /** A confirmed tour with no Cal.com event blocking its slot. */
  retryCalendar: boolean;
  /** Confirmed tours only; "resend" once it went out. */
  confirmationEmail: { mode: 'send' | 'resend'; to: string | null } | null;
  /** A completed tour whose review request is still running. */
  markReview: { enrollmentId: string } | null;
};

export const STATUS_CHOICES = ['confirmed', 'completed', 'cancelled', 'refunded'] as const;

export function bookingActions(b: BookingRecord, review: ReviewEnrollment | null): BookingActions {
  const confirmed = b.status === 'confirmed';
  return {
    status: b.status,
    // /api/admin/retry-charge needs the deposit's saved card and a failed balance.
    retryCharge:
      isFailedCharge(b) && b.deposit_payment_status === 'paid' && b.remaining_balance_amount
        ? { amount: formatPrice(b.remaining_balance_amount) }
        : null,
    retryCalendar: confirmed && b.cal_booking_status !== 'created',
    confirmationEmail: confirmed ? { mode: b.webhook_sent ? 'resend' : 'send', to: b.customer_email } : null,
    // markReviewRequestReceived() only moves an active or completed request.
    markReview:
      b.status === 'completed' && review && (review.status === 'active' || review.status === 'completed')
        ? { enrollmentId: review.id }
        : null,
  };
}

/**
 * The bookings views of /admin moved to /admin/bookings (phase 2, step 3b):
 * where an old `/admin?status=…` link goes now, or null if it isn't one.
 */
export function legacyBookingsUrl(status: string | string[] | undefined): string | null {
  const value = single(status);
  if (value === 'all') return '/admin/bookings';
  return value && (STATUS_CHOICES as readonly string[]).includes(value) ? `/admin/bookings?status=${value}` : null;
}

export type BookingDetailView = {
  id: string;
  customer: string;
  actions: BookingActions;
  status: StatusMeta;
  flags: StatusMeta[];
  tour: Fact[];
  contact: { email: string | null; phone: string | null; facts: Fact[] };
  riders: RiderView[];
  bikeMix: string;
  sizing: StatusMeta;
  payment: Fact[];
  balance: StatusMeta | null;
  followThrough: FollowThrough[];
  waivers: WaiverView[];
  waiverStatus: StatusMeta;
};

/** The calendar date of an ISO instant as stored (UTC). remaining_balance_due_at is midnight UTC of the charge day. */
const isoDay = (iso: string) => formatFloridaCalendarDate(iso.slice(0, 10));

function attribution(b: BookingRecord): string | null {
  const snapshot = b.attribution_snapshot && typeof b.attribution_snapshot === 'object' ? b.attribution_snapshot : {};
  const read = (key: string) => (typeof snapshot[key] === 'string' && snapshot[key] ? (snapshot[key] as string) : null);
  const parts = [
    b.lead_id ? 'Converted lead' : null,
    read('utm_source') === 'email' ? 'Email conversion' : null,
    read('template_key') ? `Template ${read('template_key')}` : null,
    read('step_key') ? `Step ${read('step_key')}` : null,
    read('flow'),
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

function balance(b: BookingRecord): { meta: StatusMeta; fact: Fact | null } | null {
  // Only an online booking whose deposit was collected has a balance on the card.
  if (b.booking_source === 'manual' || b.deposit_payment_status !== 'paid') return null;
  const meta = resolveStatus(BALANCE_STATUS, b.remaining_balance_status ?? 'pending');
  const amount = b.remaining_balance_amount ? formatPrice(b.remaining_balance_amount) : null;
  const status = b.remaining_balance_status ?? 'pending';
  if (status === 'waived' || !amount) return { meta, fact: null };
  const when = b.remaining_balance_due_at ? isoDay(b.remaining_balance_due_at) : null;
  const value = status === 'paid' ? amount : when ? `${amount} on ${when}` : amount;
  return { meta, fact: { label: status === 'paid' ? 'Balance charged' : 'Balance charge', value } };
}

function paymentFacts(b: BookingRecord, bal: ReturnType<typeof balance>): Fact[] {
  const total = bookingTotalCents(b);
  const collected = netCollectedCents(b);
  const facts: Fact[] = [{ label: 'Total', value: formatPrice(total) }];
  if (b.discount_code) {
    const name = b.discount_label || b.discount_code;
    const pct = b.discount_percentage ? ` (${b.discount_percentage}%)` : '';
    const off = b.discount_amount_cents ? ` · ${formatPrice(b.discount_amount_cents)} off` : '';
    facts.push({ label: 'Discount', value: `${name}${pct}${off}` });
  }
  facts.push({ label: 'Collected', value: `${formatPrice(collected)}${b.booking_source === 'manual' ? ' · off-platform' : ''}` });
  if (b.refunded_cents) facts.push({ label: 'Refunded', value: formatPrice(b.refunded_cents) });
  if (b.status === 'confirmed' || b.status === 'completed') {
    const due = Math.max(0, total - collected);
    facts.push({ label: 'Still due', value: due === 0 ? 'Nothing · paid in full' : formatPrice(due) });
  }
  if (bal?.fact) facts.push(bal.fact);
  return facts;
}

function followThrough(b: BookingRecord, review: ReviewEnrollment | null): FollowThrough[] {
  const items: FollowThrough[] = [
    { key: 'calendar', label: 'Calendar', meta: resolveStatus(CAL_STATUS, b.cal_booking_status ?? 'pending'), detail: null },
  ];
  if (b.webhook_sent !== null) {
    const attempt = b.webhook_last_attempt_at
      ? `Last attempt ${formatFloridaDateTime(b.webhook_last_attempt_at)} · ${
          typeof b.webhook_last_status_code === 'number' ? `HTTP ${b.webhook_last_status_code}` : 'no response'
        }`
      : null;
    items.push({
      key: 'email',
      label: 'Confirmation email',
      meta: b.webhook_sent ? CONFIRMATION_EMAIL.sent : CONFIRMATION_EMAIL.notSent,
      detail: b.webhook_sent ? null : [attempt, b.webhook_last_error].filter(Boolean).join(' · ') || null,
    });
  }
  // The review request starts when the tour is marked completed.
  if (review || b.status === 'completed') {
    let detail: string | null = null;
    if (review?.status === 'reviewed' && review.review_left_at) {
      detail = `${formatFloridaDateTime(review.review_left_at)}${review.review_platform ? ` · ${review.review_platform}` : ''}`;
    } else if (review?.status === 'active' && review.next_step_due_at) {
      detail = `Next reminder ${formatFloridaDateTime(review.next_step_due_at)}`;
    } else if (review?.status === 'cancelled') {
      detail = review.stop_reason;
    }
    items.push({ key: 'review', label: 'Review request', meta: resolveStatus(REVIEW_STATUS, review?.status ?? 'none'), detail });
  }
  return items;
}

function toWaiverView(w: WaiverRecord): WaiverView {
  return {
    id: w.id,
    signer: w.signer_name,
    coverage:
      w.signer_role === 'participant'
        ? 'Signed for themselves'
        : `Guardian (${w.guardian_relationship ?? 'guardian'}) for ${(w.participants_covered ?? []).join(', ') || 'a minor'}`,
    signedAt: formatFloridaDateTime(w.agreed_at),
    pdfUrl: w.pdf_url,
    signatureUrl: w.signature_url,
  };
}

/** `waivers` carry signed URLs already: the loader signs them for the one booking that is open. */
export function toBookingDetail(b: BookingRecord, waivers: readonly WaiverRecord[], review: ReviewEnrollment | null): BookingDetailView {
  const riders = bookingRiders(b);
  const missing = riders.filter((r) => r.needsSize).length;
  const bal = balance(b);
  const came = attribution(b);
  const tourLine = [b.trail_type === 'mtb' ? 'Mountain bike' : 'Paved', b.duration_hours ? `${b.duration_hours}h` : null]
    .filter(Boolean)
    .join(' · ');
  return {
    id: b.id,
    customer: b.customer_name || 'Customer',
    actions: bookingActions(b, review),
    status: resolveStatus(BOOKING_STATUS, b.status),
    flags: bookingFlags(b, waivers.length),
    tour: [
      { label: 'When', value: tourWhen(b) },
      { label: 'Where', value: b.location_name || '—' },
      { label: 'Tour', value: `${tourLine} · ${plural(b.participant_count ?? riders.length, 'rider')}` },
      { label: 'Booked', value: `${formatFloridaDateTime(b.created_at)} · ${b.booking_source === 'manual' ? 'by hand' : 'online'}` },
    ],
    contact: {
      email: b.customer_email,
      phone: b.customer_phone,
      facts: [
        b.zip_code ? { label: 'ZIP', value: b.zip_code } : null,
        b.marketing_source ? { label: 'Heard about us', value: b.marketing_source } : null,
        came ? { label: 'Attribution', value: came } : null,
      ].filter((f): f is Fact => f !== null),
    },
    riders,
    bikeMix: bikeMix(riders),
    sizing: missing ? { ...SIZING_STATUS.missing, label: missing === 1 ? '1 size missing' : `${missing} sizes missing` } : SIZING_STATUS.ready,
    payment: paymentFacts(b, bal),
    balance: bal?.meta ?? null,
    followThrough: followThrough(b, review),
    waivers: waivers.map(toWaiverView),
    waiverStatus: waivers.length ? { ...WAIVER_STATUS.signed, label: plural(waivers.length, 'waiver') } : WAIVER_STATUS.missing,
  };
}

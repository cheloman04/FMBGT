// The admin pages' data, one loader per page (§4.2). Server only.
//
// A failed query THROWS: the panel's error.tsx then says the page didn't load.
// Returning [] instead would show "no gift cards yet" over a database error.
//
// The `as any` is debt: gift_cards, referral_partners, financial_event_logs and
// several bookings/leads columns are missing from types/database.ts.
// Regenerating it removes these casts.
import type { NavBadges } from '@/components/kit';
import { easternToday } from '@/lib/booking-datetime';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  BOOKING_FILTERS,
  extractWaiverStoragePath,
  groupWaivers,
  latestReviewByBooking,
  parseBookingFilter,
  searchResults,
  type BookingCounts,
  type BookingFilter,
  type BookingMatch,
  type BookingRecord,
  type ReviewEnrollment,
  type WaiverRecord,
} from './bookings';
import type { FinLogCounts, FinLogView, FinancialEventRecord } from './fin-log';
import type { GiftCardRecord } from './gift-cards';
import type { ReferralPartnerRecord } from './referrals';
import {
  computeOverview,
  pickNextBooking,
  type NextBookingRecord,
  type OverviewBooking,
  type OverviewLead,
  type OverviewStats,
} from './overview';

type Query = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [method: string]: (...args: any[]) => Query;
} & PromiseLike<{ data: unknown; error: { message: string } | null; count?: number | null }>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = (table: string): Query => (getSupabaseAdmin() as any).from(table);

async function rows<T>(label: string, query: Query): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(`[admin/${label}] ${error.message}`);
  return (data ?? []) as T[];
}

export function loadGiftCards(): Promise<GiftCardRecord[]> {
  return rows(
    'gift-cards',
    from('gift_cards')
      .select(
        'id, code, amount_cents, status, recipient_name, recipient_email, purchaser_name, notes, ' +
          'reserved_booking_id, redeemed_booking_id, redeemed_amount_cents, redeemed_at, created_by, created_at',
      )
      .order('created_at', { ascending: false }),
  );
}

export function loadReferralPartners(): Promise<ReferralPartnerRecord[]> {
  return rows(
    'referrals',
    from('referral_partners')
      .select('id, partner_name, discount_code, discount_percentage, active, uses_count, notes, created_at')
      .order('created_at', { ascending: false }),
  );
}

const FIN_LOG_LIMIT = 200;

/** Narrows a financial_event_logs query to one view of the strip. */
function inView(query: Query, view: FinLogView): Query {
  if (view === 'attention') return query.eq('requires_attention', true);
  if (view === 'critical') return query.eq('severity', 'critical');
  if (view === 'reconciliation') return query.eq('event_category', 'reconciliation');
  return query;
}

async function count(view: FinLogView): Promise<number> {
  const { count: n, error } = await inView(from('financial_event_logs').select('id', { count: 'exact', head: true }), view);
  if (error) throw new Error(`[admin/fin-log] count ${view}: ${error.message}`);
  return n ?? 0;
}

/** The newest events of one view, and the size of every view (over all events, not just the page). */
export async function loadFinancialLog(view: FinLogView): Promise<{ events: FinancialEventRecord[]; counts: FinLogCounts; limit: number }> {
  const [events, all, attention, critical, reconciliation] = await Promise.all([
    rows<FinancialEventRecord>(
      'fin-log',
      inView(from('financial_event_logs').select('*'), view).order('occurred_at', { ascending: false }).limit(FIN_LOG_LIMIT),
    ),
    count('all'),
    count('attention'),
    count('critical'),
    count('reconciliation'),
  ]);
  return { events, counts: { all, attention, critical, reconciliation }, limit: FIN_LOG_LIMIT };
}

// ─── Overview (/admin) ──────────────────────────────────────────────────────

/**
 * Leads whose bookings show a payment signal (confirmed, a deposit, a saved
 * card…). A lead can be converted without its own row saying so: the booking
 * flow marks the booking, not always the lead.
 */
export async function loadLeadsWithPaymentSignal(leadIds: readonly string[]): Promise<Set<string>> {
  if (leadIds.length === 0) return new Set();
  const bookings = await rows<Record<string, string | null> & { lead_id: string | null }>(
    'overview',
    from('bookings')
      .select(
        'lead_id, status, deposit_payment_status, remaining_balance_status, stripe_session_id, stripe_customer_id, ' +
          'stripe_payment_method_id, stripe_payment_intent_id, deposit_payment_intent_id, remaining_balance_payment_intent_id',
      )
      .in('lead_id', leadIds),
  );
  const signal = (b: Record<string, string | null>) =>
    b.status === 'confirmed' ||
    b.status === 'completed' ||
    b.status === 'refunded' ||
    b.deposit_payment_status === 'paid' ||
    ['pending', 'paid', 'failed'].includes(b.remaining_balance_status ?? '') ||
    !!(b.stripe_session_id || b.stripe_customer_id || b.stripe_payment_method_id || b.stripe_payment_intent_id) ||
    !!(b.deposit_payment_intent_id || b.remaining_balance_payment_intent_id);
  return new Set(bookings.filter((b) => b.lead_id && signal(b)).map((b) => b.lead_id as string));
}

const MONEY_COLUMNS =
  'status, booking_source, total_price, total_after_discount_cents, deposit_paid_cents, deposit_payment_status, ' +
  'remaining_balance_amount, remaining_balance_status, extra_paid_cents, refunded_cents, stripe_payment_method_id';

export async function loadOverview(): Promise<OverviewStats> {
  const [bookings, leads] = await Promise.all([
    rows<OverviewBooking>('overview', from('bookings').select(MONEY_COLUMNS).is('deleted_at', null)),
    rows<OverviewLead>('overview', from('leads').select('id, status, booking_id, converted_at')),
  ]);
  const withSignal = await loadLeadsWithPaymentSignal(leads.map((l) => l.id));
  return computeOverview(bookings, leads, withSignal);
}

/** The next confirmed tour that hasn't started yet, or null. */
export async function loadNextBooking(now: Date = new Date()): Promise<{ booking: NextBookingRecord; today: string } | null> {
  const today = easternToday(now);
  const candidates = await rows<Omit<NextBookingRecord, 'customer_name' | 'location_name'> & { customer_id: string | null; location_id: string | null }>(
    'overview',
    from('bookings')
      .select(`id, date, time_slot, trail_type, duration_hours, participant_count, customer_id, location_id, ${MONEY_COLUMNS}`)
      .is('deleted_at', null)
      .eq('status', 'confirmed')
      .gte('date', today)
      .order('date', { ascending: true })
      .order('time_slot', { ascending: true })
      .limit(20),
  );
  const next = pickNextBooking(candidates, now);
  if (!next) return null;
  const [customers, locations] = await Promise.all([
    next.customer_id ? rows<{ name: string | null }>('overview', from('customers').select('name').eq('id', next.customer_id)) : [],
    next.location_id ? rows<{ name: string | null }>('overview', from('locations').select('name').eq('id', next.location_id)) : [],
  ]);
  return {
    booking: { ...next, customer_name: customers[0]?.name ?? null, location_name: locations[0]?.name ?? null },
    today,
  };
}

// ─── Bookings (/admin/bookings) ─────────────────────────────────────────────

const BOOKING_COLUMNS =
  'id, lead_id, booking_source, trail_type, date, time_slot, duration_hours, bike_rental, rider_height_inches, ' +
  'participant_count, participant_info, total_price, status, created_at, location_id, customer_id, waiver_session_id, ' +
  'zip_code, marketing_source, attribution_snapshot, deposit_amount, deposit_paid_cents, deposit_payment_status, ' +
  'remaining_balance_amount, remaining_balance_due_at, remaining_balance_status, stripe_payment_method_id, ' +
  'extra_paid_cents, refunded_cents, cal_booking_status, webhook_sent, webhook_last_attempt_at, ' +
  'webhook_last_status_code, webhook_last_error, discount_code, discount_label, discount_percentage, ' +
  'discount_amount_cents, subtotal_before_discount_cents, total_after_discount_cents';
const BOOKING_SELECT = `${BOOKING_COLUMNS}, customers(name, email, phone), locations(name)`;

const WAIVER_COLUMNS =
  'id, booking_id, session_id, signer_name, signer_role, participants_covered, agreed_at, pdf_url, signature_url, guardian_relationship';

const REVIEW_COLUMNS =
  'id, booking_id, status, enrolled_at, next_step_due_at, review_left_at, review_platform, completed_at, cancelled_at, ' +
  'stop_reason, created_at, updated_at';

type JoinedBooking = Omit<BookingRecord, 'customer_name' | 'customer_email' | 'customer_phone' | 'location_name'> & {
  customers: { name: string | null; email: string | null; phone: string | null } | null;
  locations: { name: string | null } | null;
};

function toRecord({ customers, locations, ...row }: JoinedBooking): BookingRecord {
  return {
    ...row,
    participant_info: Array.isArray(row.participant_info) ? row.participant_info : null,
    customer_name: customers?.name ?? null,
    customer_email: customers?.email ?? null,
    customer_phone: customers?.phone ?? null,
    location_name: locations?.name ?? null,
  };
}

/** Real bookings: not archived, and past checkout (`pending` never paid). */
const realBookings = (columns: string, options?: Record<string, unknown>): Query =>
  from('bookings').select(columns, options).is('deleted_at', null).neq('status', 'pending');

function inFilter(query: Query, filter: BookingFilter): Query {
  if (filter === 'all') return query;
  // Same rule as isFailedCharge() in ./bookings.ts.
  if (filter === 'failed') return query.eq('remaining_balance_status', 'failed').in('status', ['confirmed', 'completed']);
  return query.eq('status', filter);
}

async function countBookings(filter: BookingFilter): Promise<number> {
  const { count: n, error } = await inFilter(realBookings('id', { count: 'exact', head: true }), filter);
  if (error) throw new Error(`[admin/bookings] count ${filter}: ${error.message}`);
  return n ?? 0;
}

async function countEveryFilter(): Promise<BookingCounts> {
  const counts = await Promise.all(BOOKING_FILTERS.map(countBookings));
  return Object.fromEntries(BOOKING_FILTERS.map((f, i) => [f, counts[i]])) as BookingCounts;
}

/** The first `limit` bookings of a filter, newest tour date first, and how many there are. */
async function bookingsPage(filter: BookingFilter, limit: number): Promise<{ records: BookingRecord[]; total: number }> {
  const { data, error, count: total } = await inFilter(realBookings(BOOKING_SELECT, { count: 'exact' }), filter)
    .order('date', { ascending: false })
    .order('time_slot', { ascending: false })
    .range(0, limit - 1);
  if (error) throw new Error(`[admin/bookings] ${error.message}`);
  return { records: ((data ?? []) as JoinedBooking[]).map(toRecord), total: total ?? 0 };
}

/**
 * The search, in the database (§8.4: filtering the first 100 rows in the browser
 * misses the rest without saying so). PostgREST can't OR across a booking and
 * its customer, so it runs three queries and ./bookings.ts joins them. Each one
 * returns up to 1,000 matches (PostgREST's cap), years away at FMBGT's volume.
 */
async function searchBookings(
  filter: BookingFilter,
  q: string,
  limit: number,
): Promise<{ records: BookingRecord[]; total: number; counts: BookingCounts }> {
  // Quoted: the value may hold `.` or `:` (an email, a time), which a logic tree reads as syntax.
  const like = `"%${q}%"`;
  const MATCH = 'id, status, date, time_slot, remaining_balance_status';
  const matches = (
    await Promise.all([
      rows<BookingMatch>(
        'bookings',
        realBookings(`${MATCH}, customers!inner(name)`).or(`name.ilike.${like},email.ilike.${like},phone.ilike.${like}`, {
          referencedTable: 'customers',
        }),
      ),
      rows<BookingMatch>('bookings', realBookings(`${MATCH}, locations!inner(name)`).ilike('locations.name', `%${q}%`)),
      rows<BookingMatch>(
        'bookings',
        realBookings(MATCH).or(['zip_code', 'marketing_source', 'discount_code', 'trail_type'].map((c) => `${c}.ilike.${like}`).join(',')),
      ),
    ])
  ).flat();

  const { ids, total, counts } = searchResults(matches, filter, limit);
  if (ids.length === 0) return { records: [], total, counts };
  const found = await rows<JoinedBooking>('bookings', from('bookings').select(BOOKING_SELECT).in('id', ids));
  const byId = new Map(found.map((row) => [row.id, toRecord(row)]));
  return { records: ids.flatMap((id) => byId.get(id) ?? []), total, counts };
}

/** The waivers of some bookings: filed under the booking, or under its checkout session. */
async function loadWaivers<W extends Pick<WaiverRecord, 'booking_id' | 'session_id'>>(
  bookings: readonly Pick<BookingRecord, 'id' | 'waiver_session_id'>[],
  columns: string,
): Promise<W[]> {
  if (bookings.length === 0) return [];
  const ids = bookings.map((b) => b.id).join(',');
  const sessions = [...new Set(bookings.map((b) => b.waiver_session_id).filter(Boolean))].join(',');
  const filter = sessions ? `booking_id.in.(${ids}),session_id.in.(${sessions})` : `booking_id.in.(${ids})`;
  return rows<W>('bookings', from('waiver_records').select(columns).or(filter).order('agreed_at', { ascending: true }));
}

/** The waiver PDFs and signatures live in a private bucket: a link is a signed URL, valid for a day. */
async function signedWaiverUrl(pathOrUrl: string | null): Promise<string | null> {
  const path = extractWaiverStoragePath(pathOrUrl);
  if (!path) return null;
  const { data, error } = await getSupabaseAdmin().storage.from('waivers').createSignedUrl(path, 60 * 60 * 24);
  if (error) {
    // A missing file shouldn't take the page down: the waiver shows without its link.
    console.error('[admin/bookings] Failed to sign a waiver URL:', error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

function signWaivers(waivers: readonly WaiverRecord[]): Promise<WaiverRecord[]> {
  return Promise.all(
    waivers.map(async (w) => ({ ...w, pdf_url: await signedWaiverUrl(w.pdf_url), signature_url: await signedWaiverUrl(w.signature_url) })),
  );
}

async function loadReviews(bookingIds: readonly string[]): Promise<Map<string, ReviewEnrollment>> {
  if (bookingIds.length === 0) return new Map();
  const enrollments = await rows<ReviewEnrollment>(
    'bookings',
    from('booking_review_request_enrollments').select(REVIEW_COLUMNS).in('booking_id', bookingIds).order('created_at', { ascending: false }),
  );
  return latestReviewByBooking(enrollments);
}

export type BookingList = {
  records: BookingRecord[];
  /** Rows of the active filter (and search), not just the ones loaded. */
  total: number;
  /** Every filter's size, over the search when there is one. */
  counts: BookingCounts;
  /** Signed waivers per booking, for the "No waivers" flag. */
  waiverCounts: Map<string, number>;
};

export async function loadBookingList({ filter, q, limit }: { filter: BookingFilter; q: string; limit: number }): Promise<BookingList> {
  const { records, total, counts } = q
    ? await searchBookings(filter, q, limit)
    : await Promise.all([bookingsPage(filter, limit), countEveryFilter()]).then(([page, all]) => ({ ...page, counts: all }));
  const waivers = groupWaivers(records, await loadWaivers<Pick<WaiverRecord, 'booking_id' | 'session_id'>>(records, 'booking_id, session_id'));
  return { records, total, counts, waiverCounts: new Map([...waivers].map(([id, list]) => [id, list.length])) };
}

/** One booking for the drawer, with its waivers' signed links and its review request. Null if it doesn't exist or was archived. */
export async function loadBookingDetail(
  id: string,
): Promise<{ record: BookingRecord; waivers: WaiverRecord[]; review: ReviewEnrollment | null } | null> {
  const found = await rows<JoinedBooking>('bookings', from('bookings').select(BOOKING_SELECT).eq('id', id).is('deleted_at', null).limit(1));
  if (!found[0]) return null;
  const record = toRecord(found[0]);
  const [waivers, reviews] = await Promise.all([loadWaivers<WaiverRecord>([record], WAIVER_COLUMNS), loadReviews([id])]);
  return { record, waivers: await signWaivers(groupWaivers([record], waivers).get(id) ?? []), review: reviews.get(id) ?? null };
}

/**
 * The legacy list on /admin, in the shape AdminClient reads: the newest 100,
 * every waiver signed, the latest review request.
 * TEMPORARY — it goes away with that list in phase 2, step 3b-2.
 */
export async function loadLegacyBookings(status: string | undefined) {
  const { records } = await bookingsPage(parseBookingFilter(status), 100);
  const [waivers, reviews] = await Promise.all([
    loadWaivers<WaiverRecord>(records, WAIVER_COLUMNS).then(signWaivers),
    loadReviews(records.map((r) => r.id)),
  ]);
  const byBooking = groupWaivers(records, waivers);
  return records.map((r) => ({
    ...r,
    // AdminClient's types say these are never null.
    time_slot: r.time_slot ?? '',
    duration_hours: r.duration_hours ?? 0,
    bike_rental: r.bike_rental ?? 'none',
    participant_info: r.participant_info as { name: string; bike_rental?: string; height_inches?: number }[] | null,
    location_name: r.location_name ?? '—',
    customer_name: r.customer_name ?? '—',
    customer_email: r.customer_email ?? '—',
    waiver_records: (byBooking.get(r.id) ?? []).map((w) => ({ ...w, participants_covered: w.participants_covered ?? [] })),
    review_request_enrollment: reviews.get(r.id) ?? null,
  }));
}

// ─── The menu's badges (§5.3) ───────────────────────────────────────────────

/** Seeded by the panel layout and refreshed through /api/admin/badges. */
export async function loadNavBadges(): Promise<NavBadges> {
  return { bookings: { count: await countBookings('failed'), tone: 'red' } };
}

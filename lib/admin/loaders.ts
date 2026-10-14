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
  searchResults,
  type BookingCounts,
  type BookingFilter,
  type BookingMatch,
  type BookingRecord,
  type ReviewEnrollment,
  type WaiverRecord,
} from './bookings';
import type { FinLogCounts, FinLogView, FinancialEventRecord } from './fin-log';
import {
  LEAD_VIEWS,
  hotSince,
  latestEnrollmentByLead,
  stepsByEnrollment,
  type FollowUpEnrollment,
  type FollowUpStep,
  type LeadCounts,
  type LeadRecord,
  type LeadView,
} from './leads';
import { ilikeAny } from './params';
import type { TrashedBookingRecord, TrashedLeadRecord } from './trash';
import type { FormLocation } from './booking-form';
import type { BookingPageRecord, HistoryRecord } from './booking-page';
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
  const bookings = await rows<SignalRow>('overview', from('bookings').select(SIGNAL_COLUMNS).in('lead_id', leadIds));
  return new Set(bookings.filter((b) => b.lead_id && hasPaymentSignal(b)).map((b) => b.lead_id as string));
}

const SIGNAL_COLUMNS =
  'lead_id, status, deposit_payment_status, remaining_balance_status, stripe_session_id, stripe_customer_id, ' +
  'stripe_payment_method_id, stripe_payment_intent_id, deposit_payment_intent_id, remaining_balance_payment_intent_id';

type SignalRow = Record<string, string | null> & { lead_id: string | null };

const hasPaymentSignal = (b: Record<string, string | null>) =>
  b.status === 'confirmed' ||
  b.status === 'completed' ||
  b.status === 'refunded' ||
  b.deposit_payment_status === 'paid' ||
  ['pending', 'paid', 'failed'].includes(b.remaining_balance_status ?? '') ||
  !!(b.stripe_session_id || b.stripe_customer_id || b.stripe_payment_method_id || b.stripe_payment_intent_id) ||
  !!(b.deposit_payment_intent_id || b.remaining_balance_payment_intent_id);

const MONEY_COLUMNS =
  'status, booking_source, total_price, total_after_discount_cents, deposit_paid_cents, deposit_payment_status, ' +
  'remaining_balance_amount, remaining_balance_status, extra_paid_cents, refunded_cents, stripe_payment_method_id';

export async function loadOverview(): Promise<OverviewStats> {
  const [bookings, leads] = await Promise.all([
    rows<OverviewBooking>('overview', from('bookings').select(MONEY_COLUMNS).is('deleted_at', null)),
    // Not the archived (Trash): the same leads the Leads page counts.
    rows<OverviewLead>('overview', from('leads').select('id, status, booking_id, converted_at').is('deleted_at', null)),
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
  const MATCH = 'id, status, date, time_slot, remaining_balance_status';
  const matches = (
    await Promise.all([
      rows<BookingMatch>(
        'bookings',
        realBookings(`${MATCH}, customers!inner(name)`).or(ilikeAny(['name', 'email', 'phone'], q), { referencedTable: 'customers' }),
      ),
      rows<BookingMatch>('bookings', realBookings(`${MATCH}, locations!inner(name)`).ilike('locations.name', `%${q}%`)),
      rows<BookingMatch>(
        'bookings',
        realBookings(MATCH).or(ilikeAny(['zip_code', 'marketing_source', 'discount_code', 'trail_type'], q)),
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

// ─── One booking (/admin/bookings/[id] and its edit page) ───────────────────

const BOOKING_PAGE_SELECT = `${BOOKING_COLUMNS}, skill_level, addons, payment_method, admin_notes, waiver_accepted, waiver_link_token, customers(name, email, phone), locations(name)`;

type JoinedPageBooking = Omit<BookingPageRecord, 'customer_name' | 'customer_email' | 'customer_phone' | 'location_name'> &
  Pick<JoinedBooking, 'customers' | 'locations'>;

/** A booking that isn't archived, as its page and the edit form read it; null if there is none. */
async function bookingPageRecord(id: string): Promise<BookingPageRecord | null> {
  const found = await rows<JoinedPageBooking>(
    'booking',
    from('bookings').select(BOOKING_PAGE_SELECT).eq('id', id).is('deleted_at', null).limit(1),
  );
  // toRecord() keeps the extra columns: it only flattens the customer and the location.
  return found[0] ? (toRecord(found[0]) as BookingPageRecord) : null;
}

/** The booking, its signed waivers, its review request and its last 50 Financial log events. */
export async function loadBookingPage(
  id: string,
): Promise<{ record: BookingPageRecord; waivers: WaiverRecord[]; review: ReviewEnrollment | null; history: HistoryRecord[] } | null> {
  const record = await bookingPageRecord(id);
  if (!record) return null;
  const [waivers, reviews, history] = await Promise.all([
    loadWaivers<WaiverRecord>([record], WAIVER_COLUMNS),
    loadReviews([id]),
    rows<HistoryRecord>(
      'booking',
      from('financial_event_logs')
        .select('id, event_name, message, amount, occurred_at')
        .eq('booking_id', id)
        .order('occurred_at', { ascending: false })
        .limit(50),
    ),
  ]);
  return { record, waivers: await signWaivers(groupWaivers([record], waivers).get(id) ?? []), review: reviews.get(id) ?? null, history };
}

/** The booking to edit and the locations it can move to (active, same kind of tour). */
export async function loadBookingForEdit(id: string): Promise<{ record: BookingPageRecord; locations: FormLocation[] } | null> {
  const record = await bookingPageRecord(id);
  if (!record) return null;
  const locations = await rows<FormLocation>(
    'booking',
    from('locations').select('id, name, tour_type, skill_levels').eq('active', true).eq('tour_type', record.trail_type).order('name'),
  );
  return { record, locations };
}

// ─── Leads (/admin/leads) ───────────────────────────────────────────────────

const LEAD_COLUMNS =
  'id, full_name, email, phone, zip_code, heard_about_us, selected_trail_type, selected_skill_level, ' +
  'selected_location_name, selected_bike, selected_date, selected_time_slot, selected_duration_hours, ' +
  'utm_source, utm_medium, utm_campaign, utm_content, utm_term, last_step_completed, last_activity_at, ' +
  'status, created_at, booking_id, converted_at, lost_at';

const ENROLLMENT_COLUMNS = 'id, lead_id, status, enrolled_at, next_step_due_at, lost_at, stop_reason, webhook_triggered_at';
const STEP_COLUMNS = 'id, enrollment_id, step_number, step_key, scheduled_for, sent_at, status, skip_reason';

const LEAD_SEARCH = [
  'full_name',
  'email',
  'phone',
  'zip_code',
  'heard_about_us',
  'utm_source',
  'utm_campaign',
  'selected_location_name',
  'selected_trail_type',
] as const;

/**
 * The leads a payment on one of their bookings converted although their own row
 * doesn't say so. The list leaves them out IN the query, so its pages and counts
 * are right (the legacy list dropped them after fetching 100, and came up short).
 *
 * Only the leads still open or lost and unmarked (an inner join + filters on the
 * embedded row): the ones already marked converted are excluded by their own
 * columns, so this list stays a handful and the `not.in.(…)` URL stays short.
 *
 * 🪤 bookings and leads point at each other (bookings.lead_id, leads.booking_id):
 * the embed names its foreign key column (`leads!lead_id`) or PostgREST refuses
 * it as ambiguous.
 */
async function loadConvertedLeadIds(): Promise<string[]> {
  const bookings = await rows<SignalRow>(
    'leads',
    from('bookings')
      .select(`${SIGNAL_COLUMNS}, lead:leads!lead_id!inner(id)`)
      .in('lead.status', ['lead', 'lost'])
      .is('lead.booking_id', null)
      .is('lead.converted_at', null)
      .is('lead.deleted_at', null),
  );
  return [...new Set(bookings.filter(hasPaymentSignal).map((b) => b.lead_id as string))];
}

async function loadFollowingLeadIds(): Promise<string[]> {
  const enrollments = await rows<{ lead_id: string }>('leads', from('lead_followup_enrollments').select('lead_id').eq('status', 'active'));
  return [...new Set(enrollments.map((e) => e.lead_id))];
}

type LeadScope = { converted: string[]; following: string[]; hotSince: string; q: string };

/** A lead the admin works: not archived and not converted by any signal; matching the search. */
function workableLeads(columns: string, scope: LeadScope, options?: Record<string, unknown>): Query {
  let query = from('leads').select(columns, options).is('deleted_at', null).is('booking_id', null).is('converted_at', null);
  if (scope.converted.length) query = query.not('id', 'in', `(${scope.converted.join(',')})`);
  if (scope.q) query = query.or(ilikeAny(LEAD_SEARCH, scope.q));
  return query;
}

/** Narrows to one view. Null when the view is empty by definition (no follow-up running). */
function inLeadView(query: Query, view: LeadView, scope: LeadScope): Query | null {
  if (view === 'lost') return query.eq('status', 'lost');
  const open = query.eq('status', 'lead');
  if (view === 'hot') return open.gte('last_activity_at', scope.hotSince);
  if (view === 'following') return scope.following.length ? open.in('id', scope.following) : null;
  return open;
}

async function leadScope(q: string, now: Date): Promise<LeadScope> {
  const [converted, following] = await Promise.all([loadConvertedLeadIds(), loadFollowingLeadIds()]);
  return { converted, following, hotSince: hotSince(now), q };
}

async function countLeads(view: LeadView, scope: LeadScope): Promise<number> {
  const query = inLeadView(workableLeads('id', scope, { count: 'exact', head: true }), view, scope);
  if (!query) return 0;
  const { count: n, error } = await query;
  if (error) throw new Error(`[admin/leads] count ${view}: ${error.message}`);
  return n ?? 0;
}

/** The latest follow-up of each lead, with its emails. */
async function loadFollowUps(leadIds: readonly string[]): Promise<{ enrollments: Map<string, FollowUpEnrollment>; steps: Map<string, FollowUpStep[]> }> {
  if (leadIds.length === 0) return { enrollments: new Map(), steps: new Map() };
  const enrollments = latestEnrollmentByLead(
    await rows<FollowUpEnrollment>(
      'leads',
      from('lead_followup_enrollments').select(ENROLLMENT_COLUMNS).in('lead_id', leadIds).order('enrolled_at', { ascending: false }),
    ),
  );
  const enrollmentIds = [...enrollments.values()].map((e) => e.id);
  const steps = enrollmentIds.length
    ? stepsByEnrollment(await rows<FollowUpStep>('leads', from('lead_followup_steps').select(STEP_COLUMNS).in('enrollment_id', enrollmentIds)))
    : new Map<string, FollowUpStep[]>();
  return { enrollments, steps };
}

export type LeadList = {
  records: LeadRecord[];
  /** Rows of the active view (and search), not just the ones loaded. */
  total: number;
  /** Every view's size, over the search when there is one. */
  counts: LeadCounts;
  enrollments: Map<string, FollowUpEnrollment>;
  steps: Map<string, FollowUpStep[]>;
};

/** One view of the leads, most recently active first. */
export async function loadLeadList({ view, q, limit, now }: { view: LeadView; q: string; limit: number; now: Date }): Promise<LeadList> {
  const scope = await leadScope(q, now);
  const pageQuery = inLeadView(workableLeads(LEAD_COLUMNS, scope, { count: 'exact' }), view, scope);
  const [page, counts] = await Promise.all([
    pageQuery
      ? pageQuery.order('last_activity_at', { ascending: false }).range(0, limit - 1)
      : Promise.resolve({ data: [], error: null, count: 0 }),
    Promise.all(LEAD_VIEWS.map((v) => countLeads(v, scope))),
  ]);
  if (page.error) throw new Error(`[admin/leads] ${page.error.message}`);
  const records = (page.data ?? []) as LeadRecord[];
  const followUps = await loadFollowUps(records.map((r) => r.id));
  return {
    records,
    total: page.count ?? 0,
    counts: Object.fromEntries(LEAD_VIEWS.map((v, i) => [v, counts[i]])) as LeadCounts,
    ...followUps,
  };
}

/** One lead for the drawer, whatever its state (a link may point at a converted one). Null if it doesn't exist or was archived. */
export async function loadLeadDetail(id: string): Promise<{ lead: LeadRecord; enrollment: FollowUpEnrollment | null; steps: FollowUpStep[] } | null> {
  const found = await rows<LeadRecord>('leads', from('leads').select(LEAD_COLUMNS).eq('id', id).is('deleted_at', null).limit(1));
  const lead = found[0];
  if (!lead) return null;
  const { enrollments, steps } = await loadFollowUps([id]);
  const enrollment = enrollments.get(id) ?? null;
  return { lead, enrollment, steps: enrollment ? steps.get(enrollment.id) ?? [] : [] };
}

// ─── Trash (/admin/trash) ───────────────────────────────────────────────────

/** The first `limit` archived rows of a table, most recently archived first, and how many there are. */
async function archived<T>(table: string, columns: string, limit: number): Promise<{ records: T[]; total: number }> {
  const { data, error, count: total } = await from(table)
    .select(columns, { count: 'exact' })
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    // A tie-break, so "Load more" never shows a row twice or skips one.
    .order('id', { ascending: true })
    .range(0, limit - 1);
  if (error) throw new Error(`[admin/trash] ${table}: ${error.message}`);
  return { records: (data ?? []) as T[], total: total ?? 0 };
}

const TRASHED_BOOKING_COLUMNS =
  'id, status, date, time_slot, booking_source, total_price, total_after_discount_cents, deposit_paid_cents, ' +
  'deposit_payment_status, remaining_balance_amount, remaining_balance_status, extra_paid_cents, refunded_cents, ' +
  'stripe_payment_method_id, deleted_at, deleted_by, customers(name), locations(name)';

export async function loadTrashedBookings(limit: number): Promise<{ records: TrashedBookingRecord[]; total: number }> {
  const { records, total } = await archived<
    Omit<TrashedBookingRecord, 'customer_name' | 'location_name'> & {
      customers: { name: string | null } | null;
      locations: { name: string | null } | null;
    }
  >('bookings', TRASHED_BOOKING_COLUMNS, limit);
  return {
    records: records.map(({ customers, locations, ...b }) => ({
      ...b,
      customer_name: customers?.name ?? null,
      location_name: locations?.name ?? null,
    })),
    total,
  };
}

/** The archived leads, and which of them a payment on one of their bookings converted. */
export async function loadTrashedLeads(limit: number): Promise<{ records: TrashedLeadRecord[]; total: number; withPaidBooking: Set<string> }> {
  const { records, total } = await archived<TrashedLeadRecord>(
    'leads',
    'id, full_name, email, selected_trail_type, selected_location_name, status, booking_id, converted_at, lost_at, deleted_at, deleted_by',
    limit,
  );
  return { records, total, withPaidBooking: await loadLeadsWithPaymentSignal(records.map((l) => l.id)) };
}

// ─── The menu's badges (§5.3) ───────────────────────────────────────────────

/** Seeded by the panel layout and refreshed through /api/admin/badges. */
export async function loadNavBadges(now: Date = new Date()): Promise<NavBadges> {
  const [failed, hot] = await Promise.all([countBookings('failed'), leadScope('', now).then((scope) => countLeads('hot', scope))]);
  return {
    bookings: { count: failed, tone: 'red' },
    // People in the booking flow right now: news, not a fault.
    leads: { count: hot, tone: 'accent' },
  };
}

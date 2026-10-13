// The admin pages' data, one loader per page (§4.2). Server only.
//
// A failed query THROWS: the panel's error.tsx then says the page didn't load.
// Returning [] instead would show "no gift cards yet" over a database error.
//
// The `as any` is debt: gift_cards, referral_partners, financial_event_logs and
// several bookings/leads columns are missing from types/database.ts.
// Regenerating it removes these casts.
import { easternToday } from '@/lib/booking-datetime';
import { getSupabaseAdmin } from '@/lib/supabase';
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

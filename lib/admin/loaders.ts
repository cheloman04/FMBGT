// The admin pages' data, one loader per page (§4.2). Server only.
//
// A failed query THROWS: the panel's error.tsx then says the page didn't load.
// Returning [] instead would show "no gift cards yet" over a database error.
//
// The `as any` is debt: gift_cards, referral_partners and financial_event_logs
// are missing from types/database.ts. Regenerating it removes these casts.
import { getSupabaseAdmin } from '@/lib/supabase';
import type { FinLogCounts, FinLogView, FinancialEventRecord } from './fin-log';
import type { GiftCardRecord } from './gift-cards';
import type { ReferralPartnerRecord } from './referrals';

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

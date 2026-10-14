// Lead → booking conversion, shared by every path that confirms a booking: the
// Stripe webhook (deposit paid), lib/free-booking.ts (fully covered by a gift
// card) and the admin's manual (cash) bookings. A converted lead leaves the open
// leads, counts as a conversion and gets no more "finish your booking" emails.

import { getSupabaseAdmin } from '@/lib/supabase';
import { cancelActiveFollowUpForConversion } from '@/lib/lead-followup';

/** Lead statuses a booking can still convert: a 'lost' lead who books comes back. */
export const CONVERTIBLE_LEAD_STATUSES = ['lead', 'lost'] as const;

export const LEAD_CANDIDATE_COLUMNS =
  'id, full_name, email, status, booking_id, converted_at, deleted_at, last_activity_at, created_at';

export type LeadCandidate = {
  id: string;
  full_name?: string | null;
  email: string | null;
  status: string | null;
  booking_id: string | null;
  converted_at: string | null;
  deleted_at: string | null;
  last_activity_at: string | null;
  created_at: string | null;
};

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

/** Escapes LIKE wildcards so an email only matches itself (`_` is common in emails). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Not archived and not converted by any of its own columns. */
export function isOpenLead(lead: LeadCandidate): boolean {
  return (
    !lead.deleted_at &&
    !lead.booking_id &&
    !lead.converted_at &&
    (CONVERTIBLE_LEAD_STATUSES as readonly (string | null)[]).includes(lead.status)
  );
}

/** Last activity (or creation) in ms; 0 when unknown, so those sort last. */
function activityMs(lead: LeadCandidate): number {
  const ms = Date.parse(lead.last_activity_at ?? lead.created_at ?? '');
  return Number.isNaN(ms) ? 0 : ms;
}

/** The open leads of this email (case-insensitive), most recently active first. */
export function openLeadsForEmail(leads: readonly LeadCandidate[], email: string | null | undefined): LeadCandidate[] {
  const wanted = normalizeEmail(email);
  if (!wanted) return [];
  return leads
    .filter((lead) => normalizeEmail(lead.email) === wanted && isOpenLead(lead))
    .sort((a, b) => activityMs(b) - activityMs(a));
}

/**
 * The open leads of a customer email, most recently active first. Empty on a
 * lookup error: a booking must never fail because its lead couldn't be found.
 */
export async function findOpenLeadsByEmail(email: string): Promise<LeadCandidate[]> {
  const normalized = normalizeEmail(email);
  if (!normalized) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (getSupabaseAdmin() as any)
    .from('leads')
    .select(LEAD_CANDIDATE_COLUMNS)
    .ilike('email', escapeLike(normalized))
    .in('status', CONVERTIBLE_LEAD_STATUSES)
    .is('deleted_at', null)
    .is('booking_id', null)
    .is('converted_at', null)
    .order('last_activity_at', { ascending: false })
    .limit(20);
  if (error) {
    console.error('[lead-conversion] open lead lookup failed:', error.message);
    return [];
  }
  return openLeadsForEmail((data ?? []) as LeadCandidate[], normalized);
}

/**
 * Marks the lead converted into this booking and stops its follow-up emails.
 * Never throws: a failure is logged and the booking goes on (returns false).
 */
export async function convertLead(leadId: string, bookingId: string, opts: { source: string }): Promise<boolean> {
  const now = new Date().toISOString();
  let converted = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (getSupabaseAdmin() as any)
      .from('leads')
      .update({
        status: 'converted',
        booking_id: bookingId,
        converted_at: now,
        last_step_completed: 'booking_confirmed',
        last_activity_at: now,
        updated_at: now,
      })
      .eq('id', leadId);
    if (error) {
      console.error(`[${opts.source}] Failed to convert lead ${leadId}:`, error);
    } else {
      converted = true;
      console.log(`[${opts.source}] Lead ${leadId} converted → booking ${bookingId}`);
    }
  } catch (e) {
    console.error(`[${opts.source}] Failed to convert lead ${leadId}:`, (e as Error).message);
  }

  try {
    await cancelActiveFollowUpForConversion(leadId);
  } catch (e) {
    console.error(`[${opts.source}] Failed to stop the follow-up of lead ${leadId}:`, (e as Error).message);
  }
  return converted;
}

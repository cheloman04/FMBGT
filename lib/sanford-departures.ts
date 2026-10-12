// Seats on Sanford's shared departures (rules in lib/sanford.ts). A departure is
// the Sanford location + date + time; its seats are the riders of every active
// booking on it.

import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase';
import { SANFORD_DEPARTURE_TIME, SANFORD_MAX_RIDERS, isSanfordLocation } from '@/lib/sanford';

// A checkout that is still open holds its seats; Stripe expires the session
// (and the webhook cancels the booking) after 24 hours, so older pending rows
// are abandoned and no longer count.
const PENDING_HOLD_MS = 24 * 3_600_000;

export async function getSanfordLocationIds(): Promise<string[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('locations')
    .select('id, name')
    .eq('tour_type', 'paved');
  if (error) throw error;
  return ((data ?? []) as Array<{ id: string; name: string }>)
    .filter((location) => isSanfordLocation(location.name))
    .map((location) => location.id);
}

type SeatRow = { id: string; date: string; time_slot: string; participant_count: number | null };

async function fetchActiveSanfordBookings(filter: {
  dateFrom: string;
  dateTo: string;
  timeSlot?: string;
  excludeBookingId?: string;
}): Promise<SeatRow[]> {
  const locationIds = await getSanfordLocationIds();
  if (locationIds.length === 0) return [];

  const pendingSince = new Date(Date.now() - PENDING_HOLD_MS).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (getSupabaseAdmin() as any)
    .from('bookings')
    .select('id, date, time_slot, participant_count')
    .in('location_id', locationIds)
    .gte('date', filter.dateFrom)
    .lte('date', filter.dateTo)
    .is('deleted_at', null)
    .or(`status.eq.confirmed,and(status.eq.pending,created_at.gt.${pendingSince})`);
  if (filter.timeSlot) query = query.eq('time_slot', filter.timeSlot);
  if (filter.excludeBookingId) query = query.neq('id', filter.excludeBookingId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as SeatRow[];
}

/** Riders already on each day's 10:00 departure in [dateFrom, dateTo], keyed by date. */
export async function getSanfordRidersBooked(dateFrom: string, dateTo: string): Promise<Map<string, number>> {
  const rows = await fetchActiveSanfordBookings({ dateFrom, dateTo, timeSlot: SANFORD_DEPARTURE_TIME });
  const booked = new Map<string, number>();
  for (const row of rows) {
    booked.set(row.date, (booked.get(row.date) ?? 0) + (row.participant_count ?? 1));
  }
  return booked;
}

/** Seats still free on one departure, optionally leaving out a booking being edited. */
export async function getSanfordSeatsLeft(
  date: string,
  timeSlot: string,
  opts: { excludeBookingId?: string } = {}
): Promise<number> {
  const rows = await fetchActiveSanfordBookings({
    dateFrom: date,
    dateTo: date,
    timeSlot,
    excludeBookingId: opts.excludeBookingId,
  });
  const booked = rows.reduce((sum, row) => sum + (row.participant_count ?? 1), 0);
  return Math.max(0, SANFORD_MAX_RIDERS - booked);
}

export function sanfordSeatsMessage(seatsLeft: number, riders: number): string {
  if (seatsLeft <= 0) return 'This Sanford departure is full. Please pick another date.';
  return (
    `Only ${seatsLeft} spot${seatsLeft === 1 ? '' : 's'} left on this Sanford departure — ` +
    `not enough for ${riders} riders. Please pick another date.`
  );
}

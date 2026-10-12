// Sanford multi-booking: several groups can book the same Sanford time slot.
//
// The first group books like any other tour; Cal.com's one-booking-per-day limit
// then closes the rest of that day. Later groups "join" that tour: the booking
// calendar offers its time again (bikes permitting) and each group gets its own
// Cal.com event at the same time, created with the shared-tour flags
// (lib/cal.ts). Cancel / reschedule stay per booking.
//
// Only a CONFIRMED tour that already holds its Cal.com event can be joined. A
// pending (unpaid) checkout hasn't blocked anything in Cal.com yet, so letting
// others pile onto it could stack them on top of a different tour.

import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase';
import { allowsSharedTours } from '@/lib/cal';

export interface SharedTourSlot {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM, Eastern
}

/** Is another group's Sanford tour already on the guide's calendar at this date + time? */
export async function sharedTourExists(input: {
  locationId: string | null | undefined;
  locationName: string | null | undefined;
  date: string | null | undefined;
  time: string | null | undefined;
  excludeBookingId?: string;
}): Promise<boolean> {
  if (!allowsSharedTours(input.locationName) || !input.locationId || !input.date || !input.time) return false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (getSupabaseAdmin() as any)
    .from('bookings')
    .select('id')
    .eq('location_id', input.locationId)
    .eq('date', input.date)
    .eq('time_slot', input.time)
    .eq('status', 'confirmed')
    .eq('cal_booking_status', 'created')
    .not('cal_booking_uid', 'is', null)
    .is('deleted_at', null)
    .limit(1);
  if (input.excludeBookingId) query = query.neq('id', input.excludeBookingId);

  const { data, error } = await query;
  if (error) {
    // Falls back to a normal Cal.com create, which fails loudly if the slot is taken.
    console.error('[shared-tours] lookup failed:', error.message);
    return false;
  }
  return (data ?? []).length > 0;
}

/** Joinable Sanford tour times in [dateFrom, dateTo], for the booking calendar. */
export async function getSharedTourSlots(input: {
  locationName: string;
  dateFrom: string;
  dateTo: string;
}): Promise<SharedTourSlot[]> {
  if (!allowsSharedTours(input.locationName)) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (getSupabaseAdmin() as any)
    .from('bookings')
    .select('date, time_slot, locations!inner(name)')
    .eq('locations.name', input.locationName)
    .gte('date', input.dateFrom)
    .lte('date', input.dateTo)
    .eq('status', 'confirmed')
    .eq('cal_booking_status', 'created')
    .not('cal_booking_uid', 'is', null)
    .is('deleted_at', null);
  if (error) throw error;

  const seen = new Set<string>();
  const slots: SharedTourSlot[] = [];
  for (const row of (data ?? []) as Array<{ date: string | null; time_slot: string | null }>) {
    if (!row.date || !row.time_slot) continue;
    const key = `${row.date} ${row.time_slot}`;
    if (seen.has(key)) continue;
    seen.add(key);
    slots.push({ date: row.date, time: row.time_slot });
  }
  return slots;
}

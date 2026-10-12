// Keeps a booking's Cal.com event (the guide's calendar block) in step with the
// booking row, and raises an ops alert whenever the calendar can't be updated —
// a missing event means the slot stays open for online booking.
//
// Used by the manual-booking flow, the admin "Retry calendar" button, booking
// edits, and cancel/delete. The Stripe webhook and gift-card flows keep their own
// inline create call (live paid path) and reuse joinSharedDepartureEvent and
// alertCalendarFailure.
//
// Shared departures (Sanford, lib/sanford.ts): every group on a departure rides
// on ONE Cal.com event — the first group's. Later groups are added to it as
// guests, and the event is only cancelled when its last group leaves.

import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase';
import { addCalBookingGuests, cancelCalBooking, createCalBooking, rescheduleCalBooking } from '@/lib/cal';
import { addHoursToIso, easternLocalToUtcIso } from '@/lib/booking-datetime';
import { notifySupportAlert } from '@/lib/n8n';
import { isSanfordLocation } from '@/lib/sanford';

export type CalendarSyncResult = { ok: boolean; uid: string | null; error: string | null };

type CalendarBookingRow = {
  id: string;
  date: string | null;
  time_slot: string | null;
  duration_hours: number | null;
  trail_type: 'paved' | 'mtb' | null;
  location_id: string | null;
  cal_booking_uid: string | null;
  customers: { name?: string; email?: string } | null;
  locations: { name?: string } | null;
};

async function loadCalendarBooking(bookingId: string): Promise<CalendarBookingRow | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (getSupabaseAdmin() as any)
    .from('bookings')
    .select(
      'id, date, time_slot, duration_hours, trail_type, location_id, cal_booking_uid, customers(name, email), locations(name)'
    )
    .eq('id', bookingId)
    .maybeSingle();
  if (error || !data) {
    console.error('[booking-calendar] booking not found:', bookingId, error?.message);
    return null;
  }
  return data as CalendarBookingRow;
}

function isSharedDepartureTour(booking: CalendarBookingRow): boolean {
  return booking.trail_type === 'paved' && isSanfordLocation(booking.locations?.name);
}

/** The calendar event of another confirmed group already on the same departure. */
async function findDepartureEvent(booking: CalendarBookingRow): Promise<string | null> {
  if (!booking.location_id || !booking.date || !booking.time_slot) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (getSupabaseAdmin() as any)
    .from('bookings')
    .select('cal_booking_uid')
    .eq('location_id', booking.location_id)
    .eq('date', booking.date)
    .eq('time_slot', booking.time_slot)
    .eq('status', 'confirmed')
    .eq('cal_booking_status', 'created')
    .not('cal_booking_uid', 'is', null)
    .is('deleted_at', null)
    .neq('id', booking.id)
    .order('created_at', { ascending: true })
    .limit(1);
  return (data?.[0] as { cal_booking_uid: string } | undefined)?.cal_booking_uid ?? null;
}

/** Other active bookings riding on a calendar event (shared departures). */
async function countOtherGroupsOnEvent(uid: string, bookingId: string): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (getSupabaseAdmin() as any)
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('cal_booking_uid', uid)
    .neq('id', bookingId)
    .in('status', ['pending', 'confirmed'])
    .is('deleted_at', null);
  return count ?? 0;
}

async function joinDepartureEvent(
  booking: CalendarBookingRow,
  eventUid: string,
  opts: { source: string }
): Promise<CalendarSyncResult> {
  if (booking.cal_booking_uid !== eventUid) {
    // Leave the group's own event first, unless other groups still ride on it.
    if (booking.cal_booking_uid && (await countOtherGroupsOnEvent(booking.cal_booking_uid, booking.id)) === 0) {
      const cancelled = await cancelCalBooking(booking.cal_booking_uid, 'Group moved to a shared departure');
      if (!cancelled.ok) {
        console.error(`[booking-calendar] could not cancel the old event of ${booking.id}:`, cancelled.error);
      }
    }
    // The slot is already blocked; the guest entry only shows the group on the event.
    if (booking.customers?.email) {
      const added = await addCalBookingGuests(eventUid, [
        { email: booking.customers.email, name: booking.customers.name ?? undefined },
      ]);
      if (!added.ok) {
        console.warn(`[booking-calendar] ${booking.id} joined ${eventUid} but is not listed as a guest:`, added.error);
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (getSupabaseAdmin() as any)
    .from('bookings')
    .update({ cal_booking_uid: eventUid, cal_booking_status: 'created' })
    .eq('id', booking.id);
  console.log(`[booking-calendar] ${booking.id} is on shared departure event ${eventUid} (${opts.source})`);
  return { ok: true, uid: eventUid, error: null };
}

/**
 * Shared departures: when another group already holds the departure's calendar
 * event, put this booking on it instead of creating a second event. Returns null
 * when there is nothing to join — the caller creates the event as usual.
 */
export async function joinSharedDepartureEvent(
  bookingId: string,
  opts: { source: string }
): Promise<CalendarSyncResult | null> {
  const booking = await loadCalendarBooking(bookingId);
  if (!booking || !isSharedDepartureTour(booking)) return null;
  const eventUid = await findDepartureEvent(booking);
  return eventUid ? joinDepartureEvent(booking, eventUid, opts) : null;
}

export async function alertCalendarFailure(input: {
  bookingId: string;
  source: string;
  error: string | null;
  date?: string | null;
  time?: string | null;
}) {
  try {
    await notifySupportAlert({
      source: input.source,
      severity: 'error',
      summary:
        `Calendar event NOT created for booking ${input.bookingId}` +
        (input.date ? ` (${input.date}${input.time ? ` ${input.time}` : ''})` : '') +
        ' — the slot is still open online. Use "Retry calendar" in /admin.',
      bookingId: input.bookingId,
      details: { cal_error: input.error ?? 'unknown' },
    });
  } catch (e) {
    console.error('[booking-calendar] alert failed:', (e as Error).message);
  }
}

/**
 * Make the booking's Cal.com event match its current date/time/duration:
 * reschedule the existing event if there is one, otherwise create it. Saves the
 * resulting uid + cal_booking_status and alerts on failure. On a shared
 * departure, the booking joins the departure's event instead.
 */
export async function syncBookingCalendarEvent(
  bookingId: string,
  opts: { source: string; reason?: string }
): Promise<CalendarSyncResult> {
  const supabase = getSupabaseAdmin();

  const booking = await loadCalendarBooking(bookingId);
  if (!booking) return { ok: false, uid: null, error: 'Booking not found' };
  if (!booking.date || !booking.time_slot || !booking.duration_hours) {
    return { ok: false, uid: null, error: 'Booking has no date, time or duration' };
  }

  let ownUid = booking.cal_booking_uid;
  if (isSharedDepartureTour(booking)) {
    const eventUid = await findDepartureEvent(booking);
    if (eventUid) return joinDepartureEvent(booking, eventUid, opts);
    // Moving the event would move the other groups too: leave it to them and
    // give this booking a new event.
    if (ownUid && (await countOtherGroupsOnEvent(ownUid, booking.id)) > 0) ownUid = null;
  }

  const startIso = easternLocalToUtcIso(booking.date, booking.time_slot);
  const endIso = addHoursToIso(startIso, booking.duration_hours);
  const locationName = booking.locations?.name ?? null;

  let result = ownUid
    ? await rescheduleCalBooking(ownUid, { startIso, endIso, reason: opts.reason })
    : null;

  // No event yet — or the old one is gone / was cancelled in Cal.com — so create
  // a fresh one. A 409 (slot taken / outside availability) is reported as-is.
  const oldEventGone =
    result !== null && !result.uid && (result.status === 404 || /cancel/i.test(result.error ?? ''));
  if (result === null || oldEventGone) {
    result = await createCalBooking({
      startIso,
      endIso,
      name: booking.customers?.name ?? '',
      email: booking.customers?.email ?? '',
      timeZone: 'America/New_York',
      trailType: booking.trail_type,
      locationName,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('bookings')
    .update(result.uid ? { cal_booking_uid: result.uid, cal_booking_status: 'created' } : { cal_booking_status: 'failed' })
    .eq('id', bookingId);

  if (!result.uid) {
    console.error(`[booking-calendar] calendar sync FAILED for ${bookingId}:`, result.error);
    await alertCalendarFailure({
      bookingId,
      source: opts.source,
      error: result.error,
      date: booking.date,
      time: booking.time_slot,
    });
  }

  return { ok: Boolean(result.uid), uid: result.uid, error: result.error };
}

/**
 * Release the booking's Cal.com event (cancel / refund / delete). No-op without
 * one. On a shared departure the event stays while other groups still ride on it.
 */
export async function cancelBookingCalendarEvent(
  booking: { id: string; cal_booking_uid: string | null },
  reason: string
): Promise<void> {
  if (!booking.cal_booking_uid) return;

  if ((await countOtherGroupsOnEvent(booking.cal_booking_uid, booking.id)) > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (getSupabaseAdmin() as any)
      .from('bookings')
      .update({ cal_booking_status: 'cancelled' })
      .eq('id', booking.id);
    console.log(`[booking-calendar] ${booking.id} left shared event ${booking.cal_booking_uid}; other groups keep it`);
    return;
  }

  const result = await cancelCalBooking(booking.cal_booking_uid, reason);
  if (!result.ok) {
    console.error(`[booking-calendar] could not cancel Cal.com event for ${booking.id}:`, result.error);
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (getSupabaseAdmin() as any)
    .from('bookings')
    .update({ cal_booking_status: 'cancelled' })
    .eq('id', booking.id);
}

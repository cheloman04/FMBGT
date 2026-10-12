// Keeps a booking's Cal.com event (the guide's calendar block) in step with the
// booking row, and raises an ops alert whenever the calendar can't be updated —
// a missing event means the slot stays open for online booking.
//
// Used by the manual-booking flow, the admin "Retry calendar" button, booking
// edits, and cancel/delete. The Stripe webhook and gift-card flows keep their own
// inline create call (live paid path) and only reuse alertCalendarFailure.

import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase';
import { cancelCalBooking, createCalBooking, rescheduleCalBooking } from '@/lib/cal';
import { addHoursToIso, easternLocalToUtcIso } from '@/lib/booking-datetime';
import { notifySupportAlert } from '@/lib/n8n';
import { sharedTourExists } from '@/lib/shared-tours';

export type CalendarSyncResult = { ok: boolean; uid: string | null; error: string | null };

type CalendarBookingRow = {
  id: string;
  date: string | null;
  time_slot: string | null;
  duration_hours: number | null;
  trail_type: 'paved' | 'mtb' | null;
  cal_booking_uid: string | null;
  location_id: string | null;
  customers: { name?: string; email?: string } | null;
  locations: { name?: string } | null;
};

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
 * resulting uid + cal_booking_status and alerts on failure.
 */
export async function syncBookingCalendarEvent(
  bookingId: string,
  opts: { source: string; reason?: string }
): Promise<CalendarSyncResult> {
  const supabase = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('bookings')
    .select('id, date, time_slot, duration_hours, trail_type, cal_booking_uid, location_id, customers(name, email), locations(name)')
    .eq('id', bookingId)
    .maybeSingle();

  if (error || !data) {
    console.error('[booking-calendar] booking not found:', bookingId, error?.message);
    return { ok: false, uid: null, error: 'Booking not found' };
  }

  const booking = data as CalendarBookingRow;
  if (!booking.date || !booking.time_slot || !booking.duration_hours) {
    return { ok: false, uid: null, error: 'Booking has no date, time or duration' };
  }

  const startIso = easternLocalToUtcIso(booking.date, booking.time_slot);
  const endIso = addHoursToIso(startIso, booking.duration_hours);
  const locationName = booking.locations?.name ?? null;
  // Sanford: another group's tour already holds this time — book alongside it.
  const joinSharedTour = await sharedTourExists({
    locationId: booking.location_id,
    locationName,
    date: booking.date,
    time: booking.time_slot,
    excludeBookingId: booking.id,
  });

  let result = booking.cal_booking_uid
    ? await rescheduleCalBooking(booking.cal_booking_uid, { startIso, endIso, reason: opts.reason, joinSharedTour })
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
      joinSharedTour,
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
 * Replace the booking's Cal.com event with a new one — for a move to another
 * location, where the event type and the meeting address change and a
 * reschedule can't follow.
 */
export async function recreateBookingCalendarEvent(
  bookingId: string,
  opts: { source: string; reason?: string }
): Promise<CalendarSyncResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (getSupabaseAdmin() as any)
    .from('bookings')
    .select('cal_booking_uid')
    .eq('id', bookingId)
    .maybeSingle();
  const oldUid = (data as { cal_booking_uid: string | null } | null)?.cal_booking_uid ?? null;

  if (oldUid) {
    const cancelled = await cancelCalBooking(oldUid, opts.reason ?? 'Tour moved to another location');
    if (!cancelled.ok) console.error(`[booking-calendar] could not cancel the old event of ${bookingId}:`, cancelled.error);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (getSupabaseAdmin() as any)
      .from('bookings')
      .update({ cal_booking_uid: null, cal_booking_status: 'cancelled' })
      .eq('id', bookingId);
  }

  return syncBookingCalendarEvent(bookingId, opts);
}

/** Release the booking's Cal.com event (cancel / refund / delete). No-op without one. */
export async function cancelBookingCalendarEvent(
  booking: { id: string; cal_booking_uid: string | null },
  reason: string
): Promise<void> {
  if (!booking.cal_booking_uid) return;

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

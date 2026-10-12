// "Your booking was updated": the booking_confirmed email sent again with the
// new details after an admin edit. The n8n workflow (Booking Confirmation Email)
// switches its subject and intro when `updated` is true and lists
// `changes_summary`. Manual bookings reuse their own email (waiver link + real
// balance); online bookings get the checkout email's fields, rebuilt from the row.

import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase';
import { addHoursToIso, easternLocalToUtcIso } from '@/lib/booking-datetime';
import { formatSkillLevel } from '@/lib/booking-email';
import { getBookingLocationMeta } from '@/lib/location-meta';
import { getAppUrl } from '@/lib/app-url';
import { triggerN8nEvent } from '@/lib/n8n';
import { sendManualBookingEmail } from '@/lib/manual-booking';
import { bookingTotalCents, netCollectedCents, scheduledChargeCents, type BookingMoneyRow } from '@/lib/booking-money';

export type UpdateEmailResult = { ok: boolean; error: string | null; waiverUrl: string | null };

export async function sendBookingUpdatedEmail(
  bookingId: string,
  opts: { changesSummary: string[]; source: string }
): Promise<UpdateEmailResult> {
  const supabase = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: booking, error } = await (supabase as any)
    .from('bookings')
    .select(
      'id, booking_source, date, time_slot, duration_hours, trail_type, skill_level, participant_count, participant_info, ' +
        'zip_code, marketing_source, total_price, total_after_discount_cents, deposit_paid_cents, deposit_payment_status, ' +
        'remaining_balance_amount, remaining_balance_status, remaining_balance_due_at, extra_paid_cents, refunded_cents, ' +
        'stripe_payment_method_id, waiver_accepted, waiver_link_token, customers(name, email, phone), locations(name)'
    )
    .eq('id', bookingId)
    .maybeSingle();
  if (error || !booking) return { ok: false, error: 'Booking not found', waiverUrl: null };

  if (booking.booking_source === 'manual') {
    const email = await sendManualBookingEmail(bookingId, {
      resend: true,
      source: opts.source,
      changesSummary: opts.changesSummary,
    });
    return { ok: email.ok, error: email.error, waiverUrl: email.waiverUrl };
  }

  const customer = booking.customers as { name?: string; email?: string; phone?: string | null } | null;
  if (!customer?.email) return { ok: false, error: 'This booking has no customer email on file.', waiverUrl: null };

  // Only send the waiver link when someone still has to sign.
  const waiverUrl =
    booking.waiver_link_token && !booking.waiver_accepted ? `${getAppUrl()}/waiver/${booking.waiver_link_token}` : null;
  const locationName = (booking.locations as { name?: string } | null)?.name ?? 'Florida Mountain Bike Guides';
  const locationMeta = getBookingLocationMeta(locationName);
  const startIso = booking.date && booking.time_slot ? easternLocalToUtcIso(booking.date, booking.time_slot) : null;
  const endIso = startIso && booking.duration_hours ? addHoursToIso(startIso, booking.duration_hours) : null;

  const money = booking as BookingMoneyRow & { remaining_balance_due_at: string | null };
  const total = bookingTotalCents(money);
  const collected = netCollectedCents(money);

  const result = await triggerN8nEvent({
    event: 'booking_confirmed',
    source: opts.source,
    envKeys: ['N8N_WEBHOOK_URL'],
    data: {
      booking_id: booking.id,
      resend: true,
      updated: true,
      changes_summary: opts.changesSummary,
      customer_email: customer.email,
      customer_name: customer.name ?? null,
      customer_phone: customer.phone ?? null,
      zip_code: booking.zip_code ?? null,
      marketing_source: booking.marketing_source ?? null,
      deposit_amount: collected,
      remaining_balance: Math.max(0, total - collected),
      remaining_balance_due_at: scheduledChargeCents(money) > 0 ? money.remaining_balance_due_at : null,
      total_amount: total,
      waiver_required: Boolean(waiverUrl),
      waiver_signed: Boolean(booking.waiver_accepted),
      waiver_url: waiverUrl,
      location: locationName,
      date: booking.date,
      time: booking.time_slot,
      duration_hours: booking.duration_hours,
      participant_count: booking.participant_count,
      participant_info: booking.participant_info,
      trail_type: booking.trail_type,
      skill_level: formatSkillLevel(booking.skill_level),
      meeting_location_name: locationMeta.meetingPointName,
      meeting_location_address: locationMeta.meetingPointAddress,
      meeting_location_url: locationMeta.meetingPointUrl,
      booking_start_iso: startIso,
      booking_end_iso: endIso,
      calendar_url: `${getAppUrl()}/api/calendar/${booking.id}`,
    },
  });

  return { ok: result.ok, error: result.error, waiverUrl };
}

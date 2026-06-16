// Finalize a manually-created (cash / off-platform) booking. There is no Stripe
// payment for these, so the Stripe webhook never fires — this runs the same
// post-confirmation work the webhook does (Cal.com event, confirmation email,
// Senzai, financial log), adapted for a cash deal closed off-platform.
//
// The waiver is NOT signed here — it is collected later via the tokenized
// /waiver/<token> page (in person as a kiosk, or sent by email/SMS). The
// confirmation email includes that link so the customer can sign ahead of time.
//
// IMPORTANT: mirrors lib/free-booking.ts on purpose (the non-Stripe finalize
// path). Keep the two in sync — they are deliberately not shared to avoid
// changing the live, hard-to-test paid flow.

import { getSupabaseAdmin } from '@/lib/supabase';
import { createCalBooking } from '@/lib/cal';
import { addHoursToIso, easternLocalToUtcIso } from '@/lib/booking-datetime';
import { formatSkillLevel } from '@/lib/booking-email';
import { getBookingLocationMeta } from '@/lib/location-meta';
import { getAppUrl } from '@/lib/app-url';
import { sendSenzaiEvent } from '@/lib/senzai-ingest';
import { recordFinancialEvent } from '@/lib/financial-log';
import { triggerN8nEvent } from '@/lib/n8n';

type FinalizeResult = {
  ok: boolean;
  calBooked: boolean;
  emailQueued: boolean;
  waiverUrl: string | null;
};

export async function finalizeManualBooking(bookingId: string): Promise<FinalizeResult> {
  const supabase = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: booking, error } = await (supabase as any)
    .from('bookings')
    .select(
      `id, date, time_slot, duration_hours, participant_count, participant_info,
       trail_type, skill_level, total_price, deposit_paid_cents, payment_method,
       admin_notes, waiver_link_token, waiver_session_id, zip_code, marketing_source,
       customers(name, email, phone), locations(name)`
    )
    .eq('id', bookingId)
    .maybeSingle();

  if (error || !booking) {
    console.error('[manual-booking] booking not found:', bookingId, error?.message);
    return { ok: false, calBooked: false, emailQueued: false, waiverUrl: null };
  }

  const customer = (booking.customers ?? null) as { name?: string; email?: string; phone?: string } | null;
  const locationName = (booking.locations as { name?: string } | null)?.name ?? 'Florida Mountain Bike Guides';
  const occurredAt = new Date().toISOString();
  const collectedCents = booking.deposit_paid_cents ?? 0;
  const paymentMethod = booking.payment_method ?? 'cash';
  const waiverUrl = booking.waiver_link_token ? `${getAppUrl()}/waiver/${booking.waiver_link_token}` : null;

  // 1. Cal.com booking (guide's calendar event) — avoids double-booking the slot.
  let calBooked = false;
  if (booking.date && booking.time_slot && booking.duration_hours) {
    try {
      const startIso = easternLocalToUtcIso(booking.date, booking.time_slot);
      const endIso = addHoursToIso(startIso, booking.duration_hours);
      const calUid = await createCalBooking({
        startIso,
        endIso,
        name: customer?.name ?? '',
        email: customer?.email ?? '',
        timeZone: 'America/New_York',
        notes: `Florida MTB Tour (cash / manual) — ${locationName} — ${booking.date}`,
        trailType: booking.trail_type ?? null,
        locationName,
      });
      calBooked = Boolean(calUid);
      await supabase
        .from('bookings')
        .update(calUid ? { cal_booking_uid: calUid, cal_booking_status: 'created' } : { cal_booking_status: 'failed' })
        .eq('id', bookingId);
      if (!calUid) console.error(`[manual-booking] Cal.com booking FAILED for ${bookingId}`);
    } catch (e) {
      console.error('[manual-booking] Cal.com error:', (e as Error).message);
    }
  }

  // 2. n8n — booking confirmed (sends the confirmation email). Includes the
  //    waiver link so the customer can sign ahead of time; flagged as cash.
  let emailQueued = false;
  try {
    const locationMeta = getBookingLocationMeta(locationName);
    const startIso = booking.date && booking.time_slot ? easternLocalToUtcIso(booking.date, booking.time_slot) : null;
    const endIso = startIso && booking.duration_hours ? addHoursToIso(startIso, booking.duration_hours) : null;
    const calendarUrl = `${getAppUrl()}/api/calendar/${bookingId}`;
    const result = await triggerN8nEvent({
      event: 'booking_confirmed',
      source: '/api/admin/manual-booking',
      envKeys: ['N8N_WEBHOOK_URL'],
      data: {
        booking_id: bookingId,
        customer_email: customer?.email ?? null,
        customer_name: customer?.name ?? null,
        customer_phone: customer?.phone ?? null,
        zip_code: booking.zip_code ?? null,
        marketing_source: booking.marketing_source ?? null,
        deposit_amount: collectedCents,
        remaining_balance: 0,
        remaining_balance_due_at: null,
        total_amount: booking.total_price ?? 0,
        manual_booking: true,
        payment_method: paymentMethod,
        waiver_required: true,
        waiver_signed: false,
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
        calendar_url: calendarUrl,
      },
    });
    emailQueued = result.ok;
    if (result.ok) {
      await supabase.from('bookings').update({ webhook_sent: true }).eq('id', bookingId);
    }
  } catch (e) {
    console.error('[manual-booking] n8n booking_confirmed failed:', (e as Error).message);
  }

  // 3. Senzai — booking confirmed (cash, off-platform).
  try {
    await sendSenzaiEvent({
      event_name: 'booking.confirmed',
      occurred_at: occurredAt,
      source_event_id: bookingId,
      idempotency_key: `booking:${bookingId}:confirmed`,
      source_route: '/api/admin/manual-booking',
      authoritative_source: 'supabase.bookings.manual_cash_confirmation',
      entity_type: 'booking',
      entity_id: bookingId,
      refs: {
        booking_id: bookingId,
        waiver_session_id: booking.waiver_session_id ?? null,
      },
      data: {
        booking_id: bookingId,
        deposit_amount: collectedCents,
        remaining_balance_amount: 0,
        manual_booking: true,
        payment_method: paymentMethod,
        customer_email: customer?.email ?? null,
        customer_name: customer?.name ?? null,
        location_name: locationName,
        date: booking.date ?? null,
        time: booking.time_slot ?? null,
        duration_hours: booking.duration_hours ?? null,
        participant_count: booking.participant_count ?? null,
        trail_type: booking.trail_type ?? null,
        skill_level: booking.skill_level ?? null,
      },
    });
  } catch (e) {
    console.error('[manual-booking] Senzai event failed:', (e as Error).message);
  }

  // 4. Financial log — cash collected off-platform (keeps the books complete).
  try {
    await recordFinancialEvent({
      event_name: 'booking.confirmed_cash',
      event_category: 'booking',
      severity: 'info',
      entity_type: 'booking',
      entity_id: bookingId,
      booking_id: bookingId,
      amount: collectedCents,
      currency: 'usd',
      status: 'paid',
      message: `Manual booking confirmed — $${(collectedCents / 100).toFixed(2)} collected via ${paymentMethod}`,
      metadata: {
        manual_booking: true,
        payment_method: paymentMethod,
        created_off_platform: true,
        customer_email: customer?.email ?? null,
        admin_notes: booking.admin_notes ?? null,
      },
      occurred_at: occurredAt,
    });
  } catch (e) {
    console.error('[manual-booking] financial log failed:', (e as Error).message);
  }

  console.log(`[manual-booking] ${bookingId} confirmed (cash). cal=${calBooked} email=${emailQueued}`);
  return { ok: true, calBooked, emailQueued, waiverUrl };
}

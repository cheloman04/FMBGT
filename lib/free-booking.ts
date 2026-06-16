// Finalize a booking that is fully covered (total = $0), e.g. by a gift card.
// There is no Stripe payment, so the Stripe webhook never fires for these — this
// runs the same post-confirmation work the webhook does, minus anything money/PM.
//
// IMPORTANT: keep the confirmation steps here in sync with the
// `checkout.session.completed` handler in app/api/webhooks/stripe/route.ts.
// (Deliberately NOT shared with the webhook to avoid changing the live, hard-to-
// test paid flow; mirror changes across both.)

import { getSupabaseAdmin } from '@/lib/supabase';
import { createCalBooking } from '@/lib/cal';
import { addHoursToIso, easternLocalToUtcIso } from '@/lib/booking-datetime';
import { formatSkillLevel } from '@/lib/booking-email';
import { cancelActiveFollowUpForConversion } from '@/lib/lead-followup';
import { getBookingLocationMeta } from '@/lib/location-meta';
import { markLeadSessionConverted } from '@/lib/lead-sessions';
import { getAppUrl } from '@/lib/app-url';
import { sendSenzaiEvent } from '@/lib/senzai-ingest';
import { recordFinancialEvent } from '@/lib/financial-log';
import { triggerN8nEvent } from '@/lib/n8n';

type FinalizeResult = { ok: boolean; calBooked: boolean; emailQueued: boolean };

export async function finalizeFreeBooking(bookingId: string): Promise<FinalizeResult> {
  const supabase = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: booking, error } = await (supabase as any)
    .from('bookings')
    .select(
      `id, lead_id, booking_session_id, waiver_session_id, date, time_slot, duration_hours,
       participant_count, participant_info, trail_type, skill_level, total_price,
       discount_code, discount_label, discount_amount_cents, total_after_discount_cents,
       zip_code, marketing_source, gift_card_id, created_at,
       customers(name, email, phone), locations(name)`
    )
    .eq('id', bookingId)
    .maybeSingle();

  if (error || !booking) {
    console.error('[free-booking] booking not found:', bookingId, error?.message);
    return { ok: false, calBooked: false, emailQueued: false };
  }

  const customer = (booking.customers ?? null) as { name?: string; email?: string; phone?: string } | null;
  const locationName = (booking.locations as { name?: string } | null)?.name ?? 'Florida Mountain Bike Guides';
  const occurredAt = new Date().toISOString();

  // 1. Confirm the booking (no payment collected; settled by the gift card).
  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      status: 'confirmed',
      deposit_payment_status: 'paid',
      deposit_paid_cents: 0,
      remaining_balance_status: 'paid',
      remaining_balance_amount: 0,
    })
    .eq('id', bookingId);

  if (updateError) {
    console.error(`[free-booking] failed to confirm ${bookingId}:`, updateError.message);
    return { ok: false, calBooked: false, emailQueued: false };
  }

  // 2. Convert the lead → booking (if linked).
  if (booking.lead_id) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('leads')
        .update({
          status: 'converted',
          booking_id: bookingId,
          converted_at: occurredAt,
          last_step_completed: 'booking_confirmed',
          last_activity_at: occurredAt,
          updated_at: occurredAt,
        })
        .eq('id', booking.lead_id);
      await cancelActiveFollowUpForConversion(booking.lead_id);
    } catch (e) {
      console.error('[free-booking] lead conversion failed:', (e as Error).message);
    }
  }
  if (booking.booking_session_id) {
    try {
      await markLeadSessionConverted(booking.booking_session_id);
    } catch (e) {
      console.error('[free-booking] markLeadSessionConverted failed:', (e as Error).message);
    }
  }

  // 3. Cal.com booking (guide's calendar event).
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
        notes: `Florida MTB Tour (gift card) — ${locationName} — ${booking.date}`,
        trailType: booking.trail_type ?? null,
        locationName,
      });
      calBooked = Boolean(calUid);
      await supabase
        .from('bookings')
        .update(calUid ? { cal_booking_uid: calUid, cal_booking_status: 'created' } : { cal_booking_status: 'failed' })
        .eq('id', bookingId);
      if (!calUid) console.error(`[free-booking] Cal.com booking FAILED for ${bookingId}`);
    } catch (e) {
      console.error('[free-booking] Cal.com error:', (e as Error).message);
    }
  }

  // 4. Link waiver records.
  if (booking.waiver_session_id) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('waiver_records')
        .update({ booking_id: bookingId })
        .eq('session_id', booking.waiver_session_id)
        .is('booking_id', null);
    } catch (e) {
      console.error('[free-booking] waiver link failed:', (e as Error).message);
    }
  }

  // 5. n8n — booking confirmed (sends the confirmation email). Flagged as gift-card
  //    covered so the template can show "$0 due / paid with gift card".
  let emailQueued = false;
  try {
    const locationMeta = getBookingLocationMeta(locationName);
    const startIso = booking.date && booking.time_slot ? easternLocalToUtcIso(booking.date, booking.time_slot) : null;
    const endIso = startIso && booking.duration_hours ? addHoursToIso(startIso, booking.duration_hours) : null;
    const calendarUrl = `${getAppUrl()}/api/calendar/${bookingId}`;
    const result = await triggerN8nEvent({
      event: 'booking_confirmed',
      source: '/api/create-checkout (free)',
      envKeys: ['N8N_WEBHOOK_URL'],
      data: {
        booking_id: bookingId,
        customer_email: customer?.email ?? null,
        customer_name: customer?.name ?? null,
        customer_phone: customer?.phone ?? null,
        zip_code: booking.zip_code ?? null,
        marketing_source: booking.marketing_source ?? null,
        deposit_amount: 0,
        remaining_balance: 0,
        remaining_balance_due_at: null,
        total_amount: booking.total_price ?? 0,
        gift_card_covered: true,
        payment_method: 'gift_card',
        discount_code: booking.discount_code ?? null,
        discount_amount: booking.discount_amount_cents ?? 0,
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
  } catch (e) {
    console.error('[free-booking] n8n booking_confirmed failed:', (e as Error).message);
  }

  // 6. Senzai — booking confirmed (no cash payment; gift-card covered).
  try {
    await sendSenzaiEvent({
      event_name: 'booking.confirmed',
      occurred_at: occurredAt,
      source_event_id: bookingId,
      idempotency_key: `booking:${bookingId}:confirmed`,
      source_route: '/api/create-checkout',
      authoritative_source: 'supabase.bookings.free_gift_card_confirmation',
      entity_type: 'booking',
      entity_id: bookingId,
      refs: {
        booking_id: bookingId,
        lead_id: booking.lead_id ?? null,
        waiver_session_id: booking.waiver_session_id ?? null,
      },
      data: {
        booking_id: bookingId,
        deposit_amount: 0,
        remaining_balance_amount: 0,
        gift_card_covered: true,
        gift_card_id: booking.gift_card_id ?? null,
        discount_amount_cents: booking.discount_amount_cents ?? 0,
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
    console.error('[free-booking] Senzai event failed:', (e as Error).message);
  }

  // 7. Financial log — booking confirmed with $0 collected.
  try {
    await recordFinancialEvent({
      event_name: 'booking.confirmed_gift_card',
      event_category: 'booking',
      severity: 'info',
      entity_type: 'booking',
      entity_id: bookingId,
      booking_id: bookingId,
      lead_id: booking.lead_id ?? null,
      amount: 0,
      currency: 'usd',
      status: 'paid',
      message: `Booking confirmed, fully covered by gift card ${booking.discount_code ?? ''}`.trim(),
      metadata: {
        gift_card_id: booking.gift_card_id ?? null,
        discount_amount_cents: booking.discount_amount_cents ?? 0,
        customer_email: customer?.email ?? null,
      },
      occurred_at: occurredAt,
    });
  } catch (e) {
    console.error('[free-booking] financial log failed:', (e as Error).message);
  }

  console.log(`[free-booking] ${bookingId} confirmed (gift-card covered). cal=${calBooked} email=${emailQueued}`);
  return { ok: true, calBooked, emailQueued };
}

// Manually-created (cash / off-platform) bookings. There is no Stripe payment for
// these, so the Stripe webhook never fires — finalizeManualBooking runs the same
// post-confirmation work the webhook does (Cal.com event, confirmation email,
// Senzai, financial log), adapted for a deal closed off-platform.
//
// A manual booking can also HOLD a date before the customer pays: the agreed total
// lives in total_price, what has actually been collected in deposit_paid_cents, and
// the difference is an off-platform balance (remaining_balance_status 'pending',
// no remaining_balance_due_at, no Stripe payment method — so the charge-remaining
// cron never touches it). Payments are added later with recordManualPayment.
//
// The waiver is NOT signed here — it is collected later via the tokenized
// /waiver/<token> page (in person as a kiosk, or sent by email/SMS). The
// confirmation email includes that link so the customer can sign ahead of time.
//
// IMPORTANT: finalizeManualBooking mirrors lib/free-booking.ts on purpose (the
// non-Stripe finalize path). Keep the two in sync — they are deliberately not
// shared to avoid changing the live, hard-to-test paid flow.

import { randomUUID } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabase';
import { addHoursToIso, easternLocalToUtcIso } from '@/lib/booking-datetime';
import { formatSkillLevel } from '@/lib/booking-email';
import { getBookingLocationMeta } from '@/lib/location-meta';
import { getAppUrl } from '@/lib/app-url';
import { queueSenzaiEvent } from '@/lib/analytics-delivery';
import { recordFinancialEvent } from '@/lib/financial-log';
import { notifySupportAlert, triggerN8nEvent } from '@/lib/n8n';
import { syncBookingCalendarEvent, type CalendarSyncResult } from '@/lib/booking-calendar';
import { validateBookingInventory } from '@/lib/inventory';
import type { BikeRental } from '@/types/booking';

export const MANUAL_BOOKING_LIST_COLUMNS =
  'id, created_at, date, time_slot, duration_hours, trail_type, skill_level, status, ' +
  'payment_method, deposit_paid_cents, total_price, remaining_balance_amount, remaining_balance_status, ' +
  'waiver_accepted, waiver_accepted_at, waiver_link_token, admin_notes, bike_rental, participant_count, ' +
  'participant_info, cal_booking_status, webhook_sent, customers(name, email, phone), locations(name)';

export type ManualPaymentMethod = 'cash' | 'zelle' | 'venmo' | 'other';

/** Balance columns derived from the agreed total and what has been collected so far. */
export function manualBalance(totalCents: number, collectedCents: number) {
  const remaining = Math.max(0, totalCents - collectedCents);
  return {
    remaining_balance_amount: remaining,
    remaining_balance_status: remaining > 0 ? 'pending' : 'paid',
  };
}

function fmtUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * `attributes.stage` of a payment.succeeded (contract 2026-10-01, senzai-skills
 * events.catalog.json `payment_stages`): the first payment is the deposit, or the
 * full price when it covers the total; any later payment settles the balance.
 */
export function manualPaymentStage(
  totalCents: number,
  collectedBeforeCents: number,
  amountCents: number
): 'deposit' | 'balance' | 'full' {
  if (collectedBeforeCents > 0) return 'balance';
  return amountCents >= totalCents ? 'full' : 'deposit';
}

type CustomerRow = { name?: string; email?: string; phone?: string | null } | null;

// ─── Confirmation email ────────────────────────────────────────────────────────

export type ManualEmailResult = {
  ok: boolean;
  reason: 'not_found' | 'no_email' | 'send_failed' | null;
  error: string | null;
  waiverUrl: string | null;
};

/**
 * Send (or re-send) the booking_confirmed email with the waiver link and the real
 * balance. With `changesSummary` it goes out as "Your booking was updated".
 */
export async function sendManualBookingEmail(
  bookingId: string,
  opts: { resend: boolean; source: string; changesSummary?: string[] }
): Promise<ManualEmailResult> {
  const supabase = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: booking, error } = await (supabase as any)
    .from('bookings')
    .select(
      'id, date, time_slot, duration_hours, trail_type, skill_level, total_price, deposit_paid_cents, ' +
        'remaining_balance_amount, payment_method, waiver_link_token, waiver_accepted, participant_count, ' +
        'participant_info, zip_code, marketing_source, customers(name, email, phone), locations(name)'
    )
    .eq('id', bookingId)
    .eq('booking_source', 'manual')
    .maybeSingle();

  if (error || !booking) {
    return { ok: false, reason: 'not_found', error: 'Manual booking not found', waiverUrl: null };
  }

  const customer = (booking.customers ?? null) as CustomerRow;
  const waiverUrl = booking.waiver_link_token ? `${getAppUrl()}/waiver/${booking.waiver_link_token}` : null;
  if (!customer?.email) {
    return { ok: false, reason: 'no_email', error: 'This booking has no customer email on file.', waiverUrl };
  }

  const locationName = (booking.locations as { name?: string } | null)?.name ?? 'Florida Mountain Bike Guides';
  const locationMeta = getBookingLocationMeta(locationName);
  const startIso = booking.date && booking.time_slot ? easternLocalToUtcIso(booking.date, booking.time_slot) : null;
  const endIso = startIso && booking.duration_hours ? addHoursToIso(startIso, booking.duration_hours) : null;

  const result = await triggerN8nEvent({
    event: 'booking_confirmed',
    source: opts.source,
    envKeys: ['N8N_WEBHOOK_URL'],
    data: {
      booking_id: booking.id,
      resend: opts.resend,
      updated: Boolean(opts.changesSummary?.length),
      changes_summary: opts.changesSummary ?? [],
      customer_email: customer.email,
      customer_name: customer.name ?? null,
      customer_phone: customer.phone ?? null,
      zip_code: booking.zip_code ?? null,
      marketing_source: booking.marketing_source ?? null,
      deposit_amount: booking.deposit_paid_cents ?? 0,
      remaining_balance: booking.remaining_balance_amount ?? 0,
      remaining_balance_due_at: null,
      total_amount: booking.total_price ?? 0,
      manual_booking: true,
      payment_method: booking.payment_method ?? 'cash',
      waiver_required: true,
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('bookings')
    .update(
      result.ok
        ? {
            webhook_sent: true,
            webhook_last_attempt_at: result.attemptedAt,
            webhook_last_status_code: result.statusCode,
            webhook_last_error: null,
          }
        : {
            webhook_last_attempt_at: result.attemptedAt,
            webhook_last_status_code: result.statusCode,
            webhook_last_error: result.error,
          }
    )
    .eq('id', bookingId);

  return result.ok
    ? { ok: true, reason: null, error: null, waiverUrl }
    : { ok: false, reason: 'send_failed', error: result.error ?? 'Failed to send email', waiverUrl };
}

// ─── Finalize (right after creation) ────────────────────────────────────────────

type FinalizeResult = {
  ok: boolean;
  calBooked: boolean;
  emailQueued: boolean;
  waiverUrl: string | null;
};

export async function finalizeManualBooking(
  bookingId: string,
  opts: { sendConfirmation?: boolean } = {}
): Promise<FinalizeResult> {
  const supabase = getSupabaseAdmin();
  const source = '/api/admin/manual-booking';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: booking, error } = await (supabase as any)
    .from('bookings')
    .select(
      `id, date, time_slot, duration_hours, participant_count, trail_type, skill_level,
       total_price, deposit_paid_cents, remaining_balance_amount, payment_method,
       admin_notes, waiver_link_token, waiver_session_id,
       customers(name, email, phone), locations(name)`
    )
    .eq('id', bookingId)
    .maybeSingle();

  if (error || !booking) {
    console.error('[manual-booking] booking not found:', bookingId, error?.message);
    return { ok: false, calBooked: false, emailQueued: false, waiverUrl: null };
  }

  const customer = (booking.customers ?? null) as CustomerRow;
  const locationName = (booking.locations as { name?: string } | null)?.name ?? 'Florida Mountain Bike Guides';
  const occurredAt = new Date().toISOString();
  const collectedCents = booking.deposit_paid_cents ?? 0;
  const remainingCents = booking.remaining_balance_amount ?? 0;
  const paymentMethod = booking.payment_method ?? 'cash';
  const waiverUrl = booking.waiver_link_token ? `${getAppUrl()}/waiver/${booking.waiver_link_token}` : null;

  // 1. Cal.com booking (guide's calendar event) — avoids double-booking the slot.
  //    Alerts ops on failure; the admin can "Retry calendar" later.
  let calBooked = false;
  try {
    calBooked = (await syncBookingCalendarEvent(bookingId, { source })).ok;
  } catch (e) {
    console.error('[manual-booking] Cal.com error:', (e as Error).message);
  }

  // 2. n8n — booking confirmed (sends the confirmation email with the waiver link).
  //    Skipped when the admin is only holding the date and will email later.
  let emailQueued = false;
  if (opts.sendConfirmation !== false) {
    try {
      const email = await sendManualBookingEmail(bookingId, { resend: false, source });
      emailQueued = email.ok;
      if (!email.ok) {
        await notifySupportAlert({
          source,
          severity: 'error',
          summary: `Confirmation email NOT sent for manual booking ${bookingId}`,
          bookingId,
          details: { error: email.error },
        });
      }
    } catch (e) {
      console.error('[manual-booking] n8n booking_confirmed failed:', (e as Error).message);
    }
  }

  // 3. Senzai — booking confirmed (cash, off-platform).
  try {
    await queueSenzaiEvent({
      event_name: 'booking.confirmed',
      occurred_at: occurredAt,
      source_event_id: bookingId,
      idempotency_key: `booking:${bookingId}:confirmed`,
      source_route: source,
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
        remaining_balance_amount: remainingCents,
        total_amount: booking.total_price ?? 0,
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

  // 3b. Senzai — money collected at creation is revenue: payment.succeeded with
  //     stage + method (the Hub counts only payment.succeeded as collected).
  if (collectedCents > 0) {
    try {
      await queueSenzaiEvent({
        event_name: 'payment.succeeded',
        occurred_at: occurredAt,
        source_event_id: `${bookingId}:initial_payment`,
        idempotency_key: `booking:${bookingId}:payment.succeeded:initial`,
        source_route: source,
        authoritative_source: 'supabase.bookings.manual_cash_confirmation',
        entity_type: 'booking',
        entity_id: bookingId,
        amount: { value: collectedCents, currency: 'USD', unit: 'cents' },
        customer: {
          email: customer?.email ?? undefined,
          phone: customer?.phone ?? undefined,
          name: customer?.name ?? undefined,
        },
        refs: { booking_id: bookingId },
        data: {
          stage: manualPaymentStage(booking.total_price ?? 0, 0, collectedCents),
          method: paymentMethod,
          booking_id: bookingId,
          manual_booking: true,
          amount_collected_cents: collectedCents,
          remaining_after_cents: remainingCents,
        },
      });
    } catch (e) {
      console.error('[manual-booking] Senzai payment event failed:', (e as Error).message);
    }
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
      status: remainingCents > 0 ? 'pending' : 'paid',
      message:
        `Manual booking confirmed — ${fmtUsd(collectedCents)} collected via ${paymentMethod}` +
        (remainingCents > 0 ? ` (${fmtUsd(remainingCents)} balance pending)` : ''),
      metadata: {
        manual_booking: true,
        payment_method: paymentMethod,
        created_off_platform: true,
        total_amount: booking.total_price ?? 0,
        remaining_balance: remainingCents,
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

// ─── Record a payment on an existing manual booking ─────────────────────────────

export type ManualActionError = { ok: false; status: number; error: string };

export async function recordManualPayment(input: {
  bookingId: string;
  amountCents: number;
  paymentMethod: ManualPaymentMethod;
  adminEmail: string | null;
}): Promise<ManualActionError | { ok: true; collectedCents: number; remainingCents: number }> {
  const supabase = getSupabaseAdmin();
  const source = '/api/admin/manual-booking';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: booking, error } = await (supabase as any)
    .from('bookings')
    .select('id, status, customer_id, lead_id, total_price, deposit_paid_cents, customers(name, email, phone)')
    .eq('id', input.bookingId)
    .eq('booking_source', 'manual')
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !booking) return { ok: false, status: 404, error: 'Manual booking not found' };
  if (booking.status !== 'confirmed' && booking.status !== 'completed') {
    return { ok: false, status: 409, error: `Payments can't be recorded on a ${booking.status} booking.` };
  }

  const totalCents: number = booking.total_price ?? 0;
  const collectedCents: number = booking.deposit_paid_cents ?? 0;
  const balanceCents = Math.max(0, totalCents - collectedCents);
  if (input.amountCents > balanceCents) {
    return {
      ok: false,
      status: 400,
      error:
        `This payment (${fmtUsd(input.amountCents)}) is more than the balance due (${fmtUsd(balanceCents)}). ` +
        'Update the total first with Edit.',
    };
  }

  const newCollected = collectedCents + input.amountCents;
  const balance = manualBalance(totalCents, newCollected);

  // Guard on the collected amount we read so a double-submit can't apply twice.
  // deposit_amount tracks collected too: the dashboard's revenue = deposit_amount
  // (deposit paid) + remaining_balance_amount (once paid, which is 0 here).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let update = (supabase as any)
    .from('bookings')
    .update({
      deposit_amount: newCollected,
      deposit_paid_cents: newCollected,
      payment_method: input.paymentMethod,
      ...balance,
    })
    .eq('id', input.bookingId);
  update =
    booking.deposit_paid_cents === null
      ? update.is('deposit_paid_cents', null)
      : update.eq('deposit_paid_cents', collectedCents);
  const { data: updated, error: updateError } = await update.select('id');

  if (updateError) {
    console.error('[manual-booking] record payment failed:', updateError.message);
    return { ok: false, status: 500, error: 'Failed to record payment' };
  }
  if (!updated || updated.length === 0) {
    return { ok: false, status: 409, error: 'This booking changed while saving — refresh and try again.' };
  }

  const paymentId = randomUUID();
  const occurredAt = new Date().toISOString();
  const customer = (booking.customers ?? null) as CustomerRow;

  try {
    await recordFinancialEvent({
      event_name: 'booking.payment_recorded_manual',
      event_category: 'payment',
      severity: 'info',
      entity_type: 'booking',
      entity_id: input.bookingId,
      booking_id: input.bookingId,
      amount: input.amountCents,
      currency: 'usd',
      status: 'paid',
      message:
        `Manual payment recorded — ${fmtUsd(input.amountCents)} via ${input.paymentMethod}` +
        (balance.remaining_balance_amount > 0 ? ` (${fmtUsd(balance.remaining_balance_amount)} still due)` : ' (paid in full)'),
      metadata: {
        manual_booking: true,
        payment_id: paymentId,
        payment_method: input.paymentMethod,
        collected_total: newCollected,
        remaining_balance: balance.remaining_balance_amount,
        recorded_by: input.adminEmail,
      },
      occurred_at: occurredAt,
      dedupe_key: `manual_payment:${paymentId}`,
    });
  } catch (e) {
    console.error('[manual-booking] financial log failed:', (e as Error).message);
  }

  // Revenue for the Hub: payment.succeeded with stage + method (contract 2026-10-01).
  try {
    await queueSenzaiEvent({
      event_name: 'payment.succeeded',
      occurred_at: occurredAt,
      source_event_id: paymentId,
      idempotency_key: `booking:${input.bookingId}:payment.succeeded:${paymentId}`,
      source_route: source,
      authoritative_source: 'supabase.bookings.manual_payment_recorded',
      entity_type: 'booking',
      entity_id: input.bookingId,
      amount: { value: input.amountCents, currency: 'USD', unit: 'cents' },
      customer: {
        email: customer?.email ?? undefined,
        phone: customer?.phone ?? undefined,
        name: customer?.name ?? undefined,
      },
      refs: {
        booking_id: input.bookingId,
        lead_id: booking.lead_id ?? null,
        customer_id: booking.customer_id ?? null,
      },
      data: {
        stage: manualPaymentStage(totalCents, collectedCents, input.amountCents),
        method: input.paymentMethod,
        booking_id: input.bookingId,
        payment_id: paymentId,
        manual_booking: true,
        amount_collected_cents: input.amountCents,
        balance_amount_cents: balanceCents,
        remaining_after_cents: balance.remaining_balance_amount,
        currency: 'USD',
        recorded_by: input.adminEmail,
      },
    });
  } catch (e) {
    console.error('[manual-booking] Senzai payment event failed:', (e as Error).message);
  }

  return { ok: true, collectedCents: newCollected, remainingCents: balance.remaining_balance_amount };
}

// ─── Edit an existing manual booking ────────────────────────────────────────────

export type ManualBookingUpdate = {
  id: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string | null;
  date?: string;
  time_slot?: string;
  duration_hours?: number;
  /** Lead rider's bike and height (bike sizing). */
  bike_rental?: BikeRental;
  rider_height_inches?: number | null;
  /** Riders 2..N. Without a bike of their own they ride the lead's. */
  additional_participants?: Array<{ name: string; bike_rental?: BikeRental; height_inches?: number | null }>;
  total_cents?: number;
  payment_method?: ManualPaymentMethod;
  admin_notes?: string | null;
  notify_customer?: boolean;
};

export type ManualUpdateResult =
  | ManualActionError
  | {
      ok: true;
      changed: string[];
      calendar: CalendarSyncResult | null;
      waiverReset: boolean;
      email: ManualEmailResult | null;
    };

type Change = { from: string | number | null; to: string | number | null };

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export async function updateManualBooking(
  input: ManualBookingUpdate,
  adminEmail: string | null
): Promise<ManualUpdateResult> {
  const supabase = getSupabaseAdmin();
  const source = '/api/admin/manual-booking';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: booking, error } = await (supabase as any)
    .from('bookings')
    .select(
      'id, status, customer_id, lead_id, date, time_slot, duration_hours, bike_rental, rider_height_inches, participant_info, ' +
        'total_price, deposit_paid_cents, payment_method, admin_notes, waiver_accepted, cal_booking_status, ' +
        'customers(name, email, phone)'
    )
    .eq('id', input.id)
    .eq('booking_source', 'manual')
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !booking) return { ok: false, status: 404, error: 'Manual booking not found' };
  if (booking.status === 'cancelled' || booking.status === 'refunded') {
    return { ok: false, status: 409, error: `A ${booking.status} booking can't be edited.` };
  }

  const customer = (booking.customers ?? null) as CustomerRow;
  const changes: Record<string, Change> = {};
  const customerPatch: Record<string, unknown> = {};
  const bookingPatch: Record<string, unknown> = {};

  // Customer contact (shared by every booking of this customer).
  const newName = input.customer_name?.trim();
  if (newName !== undefined && newName !== (customer?.name ?? '')) {
    changes.customer_name = { from: customer?.name ?? null, to: newName };
    customerPatch.name = newName;
  }
  const newEmail = input.customer_email?.trim().toLowerCase();
  if (newEmail !== undefined && newEmail !== (customer?.email ?? '').toLowerCase()) {
    changes.customer_email = { from: customer?.email ?? null, to: newEmail };
    customerPatch.email = newEmail;
  }
  if (input.customer_phone !== undefined) {
    const newPhone = input.customer_phone?.trim() || null;
    if (newPhone !== (customer?.phone ?? null)) {
      changes.customer_phone = { from: customer?.phone ?? null, to: newPhone };
      customerPatch.phone = newPhone;
    }
  }

  // Schedule.
  for (const field of ['date', 'time_slot', 'duration_hours'] as const) {
    const next = input[field];
    if (next !== undefined && next !== booking[field]) {
      changes[field] = { from: booking[field] ?? null, to: next };
      bookingPatch[field] = next;
    }
  }

  // Riders (the customer is rider 1; these are the additional ones). A rider
  // without a bike of their own rides the lead's (older rows store names only).
  type ManualRider = { name?: string; bike_rental?: BikeRental; height_inches?: number | null };
  const storedRiders = (booking.participant_info ?? []) as ManualRider[];
  const riderKey = (list: ManualRider[]) =>
    JSON.stringify(list.map((p) => [p.name ?? '', p.bike_rental ?? null, p.height_inches ?? null]));
  const describeRiders = (list: ManualRider[]) =>
    list
      .map((p) => `${p.name}${p.bike_rental ? ` (${p.bike_rental}${p.height_inches ? `, ${p.height_inches}"` : ''})` : ''}`)
      .join(', ') || null;
  const oldRiders = storedRiders.map((p) => p.name ?? '');
  let newRiders = oldRiders;
  let riderRows = storedRiders;
  if (input.additional_participants !== undefined) {
    riderRows = input.additional_participants
      .map((p) => ({
        name: p.name.trim(),
        ...(p.bike_rental ? { bike_rental: p.bike_rental } : {}),
        ...(p.height_inches ? { height_inches: p.height_inches } : {}),
      }))
      .filter((p) => p.name);
    newRiders = riderRows.map((p) => p.name ?? '');
    if (riderKey(riderRows) !== riderKey(storedRiders)) {
      changes.riders = { from: describeRiders(storedRiders), to: describeRiders(riderRows) };
      bookingPatch.participant_info = riderRows.length > 0 ? riderRows : null;
      bookingPatch.participant_count = 1 + riderRows.length;
    }
  }
  if (input.bike_rental !== undefined && input.bike_rental !== booking.bike_rental) {
    changes.bike_rental = { from: booking.bike_rental ?? null, to: input.bike_rental };
    bookingPatch.bike_rental = input.bike_rental;
  }
  if (input.rider_height_inches !== undefined && (input.rider_height_inches ?? null) !== (booking.rider_height_inches ?? null)) {
    changes.rider_height_inches = { from: booking.rider_height_inches ?? null, to: input.rider_height_inches ?? null };
    bookingPatch.rider_height_inches = input.rider_height_inches ?? null;
  }

  // Money — the agreed total. Collected only changes through recordManualPayment.
  const collectedCents: number = booking.deposit_paid_cents ?? 0;
  if (input.total_cents !== undefined && input.total_cents !== (booking.total_price ?? 0)) {
    if (input.total_cents < collectedCents) {
      return {
        ok: false,
        status: 400,
        error: `The total can't be less than what has already been collected (${fmtUsd(collectedCents)}).`,
      };
    }
    changes.total = { from: booking.total_price ?? 0, to: input.total_cents };
    Object.assign(bookingPatch, {
      total_price: input.total_cents,
      base_price: input.total_cents,
      ...manualBalance(input.total_cents, collectedCents),
    });
  }
  if (input.payment_method !== undefined && input.payment_method !== booking.payment_method) {
    changes.payment_method = { from: booking.payment_method ?? null, to: input.payment_method };
    bookingPatch.payment_method = input.payment_method;
  }
  if (input.admin_notes !== undefined) {
    const notes = input.admin_notes?.trim() || null;
    if (notes !== (booking.admin_notes ?? null)) {
      changes.admin_notes = { from: booking.admin_notes ?? null, to: notes };
      bookingPatch.admin_notes = notes;
    }
  }

  // A new date or different riders / bikes needs rental inventory (the DB trigger
  // only checks on INSERT). This booking's own bikes don't count.
  if (changes.date || changes.riders || changes.bike_rental) {
    const inventory = await validateBookingInventory(
      (input.date ?? booking.date) as string,
      (input.bike_rental ?? booking.bike_rental ?? 'none') as BikeRental,
      {},
      riderRows.map((p) => ({ bike_rental: p.bike_rental })),
      { excludeBookingId: booking.id }
    );
    if (!inventory.valid) return { ok: false, status: 409, error: inventory.errors[0] ?? 'No rental inventory for that date.' };
  }

  // Riders who weren't on the booking before and aren't covered by a signed
  // waiver need to sign: reopen the waiver link (past signatures are kept).
  let waiverReset = false;
  if (booking.waiver_accepted && (changes.riders || changes.customer_name)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: records } = await (supabase as any)
      .from('waiver_records')
      .select('participants_covered')
      .eq('booking_id', input.id);
    const covered = new Set(
      ((records ?? []) as Array<{ participants_covered: string[] | null }>)
        .flatMap((r) => r.participants_covered ?? [])
        .map(normalizeName)
    );
    const before = new Set([customer?.name ?? '', ...oldRiders].map(normalizeName));
    const uncovered = [newName ?? customer?.name ?? '', ...newRiders].filter(
      (name) => name && !before.has(normalizeName(name)) && !covered.has(normalizeName(name))
    );
    if (uncovered.length > 0) {
      waiverReset = true;
      // waiver_accepted_at is kept: "not accepted + signed before" = needs update.
      bookingPatch.waiver_accepted = false;
      changes.waiver = { from: 'signed', to: `needs signature: ${uncovered.join(', ')}` };
    }
  }

  if (Object.keys(customerPatch).length > 0) {
    if (!booking.customer_id) return { ok: false, status: 409, error: 'This booking has no customer record.' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: customerError } = await (supabase as any)
      .from('customers')
      .update(customerPatch)
      .eq('id', booking.customer_id);
    if (customerError) {
      if (customerError.code === '23505') {
        return { ok: false, status: 409, error: 'That email already belongs to another customer.' };
      }
      console.error('[manual-booking] customer update failed:', customerError.message);
      return { ok: false, status: 500, error: 'Failed to update the customer' };
    }
  }

  if (Object.keys(bookingPatch).length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: bookingError } = await (supabase as any)
      .from('bookings')
      .update(bookingPatch)
      .eq('id', input.id);
    if (bookingError) {
      console.error('[manual-booking] booking update failed:', bookingError.message);
      return { ok: false, status: 500, error: 'Failed to update the booking' };
    }
  }

  // Move the calendar event with the tour (or create it if it never got made).
  const scheduleChanged = Boolean(changes.date || changes.time_slot || changes.duration_hours);
  let calendar: CalendarSyncResult | null = null;
  if (scheduleChanged || booking.cal_booking_status !== 'created') {
    calendar = await syncBookingCalendarEvent(input.id, { source, reason: 'Tour details updated' });
  }

  // Senzai — only a new date/time/duration is a business event (booking.rescheduled in
  // the contract catalog); contact, rider, price and note edits stay in the app.
  const changed = Object.keys(changes);
  if (scheduleChanged) {
    const occurredAt = new Date().toISOString();
    try {
      await queueSenzaiEvent({
        event_name: 'booking.rescheduled',
        occurred_at: occurredAt,
        source_event_id: `${input.id}:${occurredAt}`,
        idempotency_key: `booking:${input.id}:booking.rescheduled:${occurredAt}`,
        source_route: source,
        authoritative_source: 'supabase.bookings.admin_edit',
        entity_type: 'booking',
        entity_id: input.id,
        refs: {
          booking_id: input.id,
          lead_id: booking.lead_id ?? null,
          customer_id: booking.customer_id ?? null,
        },
        data: {
          booking_id: input.id,
          manual_booking: true,
          previous_date: booking.date ?? null,
          date: input.date ?? booking.date ?? null,
          previous_time: booking.time_slot ?? null,
          time: input.time_slot ?? booking.time_slot ?? null,
          previous_duration_hours: booking.duration_hours ?? null,
          duration_hours: input.duration_hours ?? booking.duration_hours ?? null,
          rescheduled_by: adminEmail,
        },
      });
    } catch (e) {
      console.error('[manual-booking] Senzai booking.rescheduled failed:', (e as Error).message);
    }
  }

  // "Your booking was updated" with what the customer cares about.
  const CUSTOMER_LABELS: Record<string, string> = {
    customer_name: 'Name',
    date: 'Date',
    time_slot: 'Time',
    duration_hours: 'Duration (hours)',
    riders: 'Other riders',
    bike_rental: 'Lead rider bike',
    total: 'Price',
  };
  const changesSummary = Object.entries(changes)
    .filter(([field]) => CUSTOMER_LABELS[field])
    .map(([field, change]) => {
      const show = (v: string | number | null) => (v === null ? '—' : field === 'total' ? fmtUsd(Number(v)) : String(v));
      return `${CUSTOMER_LABELS[field]}: ${show(change.from)} → ${show(change.to)}`;
    });
  const email = input.notify_customer
    ? await sendManualBookingEmail(input.id, { resend: true, source, changesSummary })
    : null;

  console.log(`[manual-booking] ${input.id} updated by ${adminEmail ?? 'admin'}: ${changed.join(', ') || 'no changes'}`);
  return { ok: true, changed, calendar, waiverReset, email };
}

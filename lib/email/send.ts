import 'server-only';

// The three transactional emails, each behind its switch (lib/email/config.ts).
//
// Every caller builds the SAME payload it has always sent to n8n. If the type is
// switched over (`KIGARU_EMAIL_TYPES`), the payload is rendered with the app's
// template and queued for the Kigaru hub; if not, it goes to n8n exactly as before.
// Either way the caller gets an `N8nWebhookResult`, so the booking columns that
// record the attempt (`webhook_sent`, `webhook_last_status_code`…) keep working.
//
// With Kigaru, `ok` means "the email is the hub's job now, or will be after a
// retry" (lib/email/outbox.ts): a hub outage retries on its own and alerts if it
// gives up. `ok: false` means it will NOT go out unless someone acts.

import { randomUUID } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabase';
import { triggerN8nEvent, type N8nWebhookResult } from '@/lib/n8n';
import { getBookingLocationMeta } from '@/lib/location-meta';
import { getAppUrl } from '@/lib/app-url';
import { sendsViaKigaru } from './config';
import { queueEmail, type QueueEmailResult } from './outbox';
import { renderBookingConfirmed, type BookingConfirmedPayload } from './templates/booking-confirmed';
import {
  renderRemainingBalanceFailed,
  renderRemainingBalancePaid,
  type RemainingBalancePayload,
} from './templates/remaining-balance';

export type EmailSendResult = N8nWebhookResult & { via: 'kigaru' | 'n8n' };

type N8nRoute = { envKeys?: string[]; webhookUrl?: string | null };

function fromQueue(result: QueueEmailResult, attemptedAt: string): EmailSendResult {
  return {
    ok: result.ok,
    attemptedAt,
    statusCode: result.httpStatus,
    error: result.ok ? null : (result.error ?? result.state),
    via: 'kigaru',
  };
}

async function viaN8n(event: string, data: Record<string, unknown>, source: string, route: N8nRoute = {}): Promise<EmailSendResult> {
  const result = await triggerN8nEvent({
    event,
    data,
    source,
    envKeys: route.envKeys ?? ['N8N_WEBHOOK_URL'],
    webhookUrl: route.webhookUrl,
  });
  return { ...result, via: 'n8n' };
}

/**
 * booking_confirmed: the confirmation after checkout, a free or manual booking,
 * and "your booking was updated" after an admin edit.
 *
 * `repeat` = an email the operator asked for again (a resend, an edit, the
 * retrigger button): it gets its own idempotency key. The first confirmation of a
 * booking always uses `booking_confirmed:<booking id>`, so a Stripe webhook that
 * arrives twice can't send it twice.
 */
export async function sendBookingConfirmedEmail(input: {
  data: BookingConfirmedPayload;
  source: string;
  repeat?: boolean;
  n8n?: N8nRoute;
}): Promise<EmailSendResult> {
  const attemptedAt = new Date().toISOString();
  if (!sendsViaKigaru('booking_confirmed')) return viaN8n('booking_confirmed', input.data, input.source, input.n8n);

  const { subject, html, text } = renderBookingConfirmed(input.data);
  const key = input.repeat
    ? `booking_confirmed:${input.data.booking_id}:${randomUUID()}`
    : `booking_confirmed:${input.data.booking_id}`;
  const result = await queueEmail({
    type: 'booking_confirmed',
    to: input.data.customer_email ?? '',
    subject,
    html,
    text,
    idempotencyKey: key,
    entityType: 'booking',
    entityId: input.data.booking_id,
  });
  return fromQueue(result, attemptedAt);
}

/** remaining_balance_paid: the balance charged the day before the ride went through. One per PaymentIntent. */
export async function sendRemainingBalancePaidEmail(input: {
  data: RemainingBalancePayload;
  source: string;
  n8n?: N8nRoute;
}): Promise<EmailSendResult> {
  const attemptedAt = new Date().toISOString();
  if (!sendsViaKigaru('remaining_balance_paid')) return viaN8n('remaining_balance_paid', input.data, input.source, input.n8n);

  const { subject, html, text } = renderRemainingBalancePaid(input.data);
  const result = await queueEmail({
    type: 'remaining_balance_paid',
    to: input.data.customer_email ?? '',
    subject,
    html,
    text,
    idempotencyKey: `remaining_balance_paid:${input.data.payment_intent_id}`,
    entityType: 'booking',
    entityId: input.data.booking_id,
  });
  return fromQueue(result, attemptedAt);
}

type FailedBookingRow = {
  id: string;
  date: string | null;
  time_slot: string | null;
  duration_hours: number | null;
  participant_count: number | null;
  customers?: { name: string | null; email: string | null } | null;
  locations?: { name: string | null } | null;
};

/**
 * remaining_balance_failed: the balance charge didn't go through. One per
 * PaymentIntent (the daily charge, then each admin retry).
 *
 * Through n8n it keeps the old payload (booking, PaymentIntent, error), which
 * never named the guest. Through Kigaru the guest is read from the booking here.
 */
export async function sendRemainingBalanceFailedEmail(input: {
  bookingId: string;
  paymentIntentId: string;
  amount: number | null;
  errorMessage: string;
  source: string;
}): Promise<EmailSendResult> {
  const attemptedAt = new Date().toISOString();
  if (!sendsViaKigaru('remaining_balance_failed')) {
    return viaN8n(
      'remaining_balance_failed',
      { booking_id: input.bookingId, payment_intent_id: input.paymentIntentId, error_message: input.errorMessage },
      input.source,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: booking, error } = await (getSupabaseAdmin() as any)
    .from('bookings')
    .select('id, date, time_slot, duration_hours, participant_count, customers(name, email), locations(name)')
    .eq('id', input.bookingId)
    .maybeSingle();
  if (error || !booking) {
    return { ok: false, attemptedAt, statusCode: null, error: `booking not found: ${error?.message ?? input.bookingId}`, via: 'kigaru' };
  }
  const row = booking as FailedBookingRow;
  const locationName = row.locations?.name ?? null;
  const meeting = getBookingLocationMeta(locationName ?? 'Florida Mountain Bike Guides');
  const data: RemainingBalancePayload = {
    booking_id: row.id,
    payment_intent_id: input.paymentIntentId,
    amount: input.amount,
    customer_email: row.customers?.email ?? null,
    customer_name: row.customers?.name ?? null,
    location: locationName,
    date: row.date,
    time: row.time_slot,
    duration_hours: row.duration_hours,
    participant_count: row.participant_count,
    meeting_location_url: meeting.meetingPointUrl,
    calendar_url: `${getAppUrl()}/api/calendar/${row.id}`,
  };
  const { subject, html, text } = renderRemainingBalanceFailed(data);
  const result = await queueEmail({
    type: 'remaining_balance_failed',
    to: data.customer_email ?? '',
    subject,
    html,
    text,
    idempotencyKey: `remaining_balance_failed:${input.paymentIntentId}`,
    entityType: 'booking',
    entityId: row.id,
  });
  return fromQueue(result, attemptedAt);
}

// The admin's money actions on an ONLINE booking, usually right after an edit
// changed its price (see lib/booking-money.ts for the model):
//
//   charge_card    — charge the saved card for what the customer still owes
//   record_payment — cash / Zelle / Venmo collected outside Stripe
//   refund_card    — refund to the card (balance charge first, then the deposit)
//   record_refund  — money handed back outside Stripe
//
// Each one moves extra_paid_cents / refunded_cents, writes Fin Log and reports to
// Senzai. Card refunds carry metadata.initiated_by = 'admin' so the Stripe
// webhook doesn't count them a second time.

import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase';
import { stripe } from '@/lib/stripe';
import { recordFinancialEvent } from '@/lib/financial-log';
import { queueSenzaiEvent } from '@/lib/analytics-delivery';
import {
  STRIPE_MIN_CHARGE_CENTS,
  formatUsd,
  netCollectedCents,
  scheduledChargeCents,
  unsettledCents,
  type BookingMoneyRow,
} from '@/lib/booking-money';

const SOURCE = '/api/admin/bookings/payments';

export type OffPlatformMethod = 'cash' | 'zelle' | 'venmo' | 'other';

export type PaymentAction =
  | { action: 'charge_card'; amount_cents: number; request_id: string }
  | { action: 'record_payment'; amount_cents: number; method: OffPlatformMethod; request_id: string }
  | { action: 'refund_card'; amount_cents: number; request_id: string; reason?: string | null }
  | { action: 'record_refund'; amount_cents: number; method: OffPlatformMethod; request_id: string; reason?: string | null };

export type PaymentResult =
  | { ok: false; status: number; error: string }
  | { ok: true; message: string; collected_cents: number; unsettled_cents: number };

type PaymentBookingRow = BookingMoneyRow & {
  id: string;
  status: string;
  date: string;
  lead_id: string | null;
  customer_id: string | null;
  stripe_customer_id: string | null;
  stripe_payment_intent_id: string | null;
  deposit_payment_intent_id: string | null;
  remaining_balance_payment_intent_id: string | null;
  customers: { name?: string; email?: string; phone?: string | null } | null;
  locations: { name?: string } | null;
};

const PAYMENT_BOOKING_COLUMNS =
  'id, status, booking_source, date, lead_id, customer_id, total_price, total_after_discount_cents, ' +
  'deposit_paid_cents, deposit_payment_status, remaining_balance_amount, remaining_balance_status, ' +
  'extra_paid_cents, refunded_cents, stripe_customer_id, stripe_payment_method_id, stripe_payment_intent_id, ' +
  'deposit_payment_intent_id, remaining_balance_payment_intent_id, customers(name, email, phone), locations(name)';

async function loadBooking(bookingId: string): Promise<PaymentBookingRow | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (getSupabaseAdmin() as any)
    .from('bookings')
    .select(PAYMENT_BOOKING_COLUMNS)
    .eq('id', bookingId)
    .is('deleted_at', null)
    .maybeSingle();
  return (data as PaymentBookingRow | null) ?? null;
}

/** Fin Log is the receipt book: a dedupe key that's already there was already applied. */
async function alreadyRecorded(eventName: string, dedupeKey: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (getSupabaseAdmin() as any)
    .from('financial_event_logs')
    .select('id')
    .eq('event_name', eventName)
    .contains('metadata', { dedupe_key: dedupeKey })
    .limit(1);
  return (data ?? []).length > 0;
}

/** Add to extra_paid_cents / refunded_cents without losing a concurrent write. */
export async function addToMoneyColumn(
  bookingId: string,
  column: 'extra_paid_cents' | 'refunded_cents',
  amountCents: number
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  for (let attempt = 0; attempt < 3; attempt++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).from('bookings').select(column).eq('id', bookingId).maybeSingle();
    const current = Number((data as Record<string, number> | null)?.[column] ?? 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updated } = await (supabase as any)
      .from('bookings')
      .update({ [column]: current + amountCents })
      .eq('id', bookingId)
      .eq(column, current)
      .select('id');
    if (updated && updated.length > 0) return true;
  }
  console.error(`[booking-payments] could not update ${column} on ${bookingId}`);
  return false;
}

async function reportPayment(booking: PaymentBookingRow, input: {
  amountCents: number;
  method: string;
  paymentId: string;
  adminEmail: string | null;
}) {
  try {
    await queueSenzaiEvent({
      event_name: 'payment.succeeded',
      occurred_at: new Date().toISOString(),
      source_event_id: input.paymentId,
      idempotency_key: `booking:${booking.id}:payment.succeeded:${input.paymentId}`,
      source_route: SOURCE,
      authoritative_source: 'supabase.bookings.admin_adjustment',
      entity_type: 'booking',
      entity_id: booking.id,
      amount: { value: input.amountCents, currency: 'USD', unit: 'cents' },
      customer: {
        email: booking.customers?.email ?? undefined,
        phone: booking.customers?.phone ?? undefined,
        name: booking.customers?.name ?? undefined,
      },
      refs: { booking_id: booking.id, lead_id: booking.lead_id, customer_id: booking.customer_id },
      data: {
        stage: 'balance',
        method: input.method,
        booking_id: booking.id,
        payment_id: input.paymentId,
        adjustment: true,
        amount_collected_cents: input.amountCents,
        currency: 'USD',
        recorded_by: input.adminEmail,
      },
    });
  } catch (e) {
    console.error('[booking-payments] Senzai payment event failed:', (e as Error).message);
  }
}

async function reportRefund(booking: PaymentBookingRow, input: {
  amountCents: number;
  method: string;
  refundId: string;
  paymentIntentId?: string | null;
  reason: string | null;
  adminEmail: string | null;
}) {
  try {
    await queueSenzaiEvent({
      event_name: 'refund.processed',
      occurred_at: new Date().toISOString(),
      source_event_id: input.refundId,
      idempotency_key: `booking:${booking.id}:refund.processed:${input.refundId}`,
      source_route: SOURCE,
      authoritative_source: 'supabase.bookings.admin_refund',
      entity_type: 'refund',
      entity_id: input.refundId,
      amount: { value: input.amountCents, currency: 'USD', unit: 'cents' },
      refs: {
        booking_id: booking.id,
        lead_id: booking.lead_id,
        payment_intent_id: input.paymentIntentId ?? null,
      },
      data: {
        booking_id: booking.id,
        method: input.method,
        refund_id: input.refundId,
        payment_intent_id: input.paymentIntentId ?? null,
        amount_refunded_cents: input.amountCents,
        reason: input.reason,
        partial: true,
        recorded_by: input.adminEmail,
        charge_type: 'refund',
      },
    });
  } catch (e) {
    console.error('[booking-payments] Senzai refund event failed:', (e as Error).message);
  }
}

/**
 * A refund made straight in the Stripe dashboard that doesn't refund the whole
 * booking (Stripe webhook): count it toward refunded_cents and keep the booking
 * as it is. Idempotent per Stripe refund.
 */
export async function recordStripeDashboardRefund(input: {
  bookingId: string;
  leadId: string | null;
  refundId: string;
  amountCents: number;
  paymentIntentId: string;
}): Promise<void> {
  const dedupeKey = `stripe_refund:${input.refundId}`;
  if (await alreadyRecorded('booking.refund_issued', dedupeKey)) return;
  await addToMoneyColumn(input.bookingId, 'refunded_cents', input.amountCents);
  await recordFinancialEvent({
    event_name: 'booking.refund_issued',
    event_category: 'refund',
    severity: 'info',
    entity_type: 'booking',
    entity_id: input.bookingId,
    booking_id: input.bookingId,
    lead_id: input.leadId,
    payment_intent_id: input.paymentIntentId,
    amount: input.amountCents,
    currency: 'usd',
    status: 'refunded',
    message: `Partial refund of ${formatUsd(input.amountCents)} made in Stripe — the booking stays active`,
    metadata: { refund_id: input.refundId, source: 'stripe_dashboard' },
    dedupe_key: dedupeKey,
  });
}

/** Card payments on this booking that can still be refunded, newest first. */
async function refundableCardPayments(booking: PaymentBookingRow): Promise<Array<{ paymentIntentId: string; refundable: number }>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: adjustments } = await (getSupabaseAdmin() as any)
    .from('financial_event_logs')
    .select('payment_intent_id, occurred_at')
    .eq('booking_id', booking.id)
    .eq('event_name', 'booking.adjustment_charged')
    .order('occurred_at', { ascending: false });

  const ids = [
    ...((adjustments ?? []) as Array<{ payment_intent_id: string | null }>).map((row) => row.payment_intent_id),
    booking.remaining_balance_status === 'paid' ? booking.remaining_balance_payment_intent_id : null,
    booking.deposit_payment_intent_id ?? booking.stripe_payment_intent_id,
  ].filter((id): id is string => Boolean(id && id.startsWith('pi_')));

  const payments: Array<{ paymentIntentId: string; refundable: number }> = [];
  for (const id of [...new Set(ids)]) {
    const pi = await stripe.paymentIntents.retrieve(id, { expand: ['latest_charge'] });
    const charge = pi.latest_charge && typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
    if (!charge || charge.status !== 'succeeded') continue;
    const refundable = charge.amount - charge.amount_refunded;
    if (refundable > 0) payments.push({ paymentIntentId: id, refundable });
  }
  return payments;
}

export async function applyBookingPayment(
  bookingId: string,
  input: PaymentAction,
  adminEmail: string | null
): Promise<PaymentResult> {
  const booking = await loadBooking(bookingId);
  if (!booking) return { ok: false, status: 404, error: 'Booking not found' };
  if (booking.booking_source === 'manual') {
    return { ok: false, status: 400, error: 'Use "Record payment" on the Manual Booking page for manual bookings.' };
  }
  if (booking.status !== 'confirmed' && booking.status !== 'completed') {
    return { ok: false, status: 409, error: `Payments can't change on a ${booking.status} booking.` };
  }

  const amount = input.amount_cents;
  const owed = Math.max(0, unsettledCents(booking));
  const collected = netCollectedCents(booking);
  const tour = `${booking.locations?.name ?? 'Tour'} on ${booking.date}`;
  const done = async (message: string): Promise<PaymentResult> => {
    const fresh = (await loadBooking(bookingId)) ?? booking;
    return { ok: true, message, collected_cents: netCollectedCents(fresh), unsettled_cents: unsettledCents(fresh) };
  };

  // ── Charge the saved card ─────────────────────────────────────────────────────
  if (input.action === 'charge_card') {
    if (amount > owed) {
      return { ok: false, status: 400, error: `That's more than the customer owes (${formatUsd(owed)}).` };
    }
    if (amount < STRIPE_MIN_CHARGE_CENTS) {
      return { ok: false, status: 400, error: 'Card charges must be at least $0.50.' };
    }
    if (!booking.stripe_customer_id || !booking.stripe_payment_method_id) {
      return { ok: false, status: 400, error: 'There is no saved card on this booking — record the payment instead.' };
    }

    let paymentIntentId: string | null = null;
    try {
      const pi = await stripe.paymentIntents.create(
        {
          amount,
          currency: 'usd',
          customer: booking.stripe_customer_id,
          payment_method: booking.stripe_payment_method_id,
          confirm: true,
          off_session: true,
          description: `Booking change - ${tour}`,
          metadata: { booking_id: booking.id, charge_type: 'adjustment' },
        },
        // The same request (a double click) never charges twice.
        { idempotencyKey: `adjustment-${booking.id}-${input.request_id}` }
      );
      paymentIntentId = pi.id;
      if (pi.status !== 'succeeded') throw new Error(`Payment ended with status ${pi.status}`);
    } catch (e) {
      const message = (e as Error).message ?? 'The card was declined';
      await recordFinancialEvent({
        event_name: 'booking.adjustment_charge_failed',
        event_category: 'payment',
        severity: 'warning',
        entity_type: 'booking',
        entity_id: booking.id,
        booking_id: booking.id,
        lead_id: booking.lead_id,
        payment_intent_id: paymentIntentId,
        amount,
        currency: 'usd',
        status: 'failed',
        requires_attention: true,
        message: `Extra charge of ${formatUsd(amount)} to the saved card failed: ${message}`,
        metadata: { charged_by: adminEmail, request_id: input.request_id },
      });
      return { ok: false, status: 402, error: `The card charge failed: ${message}` };
    }

    const dedupeKey = `pi:${paymentIntentId}`;
    if (await alreadyRecorded('booking.adjustment_charged', dedupeKey)) return done('This charge was already recorded.');
    await addToMoneyColumn(booking.id, 'extra_paid_cents', amount);
    await recordFinancialEvent({
      event_name: 'booking.adjustment_charged',
      event_category: 'payment',
      severity: 'info',
      entity_type: 'booking',
      entity_id: booking.id,
      booking_id: booking.id,
      lead_id: booking.lead_id,
      payment_intent_id: paymentIntentId,
      amount,
      currency: 'usd',
      status: 'paid',
      message: `Extra charge of ${formatUsd(amount)} to the saved card after a booking change`,
      metadata: { charged_by: adminEmail, request_id: input.request_id },
      dedupe_key: dedupeKey,
    });
    await reportPayment(booking, { amountCents: amount, method: 'stripe', paymentId: paymentIntentId as string, adminEmail });
    return done(`Charged ${formatUsd(amount)} to the saved card.`);
  }

  // ── Off-platform payment ──────────────────────────────────────────────────────
  // It can also cover the balance waiting to be charged to the card (the customer
  // pays it in cash instead): that card charge shrinks by the excess.
  if (input.action === 'record_payment') {
    const scheduled = scheduledChargeCents(booking);
    if (amount > owed + scheduled) {
      return { ok: false, status: 400, error: `That's more than the customer still owes (${formatUsd(owed + scheduled)}).` };
    }
    const dedupeKey = `payment:${input.request_id}`;
    if (await alreadyRecorded('booking.payment_recorded', dedupeKey)) return done('This payment was already recorded.');

    const fromScheduled = Math.max(0, amount - owed);
    if (fromScheduled > 0) {
      const left = scheduled - fromScheduled;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: lowered } = await (getSupabaseAdmin() as any)
        .from('bookings')
        .update(
          left >= STRIPE_MIN_CHARGE_CENTS
            ? { remaining_balance_amount: left }
            : { remaining_balance_amount: 0, remaining_balance_status: 'waived' }
        )
        .eq('id', booking.id)
        .eq('remaining_balance_amount', scheduled)
        // Not while the cron is charging it (a failed charge keeps its PI id).
        .or('remaining_balance_payment_intent_id.is.null,remaining_balance_payment_intent_id.neq.processing')
        .select('id');
      if (!lowered || lowered.length === 0) {
        return { ok: false, status: 409, error: 'The card balance is being charged or just changed — refresh and try again.' };
      }
    }
    await addToMoneyColumn(booking.id, 'extra_paid_cents', amount);
    await recordFinancialEvent({
      event_name: 'booking.payment_recorded',
      event_category: 'payment',
      severity: 'info',
      entity_type: 'booking',
      entity_id: booking.id,
      booking_id: booking.id,
      lead_id: booking.lead_id,
      amount,
      currency: 'usd',
      status: 'paid',
      message: `Payment of ${formatUsd(amount)} recorded via ${input.method} after a booking change`,
      metadata: { payment_method: input.method, recorded_by: adminEmail, request_id: input.request_id },
      dedupe_key: dedupeKey,
    });
    await reportPayment(booking, { amountCents: amount, method: input.method, paymentId: input.request_id, adminEmail });
    return done(`Recorded ${formatUsd(amount)} paid via ${input.method}.`);
  }

  // ── Refunds (never more than what was collected) ──────────────────────────────
  if (amount > collected) {
    return { ok: false, status: 400, error: `That's more than what was collected (${formatUsd(collected)}).` };
  }
  const reason = input.reason?.trim() || null;

  if (input.action === 'record_refund') {
    const dedupeKey = `refund:${input.request_id}`;
    if (await alreadyRecorded('booking.refund_recorded', dedupeKey)) return done('This refund was already recorded.');
    await addToMoneyColumn(booking.id, 'refunded_cents', amount);
    await recordFinancialEvent({
      event_name: 'booking.refund_recorded',
      event_category: 'refund',
      severity: 'info',
      entity_type: 'booking',
      entity_id: booking.id,
      booking_id: booking.id,
      lead_id: booking.lead_id,
      amount,
      currency: 'usd',
      status: 'refunded',
      message: `Refund of ${formatUsd(amount)} given via ${input.method}${reason ? ` — ${reason}` : ''}`,
      metadata: { payment_method: input.method, reason, recorded_by: adminEmail, request_id: input.request_id },
      dedupe_key: dedupeKey,
    });
    await reportRefund(booking, { amountCents: amount, method: input.method, refundId: input.request_id, reason, adminEmail });
    return done(`Recorded a ${formatUsd(amount)} refund via ${input.method}.`);
  }

  // refund_card: spread over the card payments, newest first.
  let payments: Array<{ paymentIntentId: string; refundable: number }>;
  try {
    payments = await refundableCardPayments(booking);
  } catch (e) {
    console.error('[booking-payments] could not read the card payments:', (e as Error).message);
    return { ok: false, status: 502, error: 'Could not read the card payments from Stripe. Try again.' };
  }
  const refundableTotal = payments.reduce((sum, p) => sum + p.refundable, 0);
  if (amount > refundableTotal) {
    return {
      ok: false,
      status: 400,
      error: `Only ${formatUsd(refundableTotal)} can be refunded to the card. Record the rest as a cash refund.`,
    };
  }

  let left = amount;
  for (const payment of payments) {
    if (left <= 0) break;
    const part = Math.min(left, payment.refundable);
    try {
      const refund = await stripe.refunds.create(
        {
          payment_intent: payment.paymentIntentId,
          amount: part,
          reason: 'requested_by_customer',
          metadata: { booking_id: booking.id, initiated_by: 'admin', request_id: input.request_id },
        },
        { idempotencyKey: `refund-${input.request_id}-${payment.paymentIntentId}` }
      );
      const dedupeKey = `stripe_refund:${refund.id}`;
      if (!(await alreadyRecorded('booking.refund_issued', dedupeKey))) {
        await addToMoneyColumn(booking.id, 'refunded_cents', part);
        await recordFinancialEvent({
          event_name: 'booking.refund_issued',
          event_category: 'refund',
          severity: 'info',
          entity_type: 'booking',
          entity_id: booking.id,
          booking_id: booking.id,
          lead_id: booking.lead_id,
          payment_intent_id: payment.paymentIntentId,
          amount: part,
          currency: 'usd',
          status: 'refunded',
          message: `Refund of ${formatUsd(part)} to the card${reason ? ` — ${reason}` : ''}`,
          metadata: { refund_id: refund.id, reason, refunded_by: adminEmail, request_id: input.request_id },
          dedupe_key: dedupeKey,
        });
        await reportRefund(booking, {
          amountCents: part,
          method: 'stripe',
          refundId: refund.id,
          paymentIntentId: payment.paymentIntentId,
          reason,
          adminEmail,
        });
      }
      left -= part;
    } catch (e) {
      const message = (e as Error).message ?? 'Stripe refused the refund';
      const refunded = amount - left;
      return {
        ok: false,
        status: 502,
        error:
          (refunded > 0 ? `Refunded ${formatUsd(refunded)}, but the rest failed: ` : 'The refund failed: ') + message,
      };
    }
  }
  return done(`Refunded ${formatUsd(amount)} to the card. It reaches the customer in 5–10 business days.`);
}

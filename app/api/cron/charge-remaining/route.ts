/**
 * /api/cron/charge-remaining
 *
 * Called daily by Vercel Cron (vercel.json) and/or n8n.
 * Charges the remaining balance for all confirmed bookings whose
 * remaining_balance_due_at is in the past.
 *
 * Authorization:
 *   Vercel Cron sends: Authorization: Bearer <CRON_SECRET>
 *   Admin / n8n:       x-admin-secret: <ADMIN_SECRET>
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { chargeRemainingBalance } from '@/lib/stripe';
import { sendSenzaiEvent } from '@/lib/senzai-ingest';
import { recordFinancialEvent } from '@/lib/financial-log';
import { notifySupportAlert } from '@/lib/n8n';

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  const adminSecret = process.env.ADMIN_SECRET;
  const adminHeader = req.headers.get('x-admin-secret');
  if (adminSecret && adminHeader === adminSecret) return true;

  return false;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return runChargeJob();
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return runChargeJob();
}

async function runChargeJob(): Promise<NextResponse> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  console.log(`[cron/charge-remaining] Starting run at ${now}`);

  const stuckCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: stuckRows, error: stuckErr } = await supabase
    .from('bookings')
    .update({ remaining_balance_payment_intent_id: null })
    .eq('remaining_balance_payment_intent_id', 'processing')
    .eq('remaining_balance_status', 'pending')
    .lte('updated_at', stuckCutoff)
    .select('id');

  if (stuckErr) {
    console.error('[cron/charge-remaining] Stuck-processing cleanup error:', stuckErr);
  } else if (stuckRows && stuckRows.length > 0) {
    console.warn(
      `[cron/charge-remaining] Cleared ${stuckRows.length} stuck-processing booking(s):`,
      stuckRows.map((row) => row.id)
    );
  }

  const { data: dueBookings, error: fetchError } = await supabase
    .from('bookings')
    .select('id, remaining_balance_amount, stripe_customer_id, stripe_payment_method_id, date, location_id')
    .lte('remaining_balance_due_at', now)
    .eq('remaining_balance_status', 'pending')
    .is('remaining_balance_payment_intent_id', null)
    .not('stripe_payment_method_id', 'is', null)
    .eq('status', 'confirmed');

  if (fetchError) {
    console.error('[cron/charge-remaining] DB fetch error:', fetchError);
    return NextResponse.json({ error: 'DB error', details: fetchError.message }, { status: 500 });
  }

  const bookings = dueBookings ?? [];
  console.log(`[cron/charge-remaining] Found ${bookings.length} booking(s) due for charge`);

  if (bookings.length === 0) {
    return NextResponse.json({ charged: 0, failed: 0, skipped: 0 });
  }

  const locationIds = [...new Set(bookings.map((booking) => booking.location_id).filter(Boolean))];
  const { data: locations } = locationIds.length
    ? await supabase.from('locations').select('id, name').in('id', locationIds as string[])
    : { data: [] };
  const locationMap = Object.fromEntries((locations ?? []).map((location) => [location.id, location.name]));

  const results = { charged: 0, failed: 0, skipped: 0 };

  for (const booking of bookings) {
    const {
      id: bookingId,
      remaining_balance_amount,
      stripe_customer_id,
      stripe_payment_method_id,
      date,
      location_id,
    } = booking as {
      id: string;
      remaining_balance_amount: number | null;
      stripe_customer_id: string | null;
      stripe_payment_method_id: string | null;
      date: string;
      location_id: string | null;
    };

    if (!remaining_balance_amount || !stripe_customer_id || !stripe_payment_method_id) {
      console.warn(`[cron/charge-remaining] Booking ${bookingId} missing required fields - skipping`);
      results.skipped++;
      continue;
    }

    const { data: claimed } = await supabase
      .from('bookings')
      .update({ remaining_balance_payment_intent_id: 'processing' })
      .eq('id', bookingId)
      .is('remaining_balance_payment_intent_id', null)
      .select('id')
      .maybeSingle();

    if (!claimed) {
      console.log(`[cron/charge-remaining] Booking ${bookingId} already claimed by another run - skipping`);
      results.skipped++;
      continue;
    }

    const locationName = location_id ? locationMap[location_id] ?? 'Florida MTB Tour' : 'Florida MTB Tour';
    const attemptedAt = new Date().toISOString();

    await sendSenzaiEvent({
      event_name: 'payment.requested',
      occurred_at: attemptedAt,
      source_event_id: `${bookingId}:remaining_balance:${attemptedAt}`,
      idempotency_key: `booking:${bookingId}:remaining_balance:payment.requested:${attemptedAt}`,
      source_route: '/api/cron/charge-remaining',
      authoritative_source: 'cron.remaining_balance_charge_attempt',
      entity_type: 'payment_request',
      entity_id: `${bookingId}:remaining_balance:${attemptedAt}`,
      refs: {
        booking_id: bookingId,
        stripe_session_id: null,
      },
      data: {
        booking_id: bookingId,
        charge_type: 'remaining_balance',
        payment_provider: 'stripe',
        off_session: true,
        amount: remaining_balance_amount,
        stripe_customer_id,
        stripe_payment_method_id,
        location_id,
        location_name: locationName,
        date,
      },
    });

    await recordFinancialEvent({
      event_name: 'payment.remaining_balance_requested',
      event_category: 'payment',
      severity: 'info',
      entity_type: 'booking',
      entity_id: bookingId,
      booking_id: bookingId,
      amount: remaining_balance_amount,
      currency: 'usd',
      status: 'requested',
      message: 'Cron attempted remaining balance charge',
      metadata: {
        booking_id: bookingId,
        location_name: locationName,
        date,
        stripe_customer_id,
        stripe_payment_method_id,
      },
      occurred_at: attemptedAt,
    });

    const result = await chargeRemainingBalance({
      bookingId,
      stripeCustomerId: stripe_customer_id,
      stripePaymentMethodId: stripe_payment_method_id,
      amount: remaining_balance_amount,
      description: `Remaining balance - ${locationName} on ${date}`,
    });

    if (result.success) {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          remaining_balance_status: 'paid',
          remaining_balance_payment_intent_id: result.paymentIntentId,
        })
        .eq('id', bookingId);

      if (updateError) {
        console.error(
          `[cron/charge-remaining] Failed to update booking ${bookingId} after charge:`,
          updateError
        );
      } else {
        await recordFinancialEvent({
          event_name: 'payment.remaining_balance_succeeded',
          event_category: 'payment',
          severity: 'info',
          entity_type: 'payment_intent',
          entity_id: result.paymentIntentId as string,
          booking_id: bookingId,
          payment_intent_id: result.paymentIntentId ?? null,
          amount: remaining_balance_amount,
          currency: 'usd',
          status: 'paid',
          message: 'Remaining balance charged successfully by cron',
          metadata: {
            booking_id: bookingId,
            location_name: locationName,
            date,
          },
        });
        console.log(`[cron/charge-remaining] Charged booking ${bookingId} - PI ${result.paymentIntentId}`);
        results.charged++;
      }
    } else {
      await supabase
        .from('bookings')
        .update({
          remaining_balance_status: 'failed',
          remaining_balance_payment_intent_id: result.paymentIntentId ?? null,
        })
        .eq('id', bookingId);

      await recordFinancialEvent({
        event_name: 'payment.remaining_balance_failed',
        event_category: 'payment',
        severity: 'error',
        entity_type: 'booking',
        entity_id: bookingId,
        booking_id: bookingId,
        payment_intent_id: result.paymentIntentId ?? null,
        amount: remaining_balance_amount,
        currency: 'usd',
        status: 'failed',
        requires_attention: true,
        message: result.errorMessage ?? 'Remaining balance charge failed',
        metadata: {
          booking_id: bookingId,
          location_name: locationName,
          date,
          stripe_customer_id,
        },
      });

      await notifySupportAlert({
        source: '/api/cron/charge-remaining',
        severity: 'error',
        summary: `Remaining balance charge failed for booking ${bookingId}`,
        bookingId,
        paymentIntentId: result.paymentIntentId ?? null,
        details: {
          error_message: result.errorMessage ?? null,
          amount: remaining_balance_amount,
          date,
          location_name: locationName,
        },
      });

      console.error(`[cron/charge-remaining] FAILED booking ${bookingId}: ${result.errorMessage}`);
      results.failed++;
    }
  }

  console.log(
    `[cron/charge-remaining] Done - charged: ${results.charged}, failed: ${results.failed}, skipped: ${results.skipped}`
  );
  return NextResponse.json(results);
}

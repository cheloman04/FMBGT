/**
 * /api/cron/charge-remaining
 *
 * Called daily by Vercel Cron (vercel.json) and/or n8n.
 * Charges the remaining 50% balance for all bookings whose
 * remaining_balance_due_at is in the past and status is 'pending'.
 *
 * Authorization:
 *   Vercel Cron sends:  Authorization: Bearer <CRON_SECRET>
 *   n8n / manual:       x-admin-secret: <ADMIN_SECRET>
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { chargeRemainingBalance } from '@/lib/stripe';

function isAuthorized(req: NextRequest): boolean {
  // Vercel Cron
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  // Admin / n8n
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

// Vercel Cron uses GET
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

  // Fetch all bookings due for the remaining balance charge.
  // Conditions:
  //   - remaining_balance_due_at is in the past (due now)
  //   - remaining_balance_status = 'pending' (not yet paid or failed)
  //   - remaining_balance_payment_intent_id IS NULL (idempotency: not already attempted)
  //   - stripe_payment_method_id IS NOT NULL (card on file)
  //   - status = 'confirmed' (don't charge cancelled/refunded bookings)
  const { data: duebookings, error: fetchError } = await supabase
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

  const bookings = duebookings ?? [];
  console.log(`[cron/charge-remaining] Found ${bookings.length} booking(s) due for charge`);

  if (bookings.length === 0) {
    return NextResponse.json({ charged: 0, failed: 0, skipped: 0 });
  }

  // Fetch location names for descriptions
  const locationIds = [...new Set(bookings.map((b) => b.location_id).filter(Boolean))];
  const { data: locations } = locationIds.length
    ? await supabase.from('locations').select('id, name').in('id', locationIds as string[])
    : { data: [] };
  const locationMap = Object.fromEntries((locations ?? []).map((l) => [l.id, l.name]));

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
      console.warn(`[cron/charge-remaining] Booking ${bookingId} missing required fields — skipping`);
      results.skipped++;
      continue;
    }

    const locationName = location_id ? locationMap[location_id] ?? 'Florida MTB Tour' : 'Florida MTB Tour';

    const result = await chargeRemainingBalance({
      bookingId,
      stripeCustomerId: stripe_customer_id,
      stripePaymentMethodId: stripe_payment_method_id,
      amount: remaining_balance_amount,
      description: `Remaining balance — ${locationName} on ${date}`,
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
        console.error(`[cron/charge-remaining] Failed to update booking ${bookingId} after charge:`, updateError);
      } else {
        console.log(`[cron/charge-remaining] Charged booking ${bookingId} — PI ${result.paymentIntentId}`);
        results.charged++;
      }
    } else {
      // Mark failed with the PI ID if available (for retry or investigation)
      await supabase
        .from('bookings')
        .update({
          remaining_balance_status: 'failed',
          ...(result.paymentIntentId ? { remaining_balance_payment_intent_id: result.paymentIntentId } : {}),
        })
        .eq('id', bookingId);

      console.error(`[cron/charge-remaining] FAILED booking ${bookingId}: ${result.errorMessage}`);
      results.failed++;
    }
  }

  console.log(`[cron/charge-remaining] Done — charged: ${results.charged}, failed: ${results.failed}, skipped: ${results.skipped}`);
  return NextResponse.json(results);
}

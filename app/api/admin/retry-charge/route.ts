/**
 * /api/admin/retry-charge
 *
 * Admin-only endpoint to retry a failed remaining balance charge.
 * Only operates on bookings with remaining_balance_status = 'failed'.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';
import { chargeRemainingBalance } from '@/lib/stripe';
import { getAdminUserFromCookieStore } from '@/lib/admin-auth';

const Schema = z.object({
  booking_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const adminUser = await getAdminUserFromCookieStore(cookieStore);
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { booking_id } = parsed.data;
  const supabase = getSupabaseAdmin();

  // Fetch the booking — only allow retry for failed charges
  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('id, remaining_balance_amount, remaining_balance_status, stripe_customer_id, stripe_payment_method_id, date, location_id, status')
    .eq('id', booking_id)
    .single();

  if (fetchError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const b = booking as {
    id: string;
    remaining_balance_amount: number | null;
    remaining_balance_status: string;
    stripe_customer_id: string | null;
    stripe_payment_method_id: string | null;
    date: string;
    location_id: string | null;
    status: string;
  };

  if (b.remaining_balance_status !== 'failed') {
    return NextResponse.json(
      { error: `Cannot retry — current status is "${b.remaining_balance_status}"` },
      { status: 400 }
    );
  }

  if (b.status === 'cancelled' || b.status === 'refunded') {
    return NextResponse.json(
      { error: `Cannot charge a ${b.status} booking` },
      { status: 400 }
    );
  }

  if (!b.remaining_balance_amount || !b.stripe_customer_id || !b.stripe_payment_method_id) {
    return NextResponse.json(
      { error: 'Missing payment data on booking — cannot retry' },
      { status: 400 }
    );
  }

  // Fetch location name for description
  let locationName = 'Florida MTB Tour';
  if (b.location_id) {
    const { data: loc } = await supabase
      .from('locations')
      .select('name')
      .eq('id', b.location_id)
      .single();
    if (loc) locationName = (loc as { name: string }).name;
  }

  // Atomically claim the booking for this retry run.
  // Sets PI to a sentinel so a concurrent cron run or second admin retry is blocked.
  const { data: claimed } = await supabase
    .from('bookings')
    .update({ remaining_balance_payment_intent_id: 'processing', remaining_balance_status: 'pending' })
    .eq('id', booking_id)
    .eq('remaining_balance_status', 'failed')
    .select('id')
    .maybeSingle();

  if (!claimed) {
    // Another retry or cron run is already in flight for this booking
    return NextResponse.json(
      { error: 'A retry is already in progress for this booking — try again in a moment.' },
      { status: 409 }
    );
  }

  const result = await chargeRemainingBalance({
    bookingId: booking_id,
    stripeCustomerId: b.stripe_customer_id,
    stripePaymentMethodId: b.stripe_payment_method_id,
    amount: b.remaining_balance_amount,
    description: `Remaining balance (retry) — ${locationName} on ${b.date}`,
    idempotencySuffix: `retry-${Date.now()}`,
  });

  if (result.success) {
    await supabase
      .from('bookings')
      .update({
        remaining_balance_status: 'paid',
        remaining_balance_payment_intent_id: result.paymentIntentId,
      })
      .eq('id', booking_id);

    console.log(`[admin/retry-charge] SUCCESS booking ${booking_id} — PI ${result.paymentIntentId}`);
    return NextResponse.json({ ok: true, paymentIntentId: result.paymentIntentId });
  } else {
    // Clear sentinel so the button re-appears and the next retry can claim the booking
    await supabase
      .from('bookings')
      .update({
        remaining_balance_status: 'failed',
        remaining_balance_payment_intent_id: result.paymentIntentId ?? null,
      })
      .eq('id', booking_id);

    console.error(`[admin/retry-charge] FAILED booking ${booking_id}: ${result.errorMessage}`);
    return NextResponse.json(
      { error: result.errorMessage ?? 'Charge failed' },
      { status: 402 }
    );
  }
}

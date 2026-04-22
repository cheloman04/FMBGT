import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAdminUserFromCookieStore } from '@/lib/admin-auth';
import { recordFinancialEvent } from '@/lib/financial-log';

const Schema = z.object({
  booking_id: z.string().uuid(),
});

function bookingHasFinancialHistory(booking: {
  status: string;
  deposit_payment_status?: string | null;
  remaining_balance_status?: string | null;
  stripe_session_id?: string | null;
  stripe_customer_id?: string | null;
  stripe_payment_method_id?: string | null;
  stripe_payment_intent_id?: string | null;
  deposit_payment_intent_id?: string | null;
  remaining_balance_payment_intent_id?: string | null;
}) {
  return (
    booking.status === 'confirmed' ||
    booking.status === 'completed' ||
    booking.status === 'refunded' ||
    booking.deposit_payment_status === 'paid' ||
    booking.remaining_balance_status === 'pending' ||
    booking.remaining_balance_status === 'paid' ||
    booking.remaining_balance_status === 'failed' ||
    Boolean(booking.stripe_session_id) ||
    Boolean(booking.stripe_customer_id) ||
    Boolean(booking.stripe_payment_method_id) ||
    Boolean(booking.stripe_payment_intent_id) ||
    Boolean(booking.deposit_payment_intent_id) ||
    Boolean(booking.remaining_balance_payment_intent_id)
  );
}

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

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select(
      'id, waiver_session_id, status, deposit_payment_status, remaining_balance_status, stripe_session_id, stripe_customer_id, stripe_payment_method_id, stripe_payment_intent_id, deposit_payment_intent_id, remaining_balance_payment_intent_id'
    )
    .eq('id', booking_id)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  if (bookingHasFinancialHistory(booking)) {
    await recordFinancialEvent({
      event_name: 'admin.booking_delete_blocked',
      event_category: 'ops',
      severity: 'warning',
      entity_type: 'booking',
      entity_id: booking_id,
      booking_id,
      status: booking.status,
      message: 'Admin deletion blocked because booking has financial history',
      metadata: {
        admin_email: adminUser.email ?? null,
        deposit_payment_status: booking.deposit_payment_status ?? null,
        remaining_balance_status: booking.remaining_balance_status ?? null,
      },
    });

    return NextResponse.json(
      {
        error:
          'Cannot delete this booking because it has payment or fulfillment history. Hide/archive it instead of deleting it.',
      },
      { status: 409 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let waiverDeleteQuery = (supabase as any)
    .from('waiver_records')
    .delete()
    .eq('booking_id', booking_id);

  if (booking.waiver_session_id) {
    waiverDeleteQuery = waiverDeleteQuery.or(`booking_id.eq.${booking_id},session_id.eq.${booking.waiver_session_id}`);
  }

  const { error: waiverDeleteError } = await waiverDeleteQuery;
  if (waiverDeleteError) {
    console.error('[admin] delete-booking waiver cleanup error:', waiverDeleteError);
    return NextResponse.json({ error: 'Failed to delete related waiver records' }, { status: 500 });
  }

  const { error: deleteError } = await supabase
    .from('bookings')
    .delete()
    .eq('id', booking_id);

  if (deleteError) {
    console.error('[admin] delete-booking error:', deleteError);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

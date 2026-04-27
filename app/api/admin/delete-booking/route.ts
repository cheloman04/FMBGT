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
    return NextResponse.json({ success: false, reason: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, reason: 'invalid_request' }, { status: 400 });
  }

  const { booking_id } = parsed.data;
  const supabase = getSupabaseAdmin();

  console.log(`[DELETE_BOOKING_START] booking_id=${booking_id} admin=${adminUser.email}`);

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select(
      'id, waiver_session_id, status, deposit_payment_status, remaining_balance_status, stripe_session_id, stripe_customer_id, stripe_payment_method_id, stripe_payment_intent_id, deposit_payment_intent_id, remaining_balance_payment_intent_id'
    )
    .eq('id', booking_id)
    .single();

  if (bookingError || !booking) {
    console.error(`[DELETE_BOOKING_ERROR] booking_id=${booking_id} not found`);
    return NextResponse.json({ success: false, reason: 'booking_not_found' }, { status: 404 });
  }

  // Booking has payment/fulfillment history — soft delete (archive) instead of hard delete
  if (bookingHasFinancialHistory(booking)) {
    console.log(`[DELETE_BOOKING_CONFLICT] booking_id=${booking_id} has financial history — archiving`);

    const { error: archiveError } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        deleted_at: new Date().toISOString(),
        deleted_by: adminUser.email ?? 'admin',
      })
      .eq('id', booking_id);

    if (archiveError) {
      console.error(`[DELETE_BOOKING_ERROR] booking_id=${booking_id} archive failed:`, archiveError);
      return NextResponse.json(
        { success: false, reason: 'archive_failed', booking_id },
        { status: 500 }
      );
    }

    await recordFinancialEvent({
      event_name: 'admin.booking_archived',
      event_category: 'ops',
      severity: 'warning',
      entity_type: 'booking',
      entity_id: booking_id,
      booking_id,
      status: booking.status,
      message: 'Admin archived booking with financial history (soft delete)',
      metadata: {
        admin_email: adminUser.email ?? null,
        previous_status: booking.status,
        deposit_payment_status: booking.deposit_payment_status ?? null,
        remaining_balance_status: booking.remaining_balance_status ?? null,
      },
    });

    console.log(`[DELETE_BOOKING_SUCCESS] booking_id=${booking_id} action=archived`);
    return NextResponse.json({ success: true, action: 'archived', booking_id });
  }

  // No financial history — safe to hard delete; clean up waiver records first
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let waiverDeleteQuery = (supabase as any)
    .from('waiver_records')
    .delete()
    .eq('booking_id', booking_id);

  if (booking.waiver_session_id) {
    waiverDeleteQuery = waiverDeleteQuery.or(
      `booking_id.eq.${booking_id},session_id.eq.${booking.waiver_session_id}`
    );
  }

  const { error: waiverDeleteError } = await waiverDeleteQuery;
  if (waiverDeleteError) {
    console.error(`[DELETE_BOOKING_ERROR] booking_id=${booking_id} waiver cleanup failed:`, waiverDeleteError);
    return NextResponse.json(
      { success: false, reason: 'waiver_cleanup_failed', booking_id },
      { status: 500 }
    );
  }

  const { error: deleteError } = await supabase
    .from('bookings')
    .delete()
    .eq('id', booking_id);

  if (deleteError) {
    console.error(`[DELETE_BOOKING_ERROR] booking_id=${booking_id} hard delete failed:`, deleteError);
    return NextResponse.json(
      { success: false, reason: 'delete_failed', booking_id },
      { status: 500 }
    );
  }

  console.log(`[DELETE_BOOKING_SUCCESS] booking_id=${booking_id} action=deleted`);
  return NextResponse.json({ success: true, action: 'deleted', booking_id });
}

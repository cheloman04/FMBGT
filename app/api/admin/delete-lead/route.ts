import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAdminUserFromCookieStore } from '@/lib/admin-auth';
import { recordFinancialEvent } from '@/lib/financial-log';

const Schema = z.object({
  lead_id: z.string().uuid(),
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

  const { lead_id } = parsed.data;
  const supabase = getSupabaseAdmin();

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, full_name')
    .eq('id', lead_id)
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bookingRows, error: bookingLookupError } = await (supabase as any)
    .from('bookings')
    .select(
      'id, status, waiver_session_id, deposit_payment_status, remaining_balance_status, stripe_session_id, stripe_customer_id, stripe_payment_method_id, stripe_payment_intent_id, deposit_payment_intent_id, remaining_balance_payment_intent_id'
    )
    .eq('lead_id', lead_id);

  if (bookingLookupError) {
    console.error('[admin] delete-lead booking lookup error:', bookingLookupError);
    return NextResponse.json({ error: 'Failed to inspect related bookings' }, { status: 500 });
  }

  const bookings = (bookingRows ?? []) as Array<{
    id: string;
    status: string;
    waiver_session_id?: string | null;
    deposit_payment_status?: string | null;
    remaining_balance_status?: string | null;
    stripe_session_id?: string | null;
    stripe_customer_id?: string | null;
    stripe_payment_method_id?: string | null;
    stripe_payment_intent_id?: string | null;
    deposit_payment_intent_id?: string | null;
    remaining_balance_payment_intent_id?: string | null;
  }>;

  const blockingBookings = bookings.filter(bookingHasFinancialHistory);
  if (blockingBookings.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: archiveError } = await (supabase as any)
      .from('leads')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: adminUser.email ?? 'admin',
      })
      .eq('id', lead_id);

    if (archiveError) {
      console.error('[admin] delete-lead archive error:', archiveError);
      return NextResponse.json({ error: 'Archive failed' }, { status: 500 });
    }

    await recordFinancialEvent({
      event_name: 'admin.lead_archived',
      event_category: 'ops',
      severity: 'warning',
      entity_type: 'lead',
      entity_id: lead_id,
      lead_id,
      requires_attention: false,
      message: 'Admin archived lead with financial history (soft delete)',
      metadata: {
        admin_email: adminUser.email ?? null,
        blocking_booking_ids: blockingBookings.map((booking) => booking.id),
      },
    });

    return NextResponse.json({ ok: true, action: 'archived', lead_id });
  }

  const bookingIds = bookings.map((booking) => booking.id);
  const waiverSessionIds = bookings
    .map((booking) => booking.waiver_session_id ?? null)
    .filter((value): value is string => Boolean(value));

  if (bookingIds.length > 0 || waiverSessionIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let waiverDeleteQuery = (supabase as any).from('waiver_records').delete();

    if (bookingIds.length > 0 && waiverSessionIds.length > 0) {
      waiverDeleteQuery = waiverDeleteQuery.or(
        `booking_id.in.(${bookingIds.join(',')}),session_id.in.(${waiverSessionIds.join(',')})`
      );
    } else if (bookingIds.length > 0) {
      waiverDeleteQuery = waiverDeleteQuery.in('booking_id', bookingIds);
    } else {
      waiverDeleteQuery = waiverDeleteQuery.in('session_id', waiverSessionIds);
    }

    const { error: waiverDeleteError } = await waiverDeleteQuery;
    if (waiverDeleteError) {
      console.error('[admin] delete-lead waiver cleanup error:', waiverDeleteError);
      return NextResponse.json({ error: 'Failed to delete related waiver records' }, { status: 500 });
    }

    const { error: bookingDeleteError } = await supabase
      .from('bookings')
      .delete()
      .eq('lead_id', lead_id);

    if (bookingDeleteError) {
      console.error('[admin] delete-lead booking cleanup error:', bookingDeleteError);
      return NextResponse.json({ error: 'Failed to delete related bookings' }, { status: 500 });
    }
  }

  const { error: deleteError } = await supabase
    .from('leads')
    .delete()
    .eq('id', lead_id);

  if (deleteError) {
    console.error('[admin] delete-lead error:', deleteError);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, lead_name: lead.full_name });
}

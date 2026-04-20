import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';
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

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, waiver_session_id')
    .eq('id', booking_id)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Remove related waiver rows first so the dashboard stays clean even if files remain in storage.
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

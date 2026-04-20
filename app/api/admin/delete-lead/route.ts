import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAdminUserFromCookieStore } from '@/lib/admin-auth';

const Schema = z.object({
  lead_id: z.string().uuid(),
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
    .select('id, waiver_session_id')
    .eq('lead_id', lead_id);

  if (bookingLookupError) {
    console.error('[admin] delete-lead booking lookup error:', bookingLookupError);
    return NextResponse.json({ error: 'Failed to inspect related bookings' }, { status: 500 });
  }

  const bookings = bookingRows ?? [];
  const bookingIds = bookings.map((booking: { id: string }) => booking.id);
  const waiverSessionIds = bookings
    .map((booking: { waiver_session_id?: string | null }) => booking.waiver_session_id ?? null)
    .filter((value: string | null): value is string => Boolean(value));

  if (bookingIds.length > 0 || waiverSessionIds.length > 0) {
    // Remove related waiver rows first so there is no orphaned dashboard data.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let waiverDeleteQuery = (supabase as any)
      .from('waiver_records')
      .delete();

    if (bookingIds.length > 0 && waiverSessionIds.length > 0) {
      waiverDeleteQuery = waiverDeleteQuery.or(`booking_id.in.(${bookingIds.join(',')}),session_id.in.(${waiverSessionIds.join(',')})`);
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

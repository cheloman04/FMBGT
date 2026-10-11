import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAdminUserFromCookieStore } from '@/lib/admin-auth';
import { syncBookingCalendarEvent } from '@/lib/booking-calendar';

const Schema = z.object({
  booking_id: z.string().uuid(),
});

// POST — (re)create the Cal.com event for a confirmed booking whose calendar
// event failed or was never made, so the slot stops showing as open online.
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const adminUser = await getAdminUserFromCookieStore(cookieStore);
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const { booking_id } = parsed.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: booking, error } = await (getSupabaseAdmin() as any)
    .from('bookings')
    .select('id, status, cal_booking_status, deleted_at')
    .eq('id', booking_id)
    .maybeSingle();

  if (error || !booking || booking.deleted_at) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }
  if (booking.status !== 'confirmed') {
    return NextResponse.json(
      { error: `Only confirmed bookings go on the calendar. Current status: ${booking.status}` },
      { status: 409 }
    );
  }
  if (booking.cal_booking_status === 'created') {
    return NextResponse.json({ ok: true, already_on_calendar: true });
  }

  const result = await syncBookingCalendarEvent(booking_id, { source: '/api/admin/retry-cal' });
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Calendar event could not be created' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, cal_booking_uid: result.uid });
}

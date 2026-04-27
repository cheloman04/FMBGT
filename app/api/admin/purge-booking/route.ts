import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAdminUserFromCookieStore } from '@/lib/admin-auth';
import { recordFinancialEvent } from '@/lib/financial-log';

const Schema = z.object({ booking_id: z.string().uuid() });

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const adminUser = await getAdminUserFromCookieStore(cookieStore);
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const { booking_id } = parsed.data;
  const supabase = getSupabaseAdmin();

  // Only allow purging rows that are already soft-deleted
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, deleted_at')
    .eq('id', booking_id)
    .single();

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(booking as any).deleted_at) {
    return NextResponse.json({ error: 'Booking is not in trash' }, { status: 409 });
  }

  // Delete waiver records first
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('waiver_records').delete().eq('booking_id', booking_id);

  const { error } = await supabase.from('bookings').delete().eq('id', booking_id);
  if (error) {
    console.error('[admin] purge-booking error:', error);
    return NextResponse.json({ error: 'Purge failed' }, { status: 500 });
  }

  await recordFinancialEvent({
    event_name: 'admin.booking_purged',
    event_category: 'ops',
    severity: 'warning',
    entity_type: 'booking',
    entity_id: booking_id,
    booking_id,
    status: 'deleted',
    message: 'Admin permanently deleted archived booking',
    metadata: { admin_email: adminUser.email ?? null },
  });

  console.log(`[admin] purge-booking booking_id=${booking_id} by ${adminUser.email}`);
  return NextResponse.json({ ok: true, booking_id });
}

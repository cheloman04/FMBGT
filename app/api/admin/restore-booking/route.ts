import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAdminUserFromCookieStore } from '@/lib/admin-auth';

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('bookings')
    .update({ deleted_at: null, deleted_by: null, status: 'cancelled' })
    .eq('id', booking_id)
    .not('deleted_at', 'is', null);

  if (error) {
    console.error('[admin] restore-booking error:', error);
    return NextResponse.json({ error: 'Restore failed' }, { status: 500 });
  }

  console.log(`[admin] restore-booking booking_id=${booking_id} by ${adminUser.email}`);
  return NextResponse.json({ ok: true, booking_id });
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';

const Schema = z.object({
  booking_id: z.string().uuid(),
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled', 'refunded']),
});

export async function POST(req: NextRequest) {
  // Verify admin session cookie
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session')?.value;
  if (!process.env.ADMIN_SECRET || session !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = Schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { booking_id, status } = parsed.data;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', booking_id);

  if (error) {
    console.error('[admin] update-booking error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getOperator, unauthorized } from '@/lib/admin/auth';
import { recordFinancialEvent } from '@/lib/financial-log';

const Schema = z.object({ booking_id: z.string().uuid() });

// Deletes an archived booking for good: its waiver records (filed under the
// booking or under its checkout session, like delete-booking) and then the row.
// The database cascades its review request and unlinks the rest (the lead, gift
// cards, the Financial log keep their rows). The customer and Stripe are untouched.
export async function POST(req: NextRequest) {
  // The session first, before any work: an API answers 401, never a redirect.
  const adminUser = await getOperator();
  if (!adminUser) return unauthorized();

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const { booking_id } = parsed.data;
  const supabase = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: booking, error: lookupError } = await (supabase as any)
    .from('bookings')
    .select('id, deleted_at, waiver_session_id')
    .eq('id', booking_id)
    .maybeSingle();

  if (lookupError) {
    console.error('[admin] purge-booking lookup error:', lookupError);
    return NextResponse.json({ error: 'The booking could not be read. Try again.' }, { status: 500 });
  }
  if (!booking) return NextResponse.json({ error: 'This booking was already deleted. Reload the page.' }, { status: 404 });
  // Only what is already in the Trash.
  if (!booking.deleted_at) {
    return NextResponse.json({ error: 'This booking isn’t in the Trash any more. Reload the page.' }, { status: 409 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let waivers = (supabase as any).from('waiver_records').delete();
  waivers = booking.waiver_session_id
    ? waivers.or(`booking_id.eq.${booking_id},session_id.eq.${booking.waiver_session_id}`)
    : waivers.eq('booking_id', booking_id);
  const { error: waiverError } = await waivers;
  if (waiverError) {
    console.error('[admin] purge-booking waiver cleanup error:', waiverError);
    return NextResponse.json(
      { error: 'The booking’s waivers could not be removed, so the booking was kept. Try again.' },
      { status: 500 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('bookings').delete().eq('id', booking_id).not('deleted_at', 'is', null);
  if (error) {
    console.error('[admin] purge-booking error:', error);
    return NextResponse.json({ error: 'The booking could not be deleted. Try again.' }, { status: 500 });
  }

  await recordFinancialEvent({
    event_name: 'admin.booking_purged',
    event_category: 'ops',
    severity: 'warning',
    entity_type: 'booking',
    entity_id: booking_id,
    // Not booking_id: it is a foreign key, and the booking is gone (the insert
    // would fail). entity_id keeps the id.
    booking_id: null,
    status: 'deleted',
    message: 'Admin permanently deleted archived booking',
    metadata: { admin_email: adminUser.email ?? null },
  });

  console.log(`[admin] purge-booking booking_id=${booking_id} by ${adminUser.email}`);
  return NextResponse.json({ ok: true, booking_id });
}

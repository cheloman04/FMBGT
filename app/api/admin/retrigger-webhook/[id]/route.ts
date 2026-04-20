import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAdminUserFromCookieStore } from '@/lib/admin-auth';
import { addHoursToIso, easternLocalToUtcIso } from '@/lib/booking-datetime';
import { formatSkillLevel } from '@/lib/booking-email';
import { getBookingLocationMeta } from '@/lib/location-meta';
import { getAppUrl } from '@/lib/app-url';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const adminUser = await getAdminUserFromCookieStore(cookieStore);
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: bookingId } = await params;
  if (!bookingId) {
    return NextResponse.json({ error: 'Missing booking ID' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: booking, error } = await supabase
    .from('bookings')
    .select(`
      id, date, time_slot, duration_hours, participant_count, participant_info,
      trail_type, skill_level, status, customer_id, location_id,
      deposit_amount, remaining_balance_amount, remaining_balance_due_at,
      zip_code, marketing_source
    `)
    .eq('id', bookingId)
    .single();

  if (error || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  type BookingRow = {
    id: string; date: string; time_slot: string; duration_hours: number;
    participant_count: number | null; participant_info: unknown;
    trail_type: string; skill_level: string | null; status: string;
    customer_id: string | null; location_id: string | null;
    deposit_amount: number | null; remaining_balance_amount: number | null;
    remaining_balance_due_at: string | null;
    zip_code: string | null; marketing_source: string | null;
  };

  const b = booking as BookingRow;

  if (b.status !== 'confirmed') {
    return NextResponse.json(
      { error: `Webhook can only be retriggered for confirmed bookings. Current status: ${b.status}` },
      { status: 409 }
    );
  }

  const [{ data: customer }, { data: location }] = await Promise.all([
    b.customer_id
      ? supabase.from('customers').select('name, email, phone').eq('id', b.customer_id).single()
      : Promise.resolve({ data: null }),
    b.location_id
      ? supabase.from('locations').select('name').eq('id', b.location_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const customerRow = customer as { name: string; email: string; phone?: string | null } | null;
  const locationName = (location as { name?: string } | null)?.name ?? 'Florida Mountain Bike Guides';
  const locationMeta = getBookingLocationMeta(locationName);

  const bookingStartIso = b.date && b.time_slot
    ? easternLocalToUtcIso(b.date, b.time_slot)
    : null;
  const bookingEndIso = bookingStartIso && b.duration_hours
    ? addHoursToIso(bookingStartIso, b.duration_hours)
    : null;

  const appUrl = getAppUrl();
  const webhookUrl = process.env.N8N_WEBHOOK_URL;

  if (!webhookUrl || webhookUrl === 'your_n8n_webhook_url_here') {
    return NextResponse.json({ error: 'N8N_WEBHOOK_URL not configured' }, { status: 503 });
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        event: 'booking_confirmed',
        retrigger: true,
        data: {
          booking_id: bookingId,
          customer_email: customerRow?.email ?? null,
          customer_name: customerRow?.name ?? null,
          customer_phone: customerRow?.phone ?? null,
          zip_code: b.zip_code,
          marketing_source: b.marketing_source,
          deposit_amount: b.deposit_amount,
          remaining_balance: b.remaining_balance_amount,
          remaining_balance_due_at: b.remaining_balance_due_at,
          location: locationName,
          date: b.date,
          time: b.time_slot,
          duration_hours: b.duration_hours,
          participant_count: b.participant_count,
          participant_info: b.participant_info,
          trail_type: b.trail_type,
          skill_level: formatSkillLevel(b.skill_level ?? undefined),
          meeting_location_name: locationMeta.meetingPointName,
          meeting_location_address: locationMeta.meetingPointAddress,
          meeting_location_url: locationMeta.meetingPointUrl,
          booking_start_iso: bookingStartIso,
          booking_end_iso: bookingEndIso,
          calendar_url: `${appUrl}/api/calendar/${bookingId}`,
        },
        timestamp: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      console.error(`[retrigger-webhook] n8n returned ${res.status} for booking ${bookingId}`);
      return NextResponse.json({ error: `n8n returned ${res.status}` }, { status: 502 });
    }

    await supabase
      .from('bookings')
      .update({ webhook_sent: true })
      .eq('id', bookingId);

    console.log(`[retrigger-webhook] Webhook re-triggered for booking ${bookingId} by admin ${adminUser.email}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[retrigger-webhook] Failed:', err);
    return NextResponse.json({ error: 'Failed to reach n8n' }, { status: 502 });
  }
}

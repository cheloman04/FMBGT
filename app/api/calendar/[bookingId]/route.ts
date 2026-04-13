import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { addHoursToIso, easternLocalToUtcIso } from '@/lib/booking-datetime';
import { buildBookingIcs } from '@/lib/booking-email';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await context.params;
  const supabase = getSupabaseAdmin();

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, customer_id, location_id, trail_type, date, time_slot, duration_hours, participant_count, status')
    .eq('id', bookingId)
    .single();

  if (error || !booking || booking.status === 'cancelled' || booking.status === 'refunded') {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const [{ data: customer }, { data: location }] = await Promise.all([
    booking.customer_id
      ? supabase.from('customers').select('name').eq('id', booking.customer_id).single()
      : Promise.resolve({ data: null }),
    booking.location_id
      ? supabase.from('locations').select('name').eq('id', booking.location_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const startIso = easternLocalToUtcIso(booking.date, booking.time_slot);
  const endIso = addHoursToIso(startIso, booking.duration_hours);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const ics = buildBookingIcs({
    bookingId: booking.id,
    customerName: customer?.name ?? 'Guest',
    trailType: booking.trail_type,
    locationName: location?.name ?? 'Florida Mountain Bike Guides',
    date: booking.date,
    time: booking.time_slot,
    startIso,
    endIso,
    durationHours: booking.duration_hours,
    participantCount: booking.participant_count ?? 1,
    appUrl,
  });

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="florida-mtb-booking-${booking.id}.ics"`,
      'Cache-Control': 'private, max-age=300',
    },
  });
}


import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';

const Schema = z.object({
  email: z.string().email(),
  booking_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = Schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { email, booking_id } = parsed.data;
  const supabase = getSupabaseAdmin();

  // Verify booking belongs to this customer's email
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('email', email)
    .single();

  if (!customer) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, trail_type, date, time_slot, duration_hours, bike_rental, total_price, status, location_id, addons')
    .eq('id', booking_id)
    .eq('customer_id', customer.id)
    .single();

  if (!booking) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Fetch location name
  let locationName = '—';
  if (booking.location_id) {
    const { data: loc } = await supabase
      .from('locations')
      .select('name')
      .eq('id', booking.location_id)
      .single();
    if (loc) locationName = loc.name;
  }

  return NextResponse.json({
    id: booking.id,
    trail_type: booking.trail_type,
    date: booking.date,
    time_slot: booking.time_slot,
    duration_hours: booking.duration_hours,
    bike_rental: booking.bike_rental,
    total_price: booking.total_price,
    status: booking.status,
    location_name: locationName,
    addons: booking.addons,
  });
}

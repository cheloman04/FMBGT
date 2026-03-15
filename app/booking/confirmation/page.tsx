import { Suspense } from 'react';
import { getSupabaseAdmin, type Database } from '@/lib/supabase';
import { ConfirmationClient } from './ConfirmationClient';

type BookingRow = Database['public']['Tables']['bookings']['Row'];

interface PageProps {
  searchParams: Promise<{ booking_id?: string; session_id?: string }>;
}

async function getBookingDetails(bookingId: string) {
  try {
    const supabase = getSupabaseAdmin();

    const { data: rawBooking, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error || !rawBooking) return null;
    const booking = rawBooking as BookingRow;

    // Fetch location name via FK
    let locationName: string | null = null;
    if (booking.location_id) {
      const { data: loc } = await supabase
        .from('locations')
        .select('name')
        .eq('id', booking.location_id)
        .single();
      locationName = loc?.name ?? null;
    }

    // Fetch customer details
    let customerName: string | null = null;
    let customerEmail: string | null = null;
    if (booking.customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('name, email')
        .eq('id', booking.customer_id)
        .single();
      customerName = customer?.name ?? null;
      customerEmail = customer?.email ?? null;
    }

    return {
      id: booking.id,
      trail_type: booking.trail_type,
      location_name: locationName,
      date: booking.date,
      time_slot: booking.time_slot,
      duration_hours: booking.duration_hours,
      bike_rental: booking.bike_rental,
      addons: (booking.addons ?? {}) as Record<string, boolean>,
      participant_count: booking.participant_count ?? 1,
      participant_info: (booking.participant_info ?? []) as Array<{ name: string; bike_rental?: string }>,
      total_price: booking.total_price,
      status: booking.status,
      customer_name: customerName,
      customer_email: customerEmail,
    };
  } catch {
    return null;
  }
}

export default async function ConfirmationPage({ searchParams }: PageProps) {
  const { booking_id } = await searchParams;
  const booking = booking_id ? await getBookingDetails(booking_id) : null;

  return (
    <Suspense fallback={<div className="text-center py-12 text-muted-foreground">Loading...</div>}>
      <ConfirmationClient booking={booking} bookingId={booking_id ?? null} />
    </Suspense>
  );
}

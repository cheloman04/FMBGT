import { requireAdminUser } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { MANUAL_BOOKING_LIST_COLUMNS as LIST_COLUMNS } from '@/lib/manual-booking';
import { AdminTopBar } from '../AdminTopBar';
import { ManualBookingClient } from './ManualBookingClient';

async function getData() {
  const supabase = getSupabaseAdmin();

  const [locationsRes, bookingsRes] = await Promise.all([
    supabase.from('locations').select('id, name, tour_type, skill_levels').eq('active', true).order('name'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('bookings')
      .select(LIST_COLUMNS)
      .eq('booking_source', 'manual')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
  ]);

  if (locationsRes.error) console.error('[admin/manual-booking] locations:', locationsRes.error.message);
  if (bookingsRes.error) console.error('[admin/manual-booking] bookings:', bookingsRes.error.message);

  return {
    locations: locationsRes.data ?? [],
    bookings: bookingsRes.data ?? [],
  };
}

export default async function ManualBookingPage() {
  await requireAdminUser();
  const { locations, bookings } = await getData();

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <AdminTopBar
          activePage="manual-booking"
          title="Manual Booking"
          subtitle="Create cash / off-platform bookings and collect waivers (no Stripe)"
        />
        <ManualBookingClient initialLocations={locations} initialBookings={bookings} />
      </div>
    </div>
  );
}

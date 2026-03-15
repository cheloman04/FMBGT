import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';
import { AdminClient } from './AdminClient';

// Cookie-based auth — password set via /admin/login
async function checkAuth() {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session')?.value;
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || session !== adminSecret) {
    redirect('/admin/login');
  }
}

async function getBookings(status?: string) {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from('bookings')
    .select('id, trail_type, date, time_slot, duration_hours, bike_rental, total_price, status, created_at, location_id, customer_id, zip_code, marketing_source')
    .order('date', { ascending: false })
    .limit(100);

  if (status && status !== 'all') {
    query = query.eq('status', status as 'pending' | 'confirmed' | 'cancelled' | 'refunded');
  }

  const { data, error } = await query;
  if (error) return [];

  // Batch-fetch locations and customers
  const locationIds = [...new Set(data.map((b) => b.location_id).filter(Boolean))];
  const customerIds = [...new Set(data.map((b) => b.customer_id).filter(Boolean))];

  const [{ data: locations }, { data: customers }] = await Promise.all([
    locationIds.length
      ? supabase.from('locations').select('id, name').in('id', locationIds as string[])
      : Promise.resolve({ data: [] }),
    customerIds.length
      ? supabase.from('customers').select('id, name, email, phone').in('id', customerIds as string[])
      : Promise.resolve({ data: [] }),
  ]);

  const locationMap = Object.fromEntries((locations ?? []).map((l) => [l.id, l.name]));
  const customerMap = Object.fromEntries(
    (customers ?? []).map((c) => [c.id, { name: c.name, email: c.email, phone: c.phone }])
  );

  return data.map((b) => ({
    ...b,
    location_name: b.location_id ? locationMap[b.location_id] ?? '—' : '—',
    customer_name: b.customer_id ? customerMap[b.customer_id]?.name ?? '—' : '—',
    customer_email: b.customer_id ? customerMap[b.customer_id]?.email ?? '—' : '—',
    customer_phone: b.customer_id ? customerMap[b.customer_id]?.phone ?? null : null,
  }));
}

async function getStats() {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('bookings').select('status, total_price');
  if (!data) return { total: 0, confirmed: 0, pending: 0, revenue: 0 };

  return {
    total: data.length,
    confirmed: data.filter((b) => b.status === 'confirmed').length,
    pending: data.filter((b) => b.status === 'pending').length,
    revenue: data
      .filter((b) => b.status === 'confirmed')
      .reduce((sum, b) => sum + (b.total_price ?? 0), 0),
  };
}

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function AdminPage({ searchParams }: PageProps) {
  await checkAuth();

  const { status } = await searchParams;
  const [bookings, stats] = await Promise.all([getBookings(status), getStats()]);

  return <AdminClient bookings={bookings} stats={stats} currentStatus={status ?? 'all'} />;
}

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';
import { AdminClient } from './AdminClient';

function extractWaiverStoragePath(urlOrPath: string | null): string | null {
  if (!urlOrPath) return null;
  if (!urlOrPath.startsWith('http://') && !urlOrPath.startsWith('https://')) {
    return urlOrPath;
  }

  try {
    const { pathname } = new URL(urlOrPath);
    const markers = [
      '/storage/v1/object/public/waivers/',
      '/storage/v1/object/sign/waivers/',
      '/storage/v1/object/authenticated/waivers/',
    ];

    for (const marker of markers) {
      const idx = pathname.indexOf(marker);
      if (idx >= 0) {
        return decodeURIComponent(pathname.slice(idx + marker.length));
      }
    }
  } catch {
    return null;
  }

  return null;
}

async function createSignedWaiverUrl(pathOrUrl: string | null) {
  const path = extractWaiverStoragePath(pathOrUrl);
  if (!path) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from('waivers').createSignedUrl(path, 60 * 60);
  if (error) {
    console.error('[admin] Failed to create signed waiver URL:', error.message);
    return null;
  }

  return data?.signedUrl ?? null;
}

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
    .select(`
      id, trail_type, date, time_slot, duration_hours, bike_rental,
      total_price, status, created_at, location_id, customer_id, waiver_session_id,
      zip_code, marketing_source,
      deposit_amount, remaining_balance_amount, remaining_balance_due_at,
      deposit_payment_status, remaining_balance_status,
      stripe_payment_method_id
    `)
    .order('date', { ascending: false })
    .limit(100);

  if (status && status !== 'all') {
    query = query.eq('status', status as 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'refunded');
  }

  const { data, error } = await query;
  if (error) return [];

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

  const bookingIds = data.map((b) => b.id);
  const waiverSessionIds = [...new Set(data.map((b) => b.waiver_session_id).filter(Boolean))];
  let waiverData: Array<{
    booking_id: string | null; session_id: string | null; id: string; signer_name: string; signer_role: string;
    participants_covered: string[]; agreed_at: string; pdf_url: string | null;
    signature_url: string | null; guardian_relationship: string | null;
  }> = [];
  if (bookingIds.length || waiverSessionIds.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let waiverQuery = (supabase as any)
      .from('waiver_records')
      .select('booking_id, session_id, id, signer_name, signer_role, participants_covered, agreed_at, pdf_url, signature_url, guardian_relationship');

    if (bookingIds.length && waiverSessionIds.length) {
      waiverQuery = waiverQuery.or(
        `booking_id.in.(${bookingIds.join(',')}),session_id.in.(${waiverSessionIds.join(',')})`
      );
    } else if (bookingIds.length) {
      waiverQuery = waiverQuery.in('booking_id', bookingIds);
    } else {
      waiverQuery = waiverQuery.in('session_id', waiverSessionIds);
    }

    const { data: wd } = await waiverQuery;
    waiverData = wd ?? [];
  }

  waiverData = await Promise.all(
    waiverData.map(async (w) => ({
      ...w,
      pdf_url: await createSignedWaiverUrl(w.pdf_url),
      signature_url: await createSignedWaiverUrl(w.signature_url),
    }))
  );

  const waiverMap: Record<string, typeof waiverData> = {};
  for (const w of waiverData) {
    const key = w.booking_id ?? w.session_id;
    if (!key) continue;
    if (!waiverMap[key]) waiverMap[key] = [];
    waiverMap[key]!.push(w);
  }

  return data.map((b) => ({
    ...b,
    location_name: b.location_id ? locationMap[b.location_id] ?? '—' : '—',
    customer_name: b.customer_id ? customerMap[b.customer_id]?.name ?? '—' : '—',
    customer_email: b.customer_id ? customerMap[b.customer_id]?.email ?? '—' : '—',
    customer_phone: b.customer_id ? customerMap[b.customer_id]?.phone ?? null : null,
    waiver_records: waiverMap[b.id] ?? waiverMap[b.waiver_session_id ?? ''] ?? [],
  }));
}

async function getStats() {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('bookings').select('status, total_price, deposit_payment_status, remaining_balance_status');
  if (!data) {
    return {
      total: 0,
      confirmed: 0,
      completed: 0,
      pending: 0,
      revenue: 0,
      projectedRevenue: 0,
      balancePending: 0,
      balanceFailed: 0,
    };
  }

  return {
    total: data.length,
    confirmed: data.filter((b) => b.status === 'confirmed').length,
    completed: data.filter((b) => b.status === 'completed').length,
    pending: data.filter((b) => b.status === 'pending').length,
    revenue: data
      .filter((b) => b.status === 'confirmed' || b.status === 'completed')
      .reduce((sum, b) => sum + (b.total_price ?? 0), 0),
    projectedRevenue: data
      .filter((b) => b.status === 'pending')
      .reduce((sum, b) => sum + (b.total_price ?? 0), 0),
    balancePending: data.filter((b) => (b as { remaining_balance_status?: string }).remaining_balance_status === 'pending').length,
    balanceFailed: data.filter((b) => (b as { remaining_balance_status?: string }).remaining_balance_status === 'failed').length,
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

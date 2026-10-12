import { notFound } from 'next/navigation';
import { requireAdminUser } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAppUrl } from '@/lib/app-url';
import { AdminTopBar } from '../../AdminTopBar';
import { BookingDetailClient, type DetailBooking, type DetailHistoryEntry, type DetailLocation, type DetailWaiver } from './BookingDetailClient';

const DETAIL_COLUMNS =
  'id, status, booking_source, created_at, trail_type, skill_level, date, time_slot, duration_hours, location_id, ' +
  'bike_rental, rider_height_inches, addons, participant_count, participant_info, total_price, ' +
  'total_after_discount_cents, discount_code, discount_label, discount_percentage, discount_amount_cents, gift_card_id, ' +
  'deposit_paid_cents, deposit_payment_status, remaining_balance_amount, remaining_balance_status, ' +
  'remaining_balance_due_at, remaining_balance_payment_intent_id, stripe_payment_method_id, extra_paid_cents, ' +
  'refunded_cents, payment_method, waiver_accepted, waiver_session_id, waiver_link_token, cal_booking_status, ' +
  'webhook_sent, admin_notes, customers(name, email, phone), locations(name)';

async function getData(id: string) {
  const supabase = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error } = await (supabase as any)
    .from('bookings')
    .select(DETAIL_COLUMNS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) console.error('[admin/bookings/[id]] booking:', error.message);
  if (!row) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let waiverQuery = (supabase as any)
    .from('waiver_records')
    .select('id, signer_name, signer_role, participants_covered, agreed_at, pdf_url');
  waiverQuery = row.waiver_session_id
    ? waiverQuery.or(`booking_id.eq.${id},session_id.eq.${row.waiver_session_id}`)
    : waiverQuery.eq('booking_id', id);

  const [waiversRes, historyRes, locationsRes] = await Promise.all([
    waiverQuery.order('agreed_at', { ascending: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('financial_event_logs')
      .select('id, event_name, message, amount, severity, occurred_at')
      .eq('booking_id', id)
      .order('occurred_at', { ascending: false })
      .limit(50),
    supabase
      .from('locations')
      .select('id, name, tour_type, skill_levels')
      .eq('active', true)
      .eq('tour_type', row.trail_type)
      .order('name'),
  ]);

  const { customers, locations, ...rest } = row;
  const booking: DetailBooking = {
    ...rest,
    customer: customers ?? { name: '', email: '', phone: null },
    location_name: locations?.name ?? '',
  };

  return {
    booking,
    waivers: (waiversRes.data ?? []) as DetailWaiver[],
    history: (historyRes.data ?? []) as DetailHistoryEntry[],
    locations: (locationsRes.data ?? []) as DetailLocation[],
  };
}

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminUser();
  const { id } = await params;
  const data = await getData(id);
  if (!data) notFound();

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <AdminTopBar
          activePage="dashboard"
          title="Booking"
          subtitle={`${data.booking.customer.name || 'Customer'} · ${data.booking.location_name}`}
        />
        <BookingDetailClient
          booking={data.booking}
          waivers={data.waivers}
          history={data.history}
          locations={data.locations}
          appUrl={getAppUrl()}
        />
      </div>
    </div>
  );
}

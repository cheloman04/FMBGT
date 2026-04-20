import { getSupabaseAdmin } from '@/lib/supabase';
import { AdminClient } from './AdminClient';
import type { AdditionalParticipant } from '@/types/booking';
import { requireAdminUser } from '@/lib/admin-auth';

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
  await requireAdminUser();
}

async function getLeadConversionSignalSet(leadIds: string[]) {
  if (leadIds.length === 0) return new Set<string>();

  const supabase = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('bookings')
    .select('lead_id, status, deposit_payment_status')
    .in('lead_id', leadIds);

  if (error) {
    console.error('[admin] Failed to inspect lead conversion signals:', error.message);
    return new Set<string>();
  }

  const convertedLeadIds = (data ?? [])
    .filter((booking: { lead_id?: string | null; status?: string | null; deposit_payment_status?: string | null }) => {
      return (
        !!booking.lead_id &&
        (
          booking.status === 'confirmed' ||
          booking.status === 'completed' ||
          booking.deposit_payment_status === 'paid'
        )
      );
    })
    .map((booking: { lead_id?: string | null }) => booking.lead_id as string);

  return new Set(convertedLeadIds);
}

// Bookings: only show confirmed/completed/cancelled/refunded — never pending
async function getBookings(status?: string) {
  const supabase = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('bookings')
    .select(`
      id, lead_id, trail_type, date, time_slot, duration_hours, bike_rental, rider_height_inches, participant_count, participant_info,
      total_price, status, created_at, location_id, customer_id, waiver_session_id,
      zip_code, marketing_source, attribution_snapshot,
      deposit_amount, remaining_balance_amount, remaining_balance_due_at,
      deposit_payment_status, remaining_balance_status,
      stripe_payment_method_id
    `)
    .order('date', { ascending: false })
    .limit(100);

  if (status && status !== 'all') {
    query = query.eq('status', status as 'confirmed' | 'completed' | 'cancelled' | 'refunded');
  } else {
    // Default: exclude pending — those are internal pre-payment records
    query = query.neq('status', 'pending');
  }

  const { data, error } = await query;
  if (error) return [];

  const typedBookings = (data ?? []) as Array<{
    id: string;
    lead_id: string | null;
    trail_type: string;
    date: string;
    time_slot: string;
    duration_hours: number;
    bike_rental: string;
    rider_height_inches: number | null;
    participant_count: number | null;
    participant_info: AdditionalParticipant[] | null;
    total_price: number;
    status: string;
    created_at: string;
    location_id: string | null;
    customer_id: string | null;
    waiver_session_id: string | null;
    zip_code: string | null;
    marketing_source: string | null;
    attribution_snapshot: Record<string, unknown> | null;
    deposit_amount: number | null;
    remaining_balance_amount: number | null;
    remaining_balance_due_at: string | null;
    deposit_payment_status: string | null;
    remaining_balance_status: string | null;
    stripe_payment_method_id: string | null;
  }>;

  const locationIds = [...new Set(typedBookings.map((b) => b.location_id).filter(Boolean))];
  const customerIds = [...new Set(typedBookings.map((b) => b.customer_id).filter(Boolean))];

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

  const bookingIds = typedBookings.map((b) => b.id);
  const waiverSessionIds = [...new Set(typedBookings.map((b) => b.waiver_session_id).filter(Boolean))];
  let reviewEnrollments: Array<{
    id: string;
    booking_id: string;
    status: string;
    enrolled_at: string;
    next_step_due_at: string | null;
    review_left_at: string | null;
    review_platform: string | null;
    completed_at: string | null;
    cancelled_at: string | null;
    stop_reason: string | null;
    created_at: string;
    updated_at: string;
  }> = [];

  if (bookingIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: reviewEnrollmentData } = await (supabase as any)
      .from('booking_review_request_enrollments')
      .select(
        'id, booking_id, status, enrolled_at, next_step_due_at, review_left_at, review_platform, completed_at, cancelled_at, stop_reason, created_at, updated_at'
      )
      .in('booking_id', bookingIds)
      .order('created_at', { ascending: false });

    reviewEnrollments = reviewEnrollmentData ?? [];
  }

  const latestReviewEnrollmentByBooking = new Map<string, typeof reviewEnrollments[number]>();
  for (const enrollment of reviewEnrollments) {
    if (!latestReviewEnrollmentByBooking.has(enrollment.booking_id)) {
      latestReviewEnrollmentByBooking.set(enrollment.booking_id, enrollment);
    }
  }

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

  return typedBookings.map((b) => ({
    ...b,
    participant_info: Array.isArray(b.participant_info) ? (b.participant_info as AdditionalParticipant[]) : null,
    location_name: b.location_id ? locationMap[b.location_id] ?? '—' : '—',
    customer_name: b.customer_id ? customerMap[b.customer_id]?.name ?? '—' : '—',
    customer_email: b.customer_id ? customerMap[b.customer_id]?.email ?? '—' : '—',
    customer_phone: b.customer_id ? customerMap[b.customer_id]?.phone ?? null : null,
    waiver_records: waiverMap[b.id] ?? waiverMap[b.waiver_session_id ?? ''] ?? [],
    review_request_enrollment: latestReviewEnrollmentByBooking.get(b.id) ?? null,
  }));
}

async function getLeads() {
  const supabase = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('leads')
    .select(`
      id, full_name, email, phone, zip_code, heard_about_us,
      selected_trail_type, selected_skill_level, selected_location_name,
      selected_bike, selected_date, selected_time_slot, selected_duration_hours,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      last_step_completed, last_activity_at, status,
      created_at, booking_id, converted_at, lost_at
    `)
    .in('status', ['lead', 'lost'])
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[admin] Failed to fetch leads:', error.message);
    return [];
  }

  const rawLeads = data ?? [];
  const conversionSignalLeadIds = await getLeadConversionSignalSet(
    rawLeads.map((lead: { id: string }) => lead.id)
  );

  const leads = rawLeads.filter((lead: {
    id: string;
    booking_id: string | null;
    converted_at: string | null;
  }) => {
    const hasConversionSignal =
      conversionSignalLeadIds.has(lead.id) ||
      !!lead.booking_id ||
      !!lead.converted_at;

    return !hasConversionSignal;
  });

  const leadIds = leads.map((lead: { id: string }) => lead.id);

  let enrollments: Array<{
    id: string;
    lead_id: string;
    trail_type: string;
    sequence_key: string;
    status: string;
    enrolled_at: string;
    next_step_due_at: string | null;
    completed_at: string | null;
    cancelled_at: string | null;
    lost_at: string | null;
    stop_reason: string | null;
    webhook_triggered_at: string | null;
    created_at: string;
    updated_at: string;
  }> = [];

  if (leadIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: enrollmentData } = await (supabase as any)
      .from('lead_followup_enrollments')
      .select('*')
      .in('lead_id', leadIds)
      .order('enrolled_at', { ascending: false });

    enrollments = enrollmentData ?? [];
  }

  const latestEnrollmentByLead = new Map<string, typeof enrollments[number]>();
  for (const enrollment of enrollments) {
    if (!latestEnrollmentByLead.has(enrollment.lead_id)) {
      latestEnrollmentByLead.set(enrollment.lead_id, enrollment);
    }
  }

  const enrollmentIds = [...latestEnrollmentByLead.values()].map((enrollment) => enrollment.id);

  let steps: Array<{
    id: string;
    enrollment_id: string;
    step_number: number;
    step_key: string;
    scheduled_for: string;
    sent_at: string | null;
    status: string;
    channel: string;
    template_key: string;
    skipped_at: string | null;
    cancelled_at: string | null;
    skip_reason: string | null;
    created_at: string;
    updated_at: string;
  }> = [];

  if (enrollmentIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: stepsData } = await (supabase as any)
      .from('lead_followup_steps')
      .select('*')
      .in('enrollment_id', enrollmentIds)
      .order('step_number', { ascending: true });

    steps = stepsData ?? [];
  }

  const stepsByEnrollment = new Map<string, typeof steps>();
  for (const step of steps) {
    const existing = stepsByEnrollment.get(step.enrollment_id) ?? [];
    existing.push(step);
    stepsByEnrollment.set(step.enrollment_id, existing);
  }

  return leads.map((lead: typeof leads[number]) => {
    const enrollment = latestEnrollmentByLead.get(lead.id) ?? null;
    return {
      ...lead,
      followup_enrollment: enrollment,
      followup_steps: enrollment ? (stepsByEnrollment.get(enrollment.id) ?? []) : [],
    };
  });
}

async function getStats() {
  const supabase = getSupabaseAdmin();

  const [bookingsResult, leadsResult] = await Promise.all([
    supabase.from('bookings').select('status, total_price, remaining_balance_amount, remaining_balance_status, deposit_payment_status'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('leads').select('id, status, booking_id, converted_at'),
  ]);

  const bookings = bookingsResult.data ?? [];
  const leads = leadsResult.data ?? [];
  const conversionSignalLeadIds = await getLeadConversionSignalSet(
    leads.map((lead: { id: string }) => lead.id)
  );

  const realBookings = bookings.filter((b) => b.status !== 'pending');
  const confirmedBookings = realBookings.filter((b) => b.status === 'confirmed');

  const totalLeads = leads.length;
  const activeLeads = leads.filter((lead: {
    id: string;
    status: string;
    booking_id: string | null;
    converted_at: string | null;
  }) => {
    const hasConversionSignal =
      conversionSignalLeadIds.has(lead.id) ||
      lead.status === 'converted' ||
      !!lead.booking_id ||
      !!lead.converted_at;

    return lead.status === 'lead' && !hasConversionSignal;
  }).length;
  const convertedLeads = leads.filter((lead: {
    id: string;
    status: string;
    booking_id: string | null;
    converted_at: string | null;
  }) => {
    return (
      conversionSignalLeadIds.has(lead.id) ||
      lead.status === 'converted' ||
      !!lead.booking_id ||
      !!lead.converted_at
    );
  }).length;

  const revenue = realBookings
    .filter((b) => b.status === 'confirmed' || b.status === 'completed')
    .reduce((sum, b) => sum + (b.total_price ?? 0), 0);

  // Projected = remaining balance still owed on confirmed bookings
  const projectedRevenue = confirmedBookings
    .filter((b) => (b as { remaining_balance_status?: string }).remaining_balance_status === 'pending')
    .reduce((sum, b) => sum + ((b as { remaining_balance_amount?: number }).remaining_balance_amount ?? 0), 0);

  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : null;

  return {
    total: realBookings.length,
    leads: activeLeads,
    confirmed: confirmedBookings.length,
    completed: realBookings.filter((b) => b.status === 'completed').length,
    revenue,
    projectedRevenue,
    conversionRate,
    balancePending: confirmedBookings.filter((b) => (b as { remaining_balance_status?: string }).remaining_balance_status === 'pending').length,
    balanceFailed: realBookings.filter((b) => (b as { remaining_balance_status?: string }).remaining_balance_status === 'failed').length,
  };
}

interface PageProps {
  searchParams: Promise<{ status?: string; leadId?: string }>;
}

export default async function AdminPage({ searchParams }: PageProps) {
  await checkAuth();

  const { status, leadId } = await searchParams;
  const isLeadsView = status === 'leads' || !!leadId;

  const [bookings, leads, stats] = await Promise.all([
    isLeadsView ? Promise.resolve([]) : getBookings(status),
    isLeadsView ? getLeads() : Promise.resolve([]),
    getStats(),
  ]);

  return (
    <AdminClient
      bookings={bookings}
      leads={leads}
      stats={stats}
      currentStatus={isLeadsView ? 'leads' : status ?? 'all'}
      initialLeadId={leadId ?? null}
    />
  );
}

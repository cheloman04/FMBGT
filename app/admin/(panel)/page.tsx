import { redirect } from 'next/navigation';
import { PageHeader, PageShell } from '@/components/kit';
import { requireOperator } from '@/lib/admin/auth';
import { legacyBookingsUrl } from '@/lib/admin/bookings';
import { loadLeadsWithPaymentSignal, loadNextBooking, loadOverview } from '@/lib/admin/loaders';
import { getSupabaseAdmin } from '@/lib/supabase';
import { LegacyArea } from '../_components/LegacyArea';
import { AdminOverview } from './_components/Overview';
import { AdminClient } from './AdminClient';

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
  const conversionSignalLeadIds = await loadLeadsWithPaymentSignal(
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

async function getTrashedBookings() {
  const supabase = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('bookings')
    .select('id, status, date, location_id, total_price, deposit_amount, deposit_payment_status, deleted_at, deleted_by, created_at')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[admin] getTrashedBookings error:', error.message);
    return [];
  }

  const locationIds = [...new Set((data ?? []).map((b: { location_id: string | null }) => b.location_id).filter(Boolean))];
  const { data: locations } = locationIds.length
    ? await supabase.from('locations').select('id, name').in('id', locationIds as string[])
    : { data: [] };
  const locationMap = Object.fromEntries((locations ?? []).map((l: { id: string; name: string }) => [l.id, l.name]));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((b: any) => ({
    ...b,
    location_name: b.location_id ? (locationMap[b.location_id] ?? 'Unknown') : 'Unknown',
  }));
}

async function getTrashedLeads() {
  const supabase = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('leads')
    .select('id, full_name, email, phone, selected_trail_type, selected_location_name, deleted_at, deleted_by, created_at')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[admin] getTrashedLeads error:', error.message);
    return [];
  }

  return data ?? [];
}

interface PageProps {
  searchParams: Promise<{ status?: string; leadId?: string }>;
}

export const metadata = { title: 'Dashboard | Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminPage({ searchParams }: PageProps) {
  await requireOperator();

  const { status, leadId } = await searchParams;
  // The bookings views moved to /admin/bookings: an old link (a bookmark, an
  // alert) lands on the same view there.
  const moved = legacyBookingsUrl(status);
  if (moved) redirect(moved);

  // Below the overview: the leads, or the trash (until step 3c moves them too).
  const view = status === 'trash' && !leadId ? 'trash' : 'leads';

  const [overview, next, leads, trashedBookings, trashedLeads] = await Promise.all([
    loadOverview(),
    loadNextBooking(),
    view === 'leads' ? getLeads() : Promise.resolve([]),
    view === 'trash' ? getTrashedBookings() : Promise.resolve([]),
    view === 'trash' ? getTrashedLeads() : Promise.resolve([]),
  ]);

  return (
    <PageShell>
      <PageHeader eyebrow="Overview" title="Dashboard" subtitle="Money, the next tour and what needs you. Times in Eastern." />
      <AdminOverview stats={overview} next={next} view={view} />

      {/* The leads and trash lists: still the legacy client, until they move
          to their own routes (phase 2, step 3c). Bookings are at /admin/bookings. */}
      <div className="mt-10">
        <LegacyArea>
          {/* The key remounts the client when the view changes. It copies its
              props into state once, so a soft navigation from the strip above
              (a <Link>, unlike its own full-reload tabs) would keep showing the
              previous view's list. */}
          <AdminClient
            key={`${view}:${leadId ?? ''}`}
            leads={leads}
            currentStatus={view}
            initialLeadId={leadId ?? null}
            trashedBookings={trashedBookings}
            trashedLeads={trashedLeads}
          />
        </LegacyArea>
      </div>
    </PageShell>
  );
}

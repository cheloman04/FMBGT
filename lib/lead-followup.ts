import { getSupabaseAdmin } from '@/lib/supabase';

export type FollowUpTrailType = 'paved' | 'mtb';
export type FollowUpEnrollmentStatus = 'active' | 'completed' | 'cancelled' | 'lost';
export type FollowUpStepStatus = 'pending' | 'sent' | 'skipped' | 'cancelled';
export type FollowUpStepKey = '1_hour' | '1_day' | '1_week';

export interface LeadFollowUpStep {
  id: string;
  enrollment_id: string;
  step_number: number;
  step_key: FollowUpStepKey;
  scheduled_for: string;
  sent_at: string | null;
  status: FollowUpStepStatus;
  channel: string;
  template_key: string;
  skipped_at: string | null;
  cancelled_at: string | null;
  skip_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadFollowUpEnrollment {
  id: string;
  lead_id: string;
  trail_type: FollowUpTrailType;
  sequence_key: string;
  status: FollowUpEnrollmentStatus;
  enrolled_at: string;
  next_step_due_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  lost_at: string | null;
  stop_reason: string | null;
  webhook_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FollowUpLeadRecord {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  zip_code: string | null;
  heard_about_us: string | null;
  selected_trail_type: FollowUpTrailType | null;
  selected_location_name: string | null;
  selected_bike: string | null;
  selected_date: string | null;
  selected_time_slot: string | null;
  selected_duration_hours: number | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  last_step_completed: string | null;
  last_activity_at: string | null;
  source: string | null;
  status: string | null;
  created_at: string | null;
  booking_id: string | null;
  converted_at: string | null;
  lost_at: string | null;
}

export interface FollowUpEligibilityResult {
  eligible: boolean;
  reason: string | null;
  lead: FollowUpLeadRecord | null;
  enrollment: LeadFollowUpEnrollment | null;
}

const DEFAULT_SEQUENCE_KEY = 'default_lead_recovery';

const FOLLOW_UP_SCHEDULE: Array<{
  stepNumber: number;
  stepKey: FollowUpStepKey;
  delayMs: number;
}> = [
  { stepNumber: 1, stepKey: '1_hour', delayMs: 60 * 60 * 1000 },
  { stepNumber: 2, stepKey: '1_day', delayMs: 24 * 60 * 60 * 1000 },
  { stepNumber: 3, stepKey: '1_week', delayMs: 7 * 24 * 60 * 60 * 1000 },
];

function toIsoAfter(baseIso: string, delayMs: number): string {
  return new Date(new Date(baseIso).getTime() + delayMs).toISOString();
}

function templateKeyFor(trailType: FollowUpTrailType, stepKey: FollowUpStepKey): string {
  return `${trailType}_${stepKey}`;
}

async function fetchLeadRecord(leadId: string): Promise<FollowUpLeadRecord | null> {
  const supabase = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('leads')
    .select(`
      id, full_name, email, phone, zip_code, heard_about_us,
      selected_trail_type, selected_location_name,
      selected_bike, selected_date, selected_time_slot, selected_duration_hours,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      last_step_completed, last_activity_at, source, status, created_at, booking_id,
      converted_at, lost_at
    `)
    .eq('id', leadId)
    .single();

  if (error) {
    console.error(`[lead-followup] Failed to fetch lead ${leadId}:`, error.message);
    return null;
  }

  return data as FollowUpLeadRecord;
}

export async function getLatestFollowUpEnrollment(
  leadId: string
): Promise<LeadFollowUpEnrollment | null> {
  const supabase = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('lead_followup_enrollments')
    .select('*')
    .eq('lead_id', leadId)
    .order('enrolled_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`[lead-followup] Failed to fetch latest enrollment for lead ${leadId}:`, error.message);
    return null;
  }

  return (data ?? null) as LeadFollowUpEnrollment | null;
}

export async function getActiveFollowUpEnrollment(
  leadId: string
): Promise<LeadFollowUpEnrollment | null> {
  const supabase = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('lead_followup_enrollments')
    .select('*')
    .eq('lead_id', leadId)
    .eq('status', 'active')
    .order('enrolled_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`[lead-followup] Failed to fetch active enrollment for lead ${leadId}:`, error.message);
    return null;
  }

  return (data ?? null) as LeadFollowUpEnrollment | null;
}

export async function getFollowUpEnrollmentById(
  enrollmentId: string
): Promise<LeadFollowUpEnrollment | null> {
  const supabase = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('lead_followup_enrollments')
    .select('*')
    .eq('id', enrollmentId)
    .maybeSingle();

  if (error) {
    console.error(
      `[lead-followup] Failed to fetch enrollment ${enrollmentId}:`,
      error.message
    );
    return null;
  }

  return (data ?? null) as LeadFollowUpEnrollment | null;
}

export async function getFollowUpSteps(
  enrollmentId: string
): Promise<LeadFollowUpStep[]> {
  const supabase = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('lead_followup_steps')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .order('step_number', { ascending: true });

  if (error) {
    console.error(`[lead-followup] Failed to fetch steps for enrollment ${enrollmentId}:`, error.message);
    return [];
  }

  return (data ?? []) as LeadFollowUpStep[];
}

async function hasConversionSignals(leadId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('bookings')
    .select('id, status, deposit_payment_status')
    .eq('lead_id', leadId);

  if (error) {
    console.error(`[lead-followup] Failed to inspect bookings for lead ${leadId}:`, error.message);
    return false;
  }

  return (data ?? []).some((booking: { status?: string | null; deposit_payment_status?: string | null }) => {
    return (
      booking.status === 'confirmed' ||
      booking.status === 'completed' ||
      booking.deposit_payment_status === 'paid'
    );
  });
}

export async function evaluateLeadFollowUpEligibility(
  leadId: string,
  enrollmentId?: string | null
): Promise<FollowUpEligibilityResult> {
  const lead = await fetchLeadRecord(leadId);
  if (!lead) {
    return { eligible: false, reason: 'lead_not_found', lead: null, enrollment: null };
  }

  const enrollment = enrollmentId
    ? await getFollowUpEnrollmentById(enrollmentId)
    : await getActiveFollowUpEnrollment(leadId);

  if (enrollmentId && enrollment && enrollment.lead_id !== leadId) {
    return { eligible: false, reason: 'enrollment_mismatch', lead, enrollment: null };
  }

  if (lead.status === 'converted' || lead.converted_at || lead.booking_id || (await hasConversionSignals(leadId))) {
    return { eligible: false, reason: 'lead_converted', lead, enrollment };
  }

  if (lead.status === 'lost' || lead.lost_at) {
    return { eligible: false, reason: 'lead_lost', lead, enrollment };
  }

  if (!enrollment) {
    return { eligible: false, reason: 'followup_not_enrolled', lead, enrollment: null };
  }

  if (enrollment.status !== 'active') {
    return { eligible: false, reason: `enrollment_${enrollment.status}`, lead, enrollment };
  }

  return { eligible: true, reason: null, lead, enrollment };
}

export async function enrollLeadInFollowUp(
  leadId: string
): Promise<{
  lead: FollowUpLeadRecord;
  enrollment: LeadFollowUpEnrollment;
  steps: LeadFollowUpStep[];
  created: boolean;
  alreadyActive: boolean;
}> {
  const lead = await fetchLeadRecord(leadId);
  if (!lead) {
    throw new Error('Lead not found');
  }

  if (!lead.selected_trail_type || !['paved', 'mtb'].includes(lead.selected_trail_type)) {
    throw new Error('Lead is missing a valid trail type');
  }

  const eligibility = await evaluateLeadFollowUpEligibility(leadId);
  if (!eligibility.lead) {
    throw new Error('Lead not found');
  }
  if (!eligibility.eligible && eligibility.reason !== 'followup_not_enrolled') {
    throw new Error(`Lead is not eligible for follow-up (${eligibility.reason})`);
  }

  const existingActive = await getActiveFollowUpEnrollment(leadId);
  if (existingActive) {
    const existingSteps = await getFollowUpSteps(existingActive.id);
    return {
      lead,
      enrollment: existingActive,
      steps: existingSteps,
      created: false,
      alreadyActive: true,
    };
  }

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const trailType = lead.selected_trail_type as FollowUpTrailType;
  const firstDueAt = toIsoAfter(now, FOLLOW_UP_SCHEDULE[0].delayMs);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: enrollmentData, error: enrollmentError } = await (supabase as any)
    .from('lead_followup_enrollments')
    .insert({
      lead_id: leadId,
      trail_type: trailType,
      sequence_key: DEFAULT_SEQUENCE_KEY,
      status: 'active',
      enrolled_at: now,
      next_step_due_at: firstDueAt,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();

  if (enrollmentError) {
    if (enrollmentError.code === '23505') {
      const active = await getActiveFollowUpEnrollment(leadId);
      if (!active) {
        throw new Error('Active follow-up enrollment already exists');
      }
      const existingSteps = await getFollowUpSteps(active.id);
      return {
        lead,
        enrollment: active,
        steps: existingSteps,
        created: false,
        alreadyActive: true,
      };
    }

    throw new Error(`Failed to create follow-up enrollment: ${enrollmentError.message}`);
  }

  const enrollment = enrollmentData as LeadFollowUpEnrollment;
  const stepRows = FOLLOW_UP_SCHEDULE.map((step) => ({
    enrollment_id: enrollment.id,
    step_number: step.stepNumber,
    step_key: step.stepKey,
    scheduled_for: toIsoAfter(now, step.delayMs),
    status: 'pending',
    channel: 'email',
    template_key: templateKeyFor(trailType, step.stepKey),
    created_at: now,
    updated_at: now,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stepsData, error: stepsError } = await (supabase as any)
    .from('lead_followup_steps')
    .upsert(stepRows, {
      onConflict: 'enrollment_id,step_key',
      ignoreDuplicates: false,
    })
    .select('*');

  if (stepsError) {
    throw new Error(`Failed to create follow-up steps: ${stepsError.message}`);
  }

  return {
    lead,
    enrollment,
    steps: (stepsData ?? []) as LeadFollowUpStep[],
    created: true,
    alreadyActive: false,
  };
}

export async function markFollowUpWebhookTriggered(enrollmentId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('lead_followup_enrollments')
    .update({
      webhook_triggered_at: now,
      updated_at: now,
    })
    .eq('id', enrollmentId)
    .is('webhook_triggered_at', null);

  if (error) {
    console.error(`[lead-followup] Failed to mark webhook triggered for enrollment ${enrollmentId}:`, error.message);
  }
}

export async function cancelActiveFollowUpForConversion(
  leadId: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const active = await getActiveFollowUpEnrollment(leadId);

  if (!active) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: enrollmentError } = await (supabase as any)
    .from('lead_followup_enrollments')
    .update({
      status: 'cancelled',
      cancelled_at: now,
      completed_at: now,
      stop_reason: 'converted',
      next_step_due_at: null,
      updated_at: now,
    })
    .eq('id', active.id)
    .eq('status', 'active');

  if (enrollmentError) {
    console.error(`[lead-followup] Failed to cancel enrollment ${active.id} on conversion:`, enrollmentError.message);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: stepError } = await (supabase as any)
    .from('lead_followup_steps')
    .update({
      status: 'cancelled',
      cancelled_at: now,
      skip_reason: 'lead_converted',
      updated_at: now,
    })
    .eq('enrollment_id', active.id)
    .eq('status', 'pending');

  if (stepError) {
    console.error(`[lead-followup] Failed to cancel pending steps for enrollment ${active.id}:`, stepError.message);
  }
}

export async function markFollowUpStepSent(input: {
  enrollmentId: string;
  stepKey: FollowUpStepKey;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('lead_followup_steps')
    .update({
      status: 'sent',
      sent_at: now,
      updated_at: now,
    })
    .eq('enrollment_id', input.enrollmentId)
    .eq('step_key', input.stepKey)
    .eq('status', 'pending');

  if (error) {
    console.error(`[lead-followup] Failed to mark step ${input.stepKey} sent:`, error.message);
  }

  const steps = await getFollowUpSteps(input.enrollmentId);
  const nextPending = steps.find((step) => step.status === 'pending');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: enrollmentError } = await (supabase as any)
    .from('lead_followup_enrollments')
    .update({
      next_step_due_at: nextPending?.scheduled_for ?? null,
      updated_at: now,
    })
    .eq('id', input.enrollmentId);

  if (enrollmentError) {
    console.error(`[lead-followup] Failed to update next step due for enrollment ${input.enrollmentId}:`, enrollmentError.message);
  }
}

export async function skipFollowUpStep(input: {
  enrollmentId: string;
  stepKey: FollowUpStepKey;
  reason: string;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('lead_followup_steps')
    .update({
      status: 'skipped',
      skipped_at: now,
      skip_reason: input.reason,
      updated_at: now,
    })
    .eq('enrollment_id', input.enrollmentId)
    .eq('step_key', input.stepKey)
    .eq('status', 'pending');

  if (error) {
    console.error(`[lead-followup] Failed to skip step ${input.stepKey}:`, error.message);
  }
}

export async function markLeadAndEnrollmentLost(
  enrollmentId: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: enrollmentData, error: enrollmentError } = await (supabase as any)
    .from('lead_followup_enrollments')
    .select('id, lead_id, status')
    .eq('id', enrollmentId)
    .single();

  if (enrollmentError || !enrollmentData) {
    console.error(`[lead-followup] Failed to load enrollment ${enrollmentId} for lost transition:`, enrollmentError?.message ?? 'not found');
    return;
  }

  const enrollment = enrollmentData as { id: string; lead_id: string; status: FollowUpEnrollmentStatus };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: leadError } = await (supabase as any)
    .from('leads')
    .update({
      status: 'lost',
      lost_at: now,
      updated_at: now,
    })
    .eq('id', enrollment.lead_id)
    .eq('status', 'lead');

  if (leadError) {
    console.error(`[lead-followup] Failed to mark lead ${enrollment.lead_id} lost:`, leadError.message);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: enrollmentUpdateError } = await (supabase as any)
    .from('lead_followup_enrollments')
    .update({
      status: 'lost',
      lost_at: now,
      completed_at: now,
      stop_reason: 'sequence_exhausted_without_conversion',
      next_step_due_at: null,
      updated_at: now,
    })
    .eq('id', enrollment.id)
    .in('status', ['active', 'completed']);

  if (enrollmentUpdateError) {
    console.error(`[lead-followup] Failed to mark enrollment ${enrollment.id} lost:`, enrollmentUpdateError.message);
  }
}

export function buildLeadFollowUpWebhookPayload(input: {
  lead: FollowUpLeadRecord;
  enrollment: LeadFollowUpEnrollment;
}): Record<string, unknown> {
  const sequence = FOLLOW_UP_SCHEDULE.map((step) => step.stepKey);

  return {
    event: 'lead_follow_up_requested',
    data: {
      lead_id: input.lead.id,
      contact: {
        full_name: input.lead.full_name,
        email: input.lead.email,
        phone: input.lead.phone,
        zip_code: input.lead.zip_code,
      },
      booking_intent: {
        selected_trail_type: input.enrollment.trail_type,
        selected_location_name: input.lead.selected_location_name,
        selected_bike: input.lead.selected_bike,
        selected_date: input.lead.selected_date,
        selected_time_slot: input.lead.selected_time_slot,
        selected_duration_hours: input.lead.selected_duration_hours,
      },
      attribution: {
        heard_about_us: input.lead.heard_about_us,
        utm_source: input.lead.utm_source,
        utm_medium: input.lead.utm_medium,
        utm_campaign: input.lead.utm_campaign,
        utm_content: input.lead.utm_content,
        utm_term: input.lead.utm_term,
        source: input.lead.source ?? 'booking_platform',
      },
      funnel: {
        last_step_completed: input.lead.last_step_completed,
        last_activity_at: input.lead.last_activity_at,
        status: input.lead.status,
        created_at: input.lead.created_at,
      },
      follow_up_reason: 'abandoned_booking',
      followup_sequence: sequence,
      followup_enrollment: {
        enrollment_id: input.enrollment.id,
        enrolled_at: input.enrollment.enrolled_at,
        sequence_key: input.enrollment.sequence_key,
      },
    },
    timestamp: new Date().toISOString(),
  };
}

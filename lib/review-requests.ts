import { getSupabaseAdmin } from '@/lib/supabase';

export type ReviewRequestTrailType = 'paved' | 'mtb';
export type ReviewRequestEnrollmentStatus = 'active' | 'reviewed' | 'cancelled' | 'completed';
export type ReviewRequestStepStatus = 'pending' | 'sent' | 'skipped' | 'cancelled';
export type ReviewRequestStepKey = 'same_day' | '1_day' | '1_week';

export interface BookingReviewRequestEnrollment {
  id: string;
  booking_id: string;
  customer_id: string | null;
  trail_type: ReviewRequestTrailType;
  location_name: string | null;
  full_name: string | null;
  email: string | null;
  sequence_key: string;
  status: ReviewRequestEnrollmentStatus;
  enrolled_at: string;
  next_step_due_at: string | null;
  review_left_at: string | null;
  review_platform: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  stop_reason: string | null;
  webhook_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingReviewRequestStep {
  id: string;
  enrollment_id: string;
  step_number: number;
  step_key: ReviewRequestStepKey;
  scheduled_for: string;
  sent_at: string | null;
  status: ReviewRequestStepStatus;
  channel: string;
  template_key: string;
  skipped_at: string | null;
  cancelled_at: string | null;
  skip_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewRequestBookingRecord {
  id: string;
  customer_id: string | null;
  trail_type: ReviewRequestTrailType | null;
  skill_level: string | null;
  date: string | null;
  time_slot: string | null;
  duration_hours: number | null;
  bike_rental: string | null;
  participant_count: number | null;
  total_price: number | null;
  status: string | null;
  created_at: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  location_name: string | null;
}

export interface ReviewRequestEligibilityResult {
  eligible: boolean;
  reason: string | null;
  booking: ReviewRequestBookingRecord | null;
  enrollment: BookingReviewRequestEnrollment | null;
}

const DEFAULT_SEQUENCE_KEY = 'completed_service_review_request';

const REVIEW_REQUEST_SCHEDULE: Array<{
  stepNumber: number;
  stepKey: ReviewRequestStepKey;
  delayMs: number;
}> = [
  { stepNumber: 1, stepKey: 'same_day', delayMs: 0 },
  { stepNumber: 2, stepKey: '1_day', delayMs: 24 * 60 * 60 * 1000 },
  { stepNumber: 3, stepKey: '1_week', delayMs: 7 * 24 * 60 * 60 * 1000 },
];

function toIsoAfter(baseIso: string, delayMs: number): string {
  return new Date(new Date(baseIso).getTime() + delayMs).toISOString();
}

function templateKeyFor(trailType: ReviewRequestTrailType, stepKey: ReviewRequestStepKey): string {
  return `${trailType}_${stepKey}`;
}

async function fetchBookingRecord(bookingId: string): Promise<ReviewRequestBookingRecord | null> {
  const supabase = getSupabaseAdmin();

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select(`
      id, customer_id, trail_type, skill_level, date, time_slot, duration_hours,
      bike_rental, participant_count, total_price, status, created_at, location_id
    `)
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingError || !booking) {
    console.error(`[review-requests] Failed to fetch booking ${bookingId}:`, bookingError?.message);
    return null;
  }

  const [customerResult, locationResult] = await Promise.all([
    booking.customer_id
      ? supabase
          .from('customers')
          .select('id, name, email, phone')
          .eq('id', booking.customer_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    booking.location_id
      ? supabase
          .from('locations')
          .select('id, name')
          .eq('id', booking.location_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (customerResult.error) {
    console.error(`[review-requests] Failed to fetch customer for booking ${bookingId}:`, customerResult.error.message);
  }

  if (locationResult.error) {
    console.error(`[review-requests] Failed to fetch location for booking ${bookingId}:`, locationResult.error.message);
  }

  return {
    id: booking.id,
    customer_id: booking.customer_id,
    trail_type: booking.trail_type,
    skill_level: booking.skill_level,
    date: booking.date,
    time_slot: booking.time_slot,
    duration_hours: booking.duration_hours,
    bike_rental: booking.bike_rental,
    participant_count: booking.participant_count,
    total_price: booking.total_price,
    status: booking.status,
    created_at: booking.created_at,
    customer_name: customerResult.data?.name ?? null,
    customer_email: customerResult.data?.email ?? null,
    customer_phone: customerResult.data?.phone ?? null,
    location_name: locationResult.data?.name ?? null,
  };
}

export async function getActiveReviewRequestEnrollment(
  bookingId: string
): Promise<BookingReviewRequestEnrollment | null> {
  const supabase = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('booking_review_request_enrollments')
    .select('*')
    .eq('booking_id', bookingId)
    .eq('status', 'active')
    .order('enrolled_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`[review-requests] Failed to fetch active enrollment for booking ${bookingId}:`, error.message);
    return null;
  }

  return (data ?? null) as BookingReviewRequestEnrollment | null;
}

export async function getReviewRequestEnrollmentById(
  enrollmentId: string
): Promise<BookingReviewRequestEnrollment | null> {
  const supabase = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('booking_review_request_enrollments')
    .select('*')
    .eq('id', enrollmentId)
    .maybeSingle();

  if (error) {
    console.error(`[review-requests] Failed to fetch enrollment ${enrollmentId}:`, error.message);
    return null;
  }

  return (data ?? null) as BookingReviewRequestEnrollment | null;
}

export async function getReviewRequestSteps(
  enrollmentId: string
): Promise<BookingReviewRequestStep[]> {
  const supabase = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('booking_review_request_steps')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .order('step_number', { ascending: true });

  if (error) {
    console.error(`[review-requests] Failed to fetch steps for enrollment ${enrollmentId}:`, error.message);
    return [];
  }

  return (data ?? []) as BookingReviewRequestStep[];
}

export async function evaluateReviewRequestEligibility(
  bookingId: string,
  enrollmentId?: string | null
): Promise<ReviewRequestEligibilityResult> {
  const booking = await fetchBookingRecord(bookingId);
  if (!booking) {
    return { eligible: false, reason: 'booking_not_found', booking: null, enrollment: null };
  }

  const enrollment = enrollmentId
    ? await getReviewRequestEnrollmentById(enrollmentId)
    : await getActiveReviewRequestEnrollment(bookingId);

  if (enrollmentId && enrollment && enrollment.booking_id !== bookingId) {
    return { eligible: false, reason: 'enrollment_mismatch', booking, enrollment: null };
  }

  if (booking.status !== 'completed') {
    return { eligible: false, reason: 'booking_not_completed', booking, enrollment };
  }

  if (!enrollment) {
    return { eligible: false, reason: 'review_request_not_enrolled', booking, enrollment: null };
  }

  if (enrollment.review_left_at || enrollment.status === 'reviewed') {
    return { eligible: false, reason: 'review_already_received', booking, enrollment };
  }

  if (enrollment.status !== 'active') {
    return { eligible: false, reason: `enrollment_${enrollment.status}`, booking, enrollment };
  }

  if (!booking.customer_email) {
    return { eligible: false, reason: 'missing_customer_email', booking, enrollment };
  }

  return { eligible: true, reason: null, booking, enrollment };
}

export async function enrollBookingInReviewRequest(
  bookingId: string
): Promise<{
  booking: ReviewRequestBookingRecord;
  enrollment: BookingReviewRequestEnrollment;
  steps: BookingReviewRequestStep[];
  created: boolean;
  alreadyActive: boolean;
}> {
  const booking = await fetchBookingRecord(bookingId);
  if (!booking) {
    throw new Error('Booking not found');
  }

  if (booking.status !== 'completed') {
    throw new Error('Booking must be completed before review requests can start');
  }

  if (!booking.trail_type || !['paved', 'mtb'].includes(booking.trail_type)) {
    throw new Error('Booking is missing a valid trail type');
  }

  if (!booking.customer_email) {
    throw new Error('Booking customer is missing an email address');
  }

  const existingActive = await getActiveReviewRequestEnrollment(bookingId);
  if (existingActive) {
    const existingSteps = await getReviewRequestSteps(existingActive.id);
    return {
      booking,
      enrollment: existingActive,
      steps: existingSteps,
      created: false,
      alreadyActive: true,
    };
  }

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const trailType = booking.trail_type as ReviewRequestTrailType;
  const firstDueAt = toIsoAfter(now, REVIEW_REQUEST_SCHEDULE[0].delayMs);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: enrollmentData, error: enrollmentError } = await (supabase as any)
    .from('booking_review_request_enrollments')
    .insert({
      booking_id: bookingId,
      customer_id: booking.customer_id,
      trail_type: trailType,
      location_name: booking.location_name,
      full_name: booking.customer_name,
      email: booking.customer_email,
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
      const active = await getActiveReviewRequestEnrollment(bookingId);
      if (!active) {
        throw new Error('Active review request enrollment already exists');
      }
      const existingSteps = await getReviewRequestSteps(active.id);
      return {
        booking,
        enrollment: active,
        steps: existingSteps,
        created: false,
        alreadyActive: true,
      };
    }

    throw new Error(`Failed to create review request enrollment: ${enrollmentError.message}`);
  }

  const enrollment = enrollmentData as BookingReviewRequestEnrollment;
  const stepRows = REVIEW_REQUEST_SCHEDULE.map((step) => ({
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
    .from('booking_review_request_steps')
    .upsert(stepRows, {
      onConflict: 'enrollment_id,step_key',
      ignoreDuplicates: false,
    })
    .select('*');

  if (stepsError) {
    throw new Error(`Failed to create review request steps: ${stepsError.message}`);
  }

  return {
    booking,
    enrollment,
    steps: (stepsData ?? []) as BookingReviewRequestStep[],
    created: true,
    alreadyActive: false,
  };
}

export async function markReviewRequestStepSent(input: {
  enrollmentId: string;
  stepKey: ReviewRequestStepKey;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('booking_review_request_steps')
    .update({
      status: 'sent',
      sent_at: now,
      updated_at: now,
    })
    .eq('enrollment_id', input.enrollmentId)
    .eq('step_key', input.stepKey)
    .eq('status', 'pending');

  if (error) {
    console.error(`[review-requests] Failed to mark step ${input.stepKey} sent:`, error.message);
  }

  const steps = await getReviewRequestSteps(input.enrollmentId);
  const nextPending = steps.find((step) => step.status === 'pending');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: enrollmentError } = await (supabase as any)
    .from('booking_review_request_enrollments')
    .update({
      next_step_due_at: nextPending?.scheduled_for ?? null,
      completed_at: nextPending ? null : now,
      status: nextPending ? 'active' : 'completed',
      updated_at: now,
    })
    .eq('id', input.enrollmentId)
    .eq('status', 'active');

  if (enrollmentError) {
    console.error(`[review-requests] Failed to update next step due for enrollment ${input.enrollmentId}:`, enrollmentError.message);
  }
}

export async function skipReviewRequestStep(input: {
  enrollmentId: string;
  stepKey: ReviewRequestStepKey;
  reason: string;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('booking_review_request_steps')
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
    console.error(`[review-requests] Failed to skip step ${input.stepKey}:`, error.message);
  }
}

export async function markReviewRequestReceived(input: {
  enrollmentId: string;
  platform?: string | null;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: enrollmentError } = await (supabase as any)
    .from('booking_review_request_enrollments')
    .update({
      status: 'reviewed',
      review_left_at: now,
      review_platform: input.platform ?? null,
      completed_at: now,
      stop_reason: 'review_received',
      next_step_due_at: null,
      updated_at: now,
    })
    .eq('id', input.enrollmentId)
    .in('status', ['active', 'completed']);

  if (enrollmentError) {
    console.error(`[review-requests] Failed to mark enrollment ${input.enrollmentId} reviewed:`, enrollmentError.message);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: stepsError } = await (supabase as any)
    .from('booking_review_request_steps')
    .update({
      status: 'cancelled',
      cancelled_at: now,
      skip_reason: 'review_received',
      updated_at: now,
    })
    .eq('enrollment_id', input.enrollmentId)
    .eq('status', 'pending');

  if (stepsError) {
    console.error(`[review-requests] Failed to cancel pending review steps for enrollment ${input.enrollmentId}:`, stepsError.message);
  }
}

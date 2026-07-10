import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabase';
import { notifyCompletedService } from '@/lib/completed-service-alert';
import { enrollBookingInReviewRequest } from '@/lib/review-requests';
import { sendSenzaiEvent } from '@/lib/senzai-ingest';

/**
 * The booking fields needed to fire the completion side effects. Both callers
 * (the admin status route and the auto-complete cron) select exactly these.
 */
export interface CompletableBooking {
  id: string;
  customer_id: string | null;
  lead_id: string | null;
  location_id: string | null;
  trail_type: string | null;
  skill_level: string | null;
  date: string | null;
  time_slot: string | null;
  duration_hours: number | null;
  bike_rental: string | null;
  participant_count: number | null;
  total_price: number | null;
}

export interface ServiceCompletionResult {
  completedServiceWebhookSent: boolean;
  reviewRequestEnrollmentId: string | null;
  reviewRequestAlreadyActive: boolean;
}

/**
 * Fires every side effect of a booking transitioning into `completed`:
 *   1. n8n completed-service alert
 *   2. review-request enrollment
 *   3. Senzai `service.completed` (carrying refs.lead_id so the hub can pair it
 *      with the prior `lead.created` and compute Lead→Service time-to-close)
 *
 * The CALLER must have already flipped `bookings.status` to 'completed' (the
 * admin route via a direct update, the auto-complete cron via an atomic
 * confirmed→completed claim). Sharing this keeps both paths byte-identical —
 * a manually-completed booking and a cron-completed booking produce the same
 * event, so funnel attribution never drifts by source.
 *
 * The Senzai emit is idempotent by key, so re-running it (e.g. a manual
 * completion after the cron, or a retried cron effect) is safe.
 */
export async function runServiceCompletionEffects(
  booking: CompletableBooking,
  opts: { previousStatus: string | null; sourceRoute: string }
): Promise<ServiceCompletionResult> {
  const supabase = getSupabaseAdmin();
  const completedAt = new Date().toISOString();

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
    console.error('[complete-booking] customer fetch error:', customerResult.error);
  }

  if (locationResult.error) {
    console.error('[complete-booking] location fetch error:', locationResult.error);
  }

  const completedServiceWebhookSent = await notifyCompletedService({
    booking_id: booking.id,
    customer_id: booking.customer_id,
    full_name: customerResult.data?.name ?? null,
    email: customerResult.data?.email ?? null,
    phone: customerResult.data?.phone ?? null,
    trail_type: booking.trail_type ?? null,
    skill_level: booking.skill_level ?? null,
    location_name: locationResult.data?.name ?? null,
    meeting_location: null,
    meeting_address: null,
    meeting_url: null,
    date: booking.date ?? null,
    time_slot: booking.time_slot ?? null,
    duration_hours: booking.duration_hours ?? null,
    bike_rental: booking.bike_rental ?? null,
    participant_count: booking.participant_count ?? null,
    total_price: booking.total_price ?? null,
    status: 'completed',
    completed_at: completedAt,
  });

  let reviewRequestEnrollmentId: string | null = null;
  let reviewRequestAlreadyActive = false;
  try {
    const reviewRequest = await enrollBookingInReviewRequest(booking.id);
    reviewRequestEnrollmentId = reviewRequest.enrollment.id;
    reviewRequestAlreadyActive = reviewRequest.alreadyActive;
  } catch (reviewRequestError) {
    console.error(
      '[complete-booking] Failed to enroll completed booking into review requests:',
      reviewRequestError
    );
  }

  await sendSenzaiEvent({
    event_name: 'service.completed',
    occurred_at: completedAt,
    source_event_id: booking.id,
    idempotency_key: `booking:${booking.id}:service.completed`,
    source_route: opts.sourceRoute,
    authoritative_source: 'supabase.bookings.status_transition',
    entity_type: 'booking',
    entity_id: booking.id,
    refs: {
      booking_id: booking.id,
      lead_id: booking.lead_id ?? null,
      customer_id: booking.customer_id,
    },
    data: {
      booking_id: booking.id,
      previous_status: opts.previousStatus,
      status: 'completed',
      customer_id: booking.customer_id,
      location_id: booking.location_id,
      trail_type: booking.trail_type,
      skill_level: booking.skill_level,
      date: booking.date,
      time_slot: booking.time_slot,
      duration_hours: booking.duration_hours,
      participant_count: booking.participant_count,
      total_price: booking.total_price,
    },
  });

  return { completedServiceWebhookSent, reviewRequestEnrollmentId, reviewRequestAlreadyActive };
}

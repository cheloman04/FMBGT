import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAdminUserFromCookieStore } from '@/lib/admin-auth';
import { queueSenzaiEvent } from '@/lib/analytics-delivery';
import { runServiceCompletionEffects, type ServiceCompletionResult } from '@/lib/complete-booking';

const Schema = z.object({
  booking_id: z.string().uuid(),
  status: z.enum(['confirmed', 'completed', 'cancelled', 'refunded']),
});

export async function POST(req: NextRequest) {
  // Verify admin session cookie
  const cookieStore = await cookies();
  const adminUser = await getAdminUserFromCookieStore(cookieStore);
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = Schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { booking_id, status } = parsed.data;

  const supabase = getSupabaseAdmin();
  const { data: existingBooking, error: existingBookingError } = await supabase
    .from('bookings')
    .select(
      `
      id, customer_id, lead_id, location_id, trail_type, skill_level, date, time_slot,
      duration_hours, bike_rental, participant_count, total_price, status
    `
    )
    .eq('id', booking_id)
    .maybeSingle();

  if (existingBookingError || !existingBooking) {
    console.error('[admin] update-booking fetch error:', existingBookingError);
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const shouldNotifyCompletedService =
    status === 'completed' && existingBooking.status !== 'completed';
  const shouldEmitBookingCancelled =
    status === 'cancelled' && existingBooking.status !== 'cancelled';

  const { error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', booking_id);

  if (error) {
    console.error('[admin] update-booking error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  let completionResult: ServiceCompletionResult = {
    completedServiceWebhookSent: false,
    reviewRequestEnrollmentId: null,
    reviewRequestAlreadyActive: false,
  };

  if (shouldNotifyCompletedService) {
    // Same shared effects the auto-complete cron uses, so a manually-completed
    // booking and a cron-completed one emit an identical service.completed.
    completionResult = await runServiceCompletionEffects(existingBooking, {
      previousStatus: existingBooking.status,
      sourceRoute: '/api/admin/update-booking',
    });
  }

  if (shouldEmitBookingCancelled) {
    const occurredAt = new Date().toISOString();
    await queueSenzaiEvent({
      event_name: 'booking.cancelled',
      occurred_at: occurredAt,
      source_event_id: booking_id,
      idempotency_key: `booking:${booking_id}:booking.cancelled`,
      source_route: '/api/admin/update-booking',
      authoritative_source: 'supabase.bookings.status_transition',
      entity_type: 'booking',
      entity_id: booking_id,
      refs: {
        booking_id,
        lead_id: existingBooking.lead_id ?? null,
        customer_id: existingBooking.customer_id,
      },
      data: {
        booking_id,
        previous_status: existingBooking.status,
        status,
        customer_id: existingBooking.customer_id,
        location_id: existingBooking.location_id,
        trail_type: existingBooking.trail_type,
        date: existingBooking.date,
        time_slot: existingBooking.time_slot,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    completed_service_webhook_sent: completionResult.completedServiceWebhookSent,
    review_request_enrollment_id: completionResult.reviewRequestEnrollmentId,
    review_request_already_active: completionResult.reviewRequestAlreadyActive,
  });
}

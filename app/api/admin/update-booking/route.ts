import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';
import { notifyCompletedService } from '@/lib/completed-service-alert';
import { enrollBookingInReviewRequest } from '@/lib/review-requests';
import { getAdminUserFromCookieStore } from '@/lib/admin-auth';

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
      id, customer_id, location_id, trail_type, skill_level, date, time_slot,
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

  const { error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', booking_id);

  if (error) {
    console.error('[admin] update-booking error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  let completedServiceWebhookSent = false;
  let reviewRequestEnrollmentId: string | null = null;
  let reviewRequestAlreadyActive = false;

  if (shouldNotifyCompletedService) {
    const [customerResult, locationResult] = await Promise.all([
      existingBooking.customer_id
        ? supabase
            .from('customers')
            .select('id, name, email, phone')
            .eq('id', existingBooking.customer_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      existingBooking.location_id
        ? supabase
            .from('locations')
            .select('id, name')
            .eq('id', existingBooking.location_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (customerResult.error) {
      console.error('[admin] update-booking customer fetch error:', customerResult.error);
    }

    if (locationResult.error) {
      console.error('[admin] update-booking location fetch error:', locationResult.error);
    }

    completedServiceWebhookSent = await notifyCompletedService({
      booking_id: existingBooking.id,
      customer_id: existingBooking.customer_id,
      full_name: customerResult.data?.name ?? null,
      email: customerResult.data?.email ?? null,
      phone: customerResult.data?.phone ?? null,
      trail_type: existingBooking.trail_type ?? null,
      skill_level: existingBooking.skill_level ?? null,
      location_name: locationResult.data?.name ?? null,
      meeting_location: null,
      meeting_address: null,
      meeting_url: null,
      date: existingBooking.date ?? null,
      time_slot: existingBooking.time_slot ?? null,
      duration_hours: existingBooking.duration_hours ?? null,
      bike_rental: existingBooking.bike_rental ?? null,
      participant_count: existingBooking.participant_count ?? null,
      total_price: existingBooking.total_price ?? null,
      status,
      completed_at: new Date().toISOString(),
    });

    try {
      const reviewRequest = await enrollBookingInReviewRequest(existingBooking.id);
      reviewRequestEnrollmentId = reviewRequest.enrollment.id;
      reviewRequestAlreadyActive = reviewRequest.alreadyActive;
    } catch (reviewRequestError) {
      console.error(
        '[admin] Failed to enroll completed booking into review requests:',
        reviewRequestError
      );
    }
  }

  return NextResponse.json({
    ok: true,
    completed_service_webhook_sent: completedServiceWebhookSent,
    review_request_enrollment_id: reviewRequestEnrollmentId,
    review_request_already_active: reviewRequestAlreadyActive,
  });
}

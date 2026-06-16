import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAdminUser } from '@/lib/admin-auth';
import { finalizeManualBooking } from '@/lib/manual-booking';
import { triggerN8nEvent } from '@/lib/n8n';
import { getAppUrl } from '@/lib/app-url';
import { getBookingLocationMeta } from '@/lib/location-meta';
import { formatSkillLevel } from '@/lib/booking-email';
import { addHoursToIso, easternLocalToUtcIso } from '@/lib/booking-datetime';

const LIST_COLUMNS =
  'id, created_at, date, time_slot, duration_hours, trail_type, skill_level, status, ' +
  'payment_method, deposit_paid_cents, total_price, waiver_accepted, waiver_accepted_at, ' +
  'waiver_link_token, admin_notes, bike_rental, participant_count, ' +
  'customers(name, email, phone), locations(name)';

const ParticipantSchema = z.object({ name: z.string().trim().min(1).max(120) });

const CreateSchema = z.object({
  customer_name: z.string().trim().min(1).max(120),
  customer_email: z.string().trim().email().max(200),
  customer_phone: z.string().trim().max(40).optional(),
  trail_type: z.enum(['paved', 'mtb']),
  skill_level: z.enum(['first_time', 'beginner', 'intermediate', 'advanced']).nullish(),
  location_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  time_slot: z.string().trim().min(1).max(20),
  duration_hours: z.number().int().min(1).max(8),
  bike_rental: z.enum(['none', 'standard', 'electric']).default('none'),
  additional_participants: z.array(ParticipantSchema).max(20).default([]),
  amount_collected_cents: z.number().int().min(0).max(100_000_00),
  payment_method: z.enum(['cash', 'zelle', 'venmo', 'other']).default('cash'),
  admin_notes: z.string().trim().max(1000).optional(),
});

const ResendSchema = z.object({ id: z.string().uuid(), action: z.literal('resend') });

// GET — list manual bookings (newest first)
export async function GET() {
  try {
    await requireAdminUser();
    const supabase = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('bookings')
      .select(LIST_COLUMNS)
      .eq('booking_source', 'manual')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ bookings: data ?? [] });
  } catch (err) {
    console.error('[manual-booking GET]', err);
    return NextResponse.json({ error: 'Failed to fetch manual bookings' }, { status: 500 });
  }
}

// POST — create a manual (cash / off-platform) booking and finalize it (no Stripe)
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    const parsed = CreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;
    const supabase = getSupabaseAdmin();

    // Upsert the customer (email is the conflict key).
    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .upsert(
        { name: d.customer_name, email: d.customer_email.toLowerCase(), phone: d.customer_phone || null },
        { onConflict: 'email' }
      )
      .select('id')
      .single();
    if (customerError) throw customerError;
    const customerId = (customerData as { id: string }).id;

    // Resolve the active tour for this trail type (tour_id is a soft FK).
    const { data: tourData } = await supabase
      .from('tours')
      .select('id')
      .eq('type', d.trail_type)
      .eq('active', true)
      .maybeSingle();
    const tourId = (tourData as { id: string } | null)?.id ?? null;

    const waiverSessionId = randomUUID();
    const waiverLinkToken = randomUUID();
    const amountCents = d.amount_collected_cents;
    const additional = d.additional_participants ?? [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bookingData, error: bookingError } = await (supabase as any)
      .from('bookings')
      .insert({
        customer_id: customerId,
        tour_id: tourId,
        location_id: d.location_id,
        trail_type: d.trail_type,
        skill_level: d.skill_level ?? null,
        date: d.date,
        time_slot: d.time_slot,
        duration_hours: d.duration_hours,
        bike_rental: d.bike_rental,
        rider_height_inches: null,
        addons: {},
        participant_count: 1 + additional.length,
        participant_info: additional.length > 0 ? additional.map((p) => ({ name: p.name })) : null,
        // Pricing — the cash total agreed off-platform (no online price calc).
        base_price: amountCents,
        addons_price: 0,
        total_price: amountCents,
        // Payment — collected in cash; nothing owed online.
        deposit_amount: amountCents,
        deposit_paid_cents: amountCents,
        remaining_balance_amount: 0,
        remaining_balance_due_at: null,
        deposit_payment_status: 'paid',
        remaining_balance_status: 'paid',
        // Manual-booking metadata
        booking_source: 'manual',
        payment_method: d.payment_method,
        created_by_admin: admin.email ?? null,
        admin_notes: d.admin_notes || null,
        // Status + waiver (signed later via the tokenized page)
        status: 'confirmed',
        waiver_accepted: false,
        waiver_session_id: waiverSessionId,
        waiver_link_token: waiverLinkToken,
        cal_booking_status: 'pending',
        webhook_sent: false,
      })
      .select('id, created_at')
      .single();

    if (bookingError) {
      const msg = bookingError.message ?? '';
      // Inventory trigger raises `inventory_exhausted:<item>` when a rental is unavailable.
      if (msg.includes('inventory_exhausted')) {
        const item = (msg.split(':')[1] ?? 'item').trim();
        return NextResponse.json(
          { error: `No rental inventory available: ${item} is fully booked for this slot.` },
          { status: 409 }
        );
      }
      throw bookingError;
    }

    const booking = bookingData as { id: string; created_at: string };

    // Finalize: Cal.com event, confirmation email w/ waiver link, Senzai, Fin Log.
    const result = await finalizeManualBooking(booking.id);

    return NextResponse.json(
      {
        booking_id: booking.id,
        waiver_url: result.waiverUrl ?? `${getAppUrl()}/waiver/${waiverLinkToken}`,
        cal_booked: result.calBooked,
        email_queued: result.emailQueued,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[manual-booking POST]', err);
    return NextResponse.json({ error: 'Failed to create manual booking' }, { status: 500 });
  }
}

// PATCH — resend the confirmation + waiver-link email for an existing manual booking
export async function PATCH(req: NextRequest) {
  try {
    await requireAdminUser();
    const parsed = ResendSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: booking, error } = await (supabase as any)
      .from('bookings')
      .select(
        'id, date, time_slot, duration_hours, trail_type, skill_level, total_price, deposit_paid_cents, ' +
          'payment_method, waiver_link_token, waiver_accepted, participant_count, participant_info, ' +
          'zip_code, marketing_source, booking_source, customers(name, email, phone), locations(name)'
      )
      .eq('id', parsed.data.id)
      .eq('booking_source', 'manual')
      .maybeSingle();
    if (error) throw error;
    if (!booking) return NextResponse.json({ error: 'Manual booking not found' }, { status: 404 });

    const customer = (booking.customers ?? null) as { name?: string; email?: string; phone?: string } | null;
    if (!customer?.email) {
      return NextResponse.json({ error: 'This booking has no customer email on file.' }, { status: 400 });
    }
    const locationName = (booking.locations as { name?: string } | null)?.name ?? 'Florida Mountain Bike Guides';
    const waiverUrl = booking.waiver_link_token ? `${getAppUrl()}/waiver/${booking.waiver_link_token}` : null;
    const locationMeta = getBookingLocationMeta(locationName);
    const startIso = booking.date && booking.time_slot ? easternLocalToUtcIso(booking.date, booking.time_slot) : null;
    const endIso = startIso && booking.duration_hours ? addHoursToIso(startIso, booking.duration_hours) : null;

    const res = await triggerN8nEvent({
      event: 'booking_confirmed',
      source: '/api/admin/manual-booking (resend)',
      envKeys: ['N8N_WEBHOOK_URL'],
      data: {
        booking_id: booking.id,
        resend: true,
        customer_email: customer.email,
        customer_name: customer.name ?? null,
        customer_phone: customer.phone ?? null,
        deposit_amount: booking.deposit_paid_cents ?? 0,
        remaining_balance: 0,
        total_amount: booking.total_price ?? 0,
        manual_booking: true,
        payment_method: booking.payment_method ?? 'cash',
        waiver_required: true,
        waiver_signed: Boolean(booking.waiver_accepted),
        waiver_url: waiverUrl,
        location: locationName,
        date: booking.date,
        time: booking.time_slot,
        duration_hours: booking.duration_hours,
        participant_count: booking.participant_count,
        participant_info: booking.participant_info,
        trail_type: booking.trail_type,
        skill_level: formatSkillLevel(booking.skill_level),
        meeting_location_name: locationMeta.meetingPointName,
        meeting_location_address: locationMeta.meetingPointAddress,
        meeting_location_url: locationMeta.meetingPointUrl,
        booking_start_iso: startIso,
        booking_end_iso: endIso,
        calendar_url: `${getAppUrl()}/api/calendar/${booking.id}`,
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: res.error ?? 'Failed to send email' }, { status: 502 });
    }
    return NextResponse.json({ ok: true, waiver_url: waiverUrl });
  } catch (err) {
    console.error('[manual-booking PATCH]', err);
    return NextResponse.json({ error: 'Failed to resend email' }, { status: 500 });
  }
}

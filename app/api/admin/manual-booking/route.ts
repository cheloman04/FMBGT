import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAdminUser } from '@/lib/admin-auth';
import {
  MANUAL_BOOKING_LIST_COLUMNS,
  finalizeManualBooking,
  manualBalance,
  recordManualPayment,
  sendManualBookingEmail,
  updateManualBooking,
} from '@/lib/manual-booking';
import { getAppUrl } from '@/lib/app-url';
import { findOpenLeadsByEmail } from '@/lib/lead-conversion';

const BikeSchema = z.enum(['none', 'standard', 'electric']);
const HeightSchema = z.number().int().min(36).max(90);
const ParticipantSchema = z.object({
  name: z.string().trim().min(1).max(120),
  bike_rental: BikeSchema.optional(),
  height_inches: HeightSchema.nullish(),
});
const PaymentMethodSchema = z.enum(['cash', 'zelle', 'venmo', 'other']);
const CentsSchema = z.number().int().min(0).max(100_000_00);

const CreateSchema = z
  .object({
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
    // Agreed price for the tour. Omitted = fully paid with amount_collected_cents.
    total_cents: CentsSchema.optional(),
    amount_collected_cents: CentsSchema,
    payment_method: PaymentMethodSchema.default('cash'),
    admin_notes: z.string().trim().max(1000).optional(),
    // false = just hold the date; the confirmation email can be sent later.
    send_confirmation: z.boolean().default(true),
  })
  .refine((d) => d.total_cents === undefined || d.amount_collected_cents <= d.total_cents, {
    message: 'Amount collected cannot be more than the total',
    path: ['amount_collected_cents'],
  });

const PatchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('resend'), id: z.string().uuid() }),
  z.object({
    action: z.literal('update'),
    id: z.string().uuid(),
    customer_name: z.string().trim().min(1).max(120).optional(),
    customer_email: z.string().trim().email().max(200).optional(),
    customer_phone: z.string().trim().max(40).nullish(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
    time_slot: z.string().trim().min(1).max(20).optional(),
    duration_hours: z.number().int().min(1).max(8).optional(),
    bike_rental: BikeSchema.optional(),
    rider_height_inches: HeightSchema.nullish(),
    additional_participants: z.array(ParticipantSchema).max(20).optional(),
    total_cents: CentsSchema.optional(),
    payment_method: PaymentMethodSchema.optional(),
    admin_notes: z.string().trim().max(1000).nullish(),
    notify_customer: z.boolean().default(false),
  }),
  z.object({
    action: z.literal('record_payment'),
    id: z.string().uuid(),
    amount_cents: z.number().int().min(1).max(100_000_00),
    payment_method: PaymentMethodSchema,
  }),
]);

// GET — list manual bookings (newest first)
export async function GET() {
  try {
    await requireAdminUser();
    const supabase = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('bookings')
      .select(MANUAL_BOOKING_LIST_COLUMNS)
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

    // The customer may have started the online flow first: link their open lead
    // (most recently active) so finalizeManualBooking converts it.
    const [lead] = await findOpenLeadsByEmail(d.customer_email);

    const waiverSessionId = randomUUID();
    const waiverLinkToken = randomUUID();
    const collectedCents = d.amount_collected_cents;
    const totalCents = d.total_cents ?? collectedCents;
    const additional = d.additional_participants ?? [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bookingData, error: bookingError } = await (supabase as any)
      .from('bookings')
      .insert({
        customer_id: customerId,
        lead_id: lead?.id ?? null,
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
        // Pricing — the total agreed off-platform (no online price calc).
        base_price: totalCents,
        addons_price: 0,
        total_price: totalCents,
        // Payment — collected off-platform. Any balance is settled off-platform
        // too (no due date / Stripe method, so the charge-remaining cron skips it).
        deposit_amount: collectedCents,
        deposit_paid_cents: collectedCents,
        ...manualBalance(totalCents, collectedCents),
        remaining_balance_due_at: null,
        deposit_payment_status: 'paid',
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

    // Finalize: lead conversion, Cal.com event, confirmation email w/ waiver link, Senzai, Fin Log.
    const result = await finalizeManualBooking(booking.id, { sendConfirmation: d.send_confirmation });

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

// PATCH — act on an existing manual booking: resend the confirmation email,
// edit it, or record a payment toward its balance.
export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    const parsed = PatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data;

    if (body.action === 'resend') {
      const email = await sendManualBookingEmail(body.id, {
        resend: true,
        source: '/api/admin/manual-booking (resend)',
      });
      if (!email.ok) {
        const status = email.reason === 'not_found' ? 404 : email.reason === 'no_email' ? 400 : 502;
        return NextResponse.json({ error: email.error ?? 'Failed to send email' }, { status });
      }
      return NextResponse.json({ ok: true, waiver_url: email.waiverUrl });
    }

    if (body.action === 'record_payment') {
      const result = await recordManualPayment({
        bookingId: body.id,
        amountCents: body.amount_cents,
        paymentMethod: body.payment_method,
        adminEmail: admin.email ?? null,
      });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({
        ok: true,
        collected_cents: result.collectedCents,
        remaining_cents: result.remainingCents,
      });
    }

    const result = await updateManualBooking(body, admin.email ?? null);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({
      ok: true,
      changed: result.changed,
      calendar_ok: result.calendar ? result.calendar.ok : null,
      calendar_error: result.calendar?.error ?? null,
      waiver_reset: result.waiverReset,
      email_sent: result.email ? result.email.ok : null,
      email_error: result.email?.error ?? null,
    });
  } catch (err) {
    console.error('[manual-booking PATCH]', err);
    return NextResponse.json({ error: 'Failed to update manual booking' }, { status: 500 });
  }
}

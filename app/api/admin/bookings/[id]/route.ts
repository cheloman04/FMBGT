/**
 * PATCH /api/admin/bookings/[id] — edit an online booking.
 *
 * `dry_run: true` (the default) only returns the preview of what would happen
 * (price, balance charge, calendar, waiver); `dry_run: false` saves it. Manual
 * bookings are edited through /api/admin/manual-booking.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOperator, unauthorized } from '@/lib/admin/auth';
import { editOnlineBooking } from '@/lib/booking-edit';

const BikeSchema = z.enum(['none', 'standard', 'electric']);
const HeightSchema = z.number().int().min(36).max(90);

const EditSchema = z.object({
  dry_run: z.boolean().default(true),
  customer_name: z.string().trim().min(1).max(120).optional(),
  customer_email: z.string().trim().email().max(200).optional(),
  customer_phone: z.string().trim().max(40).nullish(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  time_slot: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM').optional(),
  duration_hours: z.number().int().min(1).max(8).optional(),
  location_id: z.string().uuid().optional(),
  skill_level: z.enum(['first_time', 'beginner', 'intermediate', 'advanced']).nullish(),
  bike_rental: BikeSchema.optional(),
  rider_height_inches: HeightSchema.nullish(),
  participants: z
    .array(z.object({ name: z.string().trim().min(1).max(120), bike_rental: BikeSchema.optional(), height_inches: HeightSchema.nullish() }))
    .max(20)
    .optional(),
  addons: z.object({ gopro: z.boolean().optional(), pickup_dropoff: z.boolean().optional() }).optional(),
  admin_notes: z.string().trim().max(1000).nullish(),
  price_override_cents: z.number().int().min(0).max(100_000_00).nullish(),
  price_override_reason: z.string().trim().max(300).nullish(),
  notify_customer: z.boolean().default(false),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // The session first, before any work: an API answers 401, never a redirect.
  const admin = await getOperator();
  if (!admin) return unauthorized();

  const { id } = await params;
  const parsed = EditSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 });
  }
  const { dry_run, ...fields } = parsed.data;

  try {
    const result = await editOnlineBooking({ id, ...fields }, { dryRun: dry_run, adminEmail: admin.email ?? null });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({
      ok: true,
      dry_run: result.dryRun,
      preview: result.preview,
      calendar_ok: result.calendar ? result.calendar.ok : null,
      calendar_error: result.calendar?.error ?? null,
      email_sent: result.email ? result.email.ok : null,
      email_error: result.email?.error ?? null,
    });
  } catch (err) {
    console.error('[admin/bookings PATCH]', err);
    return NextResponse.json({ error: 'Failed to update the booking' }, { status: 500 });
  }
}

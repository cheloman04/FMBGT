import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createCheckoutSession } from '@/lib/stripe';
import { validateBookingInventory } from '@/lib/inventory';
import { calculatePriceBreakdown } from '@/lib/pricing';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { BookingState, TrailType } from '@/types/booking';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const AdditionalParticipantSchema = z.object({
  name: z.string().min(1),
  bike_rental: z.enum(['none', 'standard', 'electric']).optional(),
  height_inches: z.number().optional(),
});

const BookingStateSchema = z.object({
  trail_type: z.enum(['paved', 'mtb']),
  skill_level: z.enum(['first_time', 'beginner', 'intermediate', 'advanced']).optional(),
  location_id: z.string().uuid(),
  location_name: z.string(),
  bike_rental: z.enum(['none', 'standard', 'electric']),
  rider_height_inches: z.number().optional(),
  participant_count: z.number().min(1).max(6).default(1),
  additional_participants: z.array(AdditionalParticipantSchema).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time_slot: z.string(),
  duration_hours: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  addons: z.object({
    gopro: z.boolean().optional(),
    pickup_dropoff: z.boolean().optional(),
    electric_upgrade: z.boolean().optional(),
  }),
  waiver_accepted: z.boolean(),
  customer: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    height_inches: z.number().optional(),
    zip_code: z.string().max(10).optional(),
    marketing_source: z.string().max(50).optional(),
  }),
});

// Max participants per paved location
const PAVED_MAX_PARTICIPANTS: Record<string, number> = {
  'Blue Spring State Park': 4,
  'Sanford Historic Downtown': 6,
};
const MTB_MAX_PARTICIPANTS = 6;

// Rate limiter — 10 checkout attempts per IP per hour.
// Uses Upstash Redis (HTTP API, compatible with Vercel serverless).
// Skips silently if UPSTASH_REDIS_REST_URL / TOKEN are not set.
let ratelimit: Ratelimit | null = null;
function getRatelimit(): Ratelimit | null {
  if (ratelimit) return ratelimit;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  ratelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    prefix: 'fmtg:checkout',
  });
  return ratelimit;
}

function requireJson(req: NextRequest): boolean {
  const ct = req.headers.get('content-type') ?? '';
  return ct.includes('application/json');
}

function isAllowedOrigin(req: NextRequest): boolean {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return true; // Skip check if not configured
  const origin = req.headers.get('origin');
  if (!origin) return true; // Server-to-server calls have no origin
  return origin === appUrl || origin === 'http://localhost:3000';
}

export async function POST(req: NextRequest) {
  if (!requireJson(req)) {
    return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 });
  }
  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Rate limiting (skips if Upstash env vars not configured)
  const limiter = getRatelimit();
  if (limiter) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
    const { success, limit, remaining, reset } = await limiter.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': String(remaining),
            'X-RateLimit-Reset': String(reset),
          },
        }
      );
    }
  }

  try {
    const body = await req.json();
    const { booking_state } = body;

    // Validate input
    const parsed = BookingStateSchema.safeParse(booking_state);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid booking data', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Normalize email server-side regardless of client input
    const raw = parsed.data;
    const state = { ...raw, customer: { ...raw.customer, email: raw.customer.email.toLowerCase().trim() } };

    // Validate participant count against location limits
    const maxParticipants = state.trail_type === 'paved'
      ? (PAVED_MAX_PARTICIPANTS[state.location_name] ?? 4)
      : MTB_MAX_PARTICIPANTS;
    if (state.participant_count > maxParticipants) {
      return NextResponse.json(
        { error: `Maximum ${maxParticipants} riders allowed at ${state.location_name}.` },
        { status: 400 }
      );
    }

    // Location-specific bike restrictions
    const NO_ELECTRIC_LOCATIONS = new Set(['Blue Spring State Park']);
    if (state.bike_rental === 'electric' && NO_ELECTRIC_LOCATIONS.has(state.location_name)) {
      return NextResponse.json(
        { error: 'Electric bike rental is not available at this location.' },
        { status: 400 }
      );
    }
    // Fleet cap: max 4 standard bikes and 2 e-bikes per booking
    // Applies to Sanford (paved) and all MTB locations
    const hasFleetCap = state.trail_type === 'mtb' ||
      (state.trail_type === 'paved' && state.location_name === 'Sanford Historic Downtown');
    if (hasFleetCap) {
      const allParticipants = [
        { bike_rental: state.bike_rental },
        ...(state.additional_participants ?? []),
      ];
      const electricCount = allParticipants.filter(p => p.bike_rental === 'electric').length;
      const standardCount = allParticipants.filter(p => p.bike_rental === 'standard').length;
      if (electricCount > 2) {
        return NextResponse.json(
          { error: 'Only 2 electric bikes are available per booking.' },
          { status: 400 }
        );
      }
      if (standardCount > 4) {
        return NextResponse.json(
          { error: 'Only 4 standard rental bikes are available per booking.' },
          { status: 400 }
        );
      }
    }

    // Enforce minimum 24h lead time
    const bookingDate = new Date(state.date + 'T00:00:00');
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 1);
    minDate.setHours(0, 0, 0, 0);
    if (bookingDate < minDate) {
      return NextResponse.json(
        { error: 'Bookings must be made at least 24 hours in advance' },
        { status: 400 }
      );
    }

    // Check waiver
    if (!state.waiver_accepted) {
      return NextResponse.json(
        { error: 'Waiver must be accepted before checkout' },
        { status: 400 }
      );
    }

    // Validate inventory (pass full participant list so multi-rider electric counts are correct)
    const inventoryCheck = await validateBookingInventory(
      state.date,
      state.bike_rental,
      state.addons,
      state.additional_participants
    );

    if (!inventoryCheck.valid) {
      return NextResponse.json(
        { error: 'Inventory unavailable', details: inventoryCheck.errors },
        { status: 409 }
      );
    }

    // Server-side price calculation (source of truth)
    // Paved tours: always 2hr. Blue Spring has no electric — force standard. Sanford uses rider's choice.
    const effectiveDuration = state.trail_type === 'paved' ? 2 : state.duration_hours;
    const effectiveBike = (state.trail_type === 'paved' && state.location_name === 'Blue Spring State Park')
      ? 'standard'
      : state.bike_rental;
    const priceBreakdown = calculatePriceBreakdown(
      effectiveBike,
      effectiveDuration,
      state.addons,
      state.trail_type,
      state.additional_participants
    );

    const supabase = getSupabaseAdmin();

    // Upsert customer
    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .upsert(
        {
          name: state.customer.name,
          email: state.customer.email,
          phone: state.customer.phone,
          height_inches: state.rider_height_inches,
        },
        { onConflict: 'email' }
      )
      .select('id')
      .single();

    if (customerError) throw customerError;

    const customer = customerData as { id: string };

    // Get tour ID
    const { data: tourData } = await supabase
      .from('tours')
      .select('id')
      .eq('type', state.trail_type as TrailType)
      .eq('active', true)
      .single();

    const tour = tourData as { id: string } | null;
    if (!tour) {
      console.error(`[create-checkout] No active tour found for trail_type=${state.trail_type} — booking will have null tour_id`);
    }

    // Create pending booking
    const { data: bookingData, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        customer_id: customer.id,
        tour_id: tour?.id,
        location_id: state.location_id,
        trail_type: state.trail_type,
        skill_level: state.skill_level,
        date: state.date,
        time_slot: state.time_slot,
        duration_hours: effectiveDuration,
        bike_rental: state.bike_rental,
        rider_height_inches: state.rider_height_inches,
        addons: state.addons,
        participant_count: state.participant_count,
        participant_info: (state.additional_participants && state.additional_participants.length > 0) ? state.additional_participants : null,
        base_price: priceBreakdown.base_price,
        addons_price: priceBreakdown.addons_price,
        total_price: priceBreakdown.total,
        status: 'pending',
        waiver_accepted: true,
        waiver_accepted_at: new Date().toISOString(),
        zip_code: state.customer.zip_code ?? null,
        marketing_source: state.customer.marketing_source ?? null,
      })
      .select('id')
      .single();

    if (bookingError) {
      // DB trigger raises this when inventory is exhausted by a concurrent request
      const msg = bookingError.message ?? '';
      if (msg.includes('inventory_exhausted')) {
        const item = msg.split(':')[1] ?? 'item';
        return NextResponse.json(
          { error: 'Inventory unavailable', details: [`${item} was just taken by another booking. Please select a different date.`] },
          { status: 409 }
        );
      }
      throw bookingError;
    }

    const booking = bookingData as { id: string };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    // Create Stripe checkout session
    const session = await createCheckoutSession({
      bookingState: state as BookingState,
      priceBreakdown,
      successUrl: `${appUrl}/booking/confirmation?booking_id=${booking.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl}/booking`,
      bookingId: booking.id,
    });

    // Update booking with Stripe session ID
    await supabase
      .from('bookings')
      .update({ stripe_session_id: session.id })
      .eq('id', booking.id);

    return NextResponse.json({
      checkout_url: session.url,
      session_id: session.id,
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createCheckoutSession } from '@/lib/stripe';
import { validateBookingInventory } from '@/lib/inventory';
import { calculatePriceBreakdown } from '@/lib/pricing';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { BookingState, TrailType } from '@/types/booking';

const BookingStateSchema = z.object({
  trail_type: z.enum(['paved', 'mtb']),
  skill_level: z.enum(['first_time', 'beginner', 'intermediate', 'advanced']).optional(),
  location_id: z.string().uuid(),
  location_name: z.string(),
  bike_rental: z.enum(['none', 'standard', 'electric']),
  rider_height_inches: z.number().optional(),
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
  }),
});

export async function POST(req: NextRequest) {
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

    const state = parsed.data;

    // Check waiver
    if (!state.waiver_accepted) {
      return NextResponse.json(
        { error: 'Waiver must be accepted before checkout' },
        { status: 400 }
      );
    }

    // Validate inventory
    const inventoryCheck = await validateBookingInventory(
      state.date,
      state.bike_rental,
      state.addons
    );

    if (!inventoryCheck.valid) {
      return NextResponse.json(
        { error: 'Inventory unavailable', details: inventoryCheck.errors },
        { status: 409 }
      );
    }

    // Server-side price calculation (source of truth)
    const priceBreakdown = calculatePriceBreakdown(
      state.bike_rental,
      state.duration_hours,
      state.addons
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
        duration_hours: state.duration_hours,
        bike_rental: state.bike_rental,
        rider_height_inches: state.rider_height_inches,
        addons: state.addons,
        base_price: priceBreakdown.base_price + priceBreakdown.duration_surcharge,
        addons_price: priceBreakdown.addons_price,
        total_price: priceBreakdown.total,
        status: 'pending',
        waiver_accepted: true,
        waiver_accepted_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (bookingError) throw bookingError;

    const booking = bookingData as { id: string };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    // Create Stripe checkout session
    const session = await createCheckoutSession({
      bookingState: state as BookingState,
      priceBreakdown,
      successUrl: `${appUrl}/booking/confirmation`,
      cancelUrl: `${appUrl}/booking/step9-payment`,
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

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createCheckoutSession, createStripeCustomer, getStripeCustomer } from '@/lib/stripe';
import { validateBookingInventory } from '@/lib/inventory';
import { calculatePriceBreakdown, PRICING } from '@/lib/pricing';
import { getSupabaseAdmin } from '@/lib/supabase';
import { markLeadSessionCheckoutStarted } from '@/lib/lead-sessions';
import type { BookingState, TrailType } from '@/types/booking';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { getAppUrl, isLocalOrigin } from '@/lib/app-url';
import { sendSenzaiEvent } from '@/lib/senzai-ingest';
import { recordFinancialEvent } from '@/lib/financial-log';
import { resolveDiscount, calcDiscountAmount } from '@/lib/discounts';
import {
  buildMetaUserData,
  getClientIpFromHeaders,
  getEventSourceUrlFromHeaders,
  sendMetaEvent,
} from '@/lib/meta-capi';

const AdditionalParticipantSchema = z.object({
  name: z.string().min(1),
  bike_rental: z.enum(['none', 'standard', 'electric']).optional(),
  height_inches: z.number().optional(),
});

const AttributionPayloadSchema = z.object({
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(200).optional(),
  utm_content: z.string().max(200).optional(),
  utm_term: z.string().max(200).optional(),
  flow: z.string().max(100).optional(),
  sequence_key: z.string().max(100).optional(),
  template_key: z.string().max(200).optional(),
  step_key: z.string().max(100).optional(),
  enrollment_id: z.string().uuid().optional(),
  trail_type: z.enum(['paved', 'mtb']).optional(),
  cta: z.string().max(100).optional(),
  captured_at: z.string().datetime().optional(),
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
  }).optional().default({ gopro: false, pickup_dropoff: false, electric_upgrade: false }),
  waiver_accepted: z.boolean(),
  waiver_session_id: z.string().uuid('Invalid waiver session'),
  customer: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    height_inches: z.number().optional(),
    zip_code: z.string().max(10).optional(),
    marketing_source: z.string().max(50).optional(),
  }),
  lead_id: z.string().uuid().optional(),
  lead_session_id: z.string().uuid().optional(),
  live_test_mode: z.boolean().optional(),
  live_test_token: z.string().max(200).optional(),
  discount_code: z.string().max(100).nullable().optional(),
  first_touch_attribution: AttributionPayloadSchema.optional(),
  last_touch_attribution: AttributionPayloadSchema.optional(),
});

// Max participants per paved location
const PAVED_MAX_PARTICIPANTS: Record<string, number> = {
  'Blue Spring State Park': 4,
  'Sanford Historic Riverfront Tour': 6,
};
const MTB_MAX_PARTICIPANTS = 6;

// Rate limiter — 10 checkout attempts per IP per hour
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
  const appUrl = getAppUrl();
  const origin = req.headers.get('origin');
  if (!origin) return true;
  if (isLocalOrigin(origin)) return true;
  return origin === appUrl;
}

/**
 * Calculate the remaining balance due date as the start of the UTC day before
 * the tour, so the daily cron run always picks it up on the day before.
 */
function calcRemainingBalanceDueAt(tourDateStr: string): string {
  const [y, m, d] = tourDateStr.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d - 1, 0, 0, 0)).toISOString();
}

function isLiveTestModeAuthorized(input: { requested?: boolean; token?: string }): boolean {
  if (!input.requested) return false;
  const expectedToken = process.env.LIVE_TEST_BOOKING_TOKEN;
  if (!expectedToken) return false;
  return input.token === expectedToken;
}

type ReconciledLead = {
  id: string;
  status: string;
  selected_trail_type: TrailType | null;
  created_at: string;
  booking_id: string | null;
  converted_at: string | null;
};

async function resolveCheckoutLead(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  input: {
    requestedLeadId?: string;
    customerEmail: string;
    trailType: TrailType;
  }
): Promise<ReconciledLead | null> {
  const normalizedEmail = input.customerEmail.trim().toLowerCase();

  if (input.requestedLeadId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: requestedLead } = await (supabase as any)
      .from('leads')
      .select('id, status, selected_trail_type, created_at, booking_id, converted_at')
      .eq('id', input.requestedLeadId)
      .maybeSingle();

    if (
      requestedLead &&
      !requestedLead.booking_id &&
      !requestedLead.converted_at &&
      requestedLead.status !== 'converted'
    ) {
      return requestedLead as ReconciledLead;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: matchingLeads, error } = await (supabase as any)
    .from('leads')
    .select('id, status, selected_trail_type, created_at, booking_id, converted_at')
    .eq('email', normalizedEmail)
    .in('status', ['lead', 'lost'])
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !matchingLeads?.length) {
    return null;
  }

  const unresolvedLeads = (matchingLeads as ReconciledLead[]).filter(
    (lead) => !lead.booking_id && !lead.converted_at && lead.status !== 'converted'
  );

  if (unresolvedLeads.length === 0) {
    return null;
  }

  return (
    unresolvedLeads.find((lead) => lead.selected_trail_type === input.trailType) ??
    unresolvedLeads[0]
  );
}

export async function POST(req: NextRequest) {
  try {
    getAppUrl();
  } catch (error) {
    console.error('[checkout] Invalid NEXT_PUBLIC_APP_URL:', error);
    return NextResponse.json({ error: 'Application URL is misconfigured' }, { status: 500 });
  }

  if (!requireJson(req)) {
    return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 });
  }
  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Rate limiting (skips if Upstash env vars not configured or Redis is unreachable)
  const limiter = getRatelimit();
  if (limiter) {
    try {
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
    } catch (err) {
      console.warn('[checkout] Rate limiter unavailable, skipping:', (err as Error).message);
    }
  }

  try {
    const body = await req.json();
    const { booking_state } = body;

    const parsed = BookingStateSchema.safeParse(booking_state);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid booking data', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const raw = parsed.data;
    const state = { ...raw, customer: { ...raw.customer, email: raw.customer.email.toLowerCase().trim() } };
    const clientIpAddress = getClientIpFromHeaders(req.headers);
    const clientUserAgent = req.headers.get('user-agent');
    const eventSourceUrl = getEventSourceUrlFromHeaders(req.headers);
    const fbc = req.cookies.get('_fbc')?.value ?? req.cookies.get('fbc')?.value ?? null;
    const fbp = req.cookies.get('_fbp')?.value ?? req.cookies.get('fbp')?.value ?? null;

    // Validate participant count
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

    // Fleet cap
    const hasFleetCap = state.trail_type === 'mtb' ||
      (state.trail_type === 'paved' && state.location_name === 'Sanford Historic Riverfront Tour');
    if (hasFleetCap) {
      const allParticipants = [
        { bike_rental: state.bike_rental },
        ...(state.additional_participants ?? []),
      ];
      const electricCount = allParticipants.filter(p => p.bike_rental === 'electric').length;
      const standardCount = allParticipants.filter(p => p.bike_rental === 'standard').length;
      if (electricCount > 2) {
        return NextResponse.json({ error: 'Only 2 electric bikes are available per booking.' }, { status: 400 });
      }
      if (standardCount > 4) {
        return NextResponse.json({ error: 'Only 4 standard rental bikes are available per booking.' }, { status: 400 });
      }
    }

    // Minimum 24h lead time
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

    const supabase = getSupabaseAdmin();
    const reconciledLead = await resolveCheckoutLead(supabase, {
      requestedLeadId: state.lead_id,
      customerEmail: state.customer.email,
      trailType: state.trail_type,
    });
    const effectiveLeadId = reconciledLead?.id ?? state.lead_id ?? null;

    // Waiver validation
    if (!state.waiver_accepted || !state.waiver_session_id) {
      return NextResponse.json(
        { error: 'All required waivers must be signed before checkout' },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: waiverRecords, error: waiverErr } = await (supabase as any)
      .from('waiver_records')
      .select('id, signer_name')
      .eq('session_id', state.waiver_session_id);

    if (waiverErr || !waiverRecords || waiverRecords.length === 0) {
      return NextResponse.json(
        { error: 'Waiver session not found. Please re-complete the waiver step.' },
        { status: 400 }
      );
    }

    // Inventory validation
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

    // Server-side price calculation
    const effectiveDuration = state.trail_type === 'paved' ? 2 : state.duration_hours;
    const effectiveBike = (state.trail_type === 'paved' && state.location_name === 'Blue Spring State Park')
      ? 'standard'
      : state.bike_rental;
    const liveTestMode = isLiveTestModeAuthorized({
      requested: state.live_test_mode,
      token: state.live_test_token,
    });

    // Validate discount code server-side — never trust client percentage
    const discountDef = resolveDiscount(state.discount_code);
    if (state.discount_code && state.discount_code !== 'none' && !discountDef) {
      return NextResponse.json({ error: 'Invalid discount code.' }, { status: 400 });
    }

    const priceBreakdown = calculatePriceBreakdown(
      effectiveBike,
      effectiveDuration,
      state.addons,
      state.trail_type,
      state.additional_participants,
      { liveTestMode }
    );

    // Apply discount server-side (after tax; discount reduces the final total)
    const discountAmountCents = discountDef
      ? calcDiscountAmount(priceBreakdown.total, discountDef.percentage)
      : 0;
    const totalAfterDiscount = priceBreakdown.total - discountAmountCents;

    // Deposit split: 50% of discounted total
    const depositAmount = Math.round(totalAfterDiscount / 2);
    const remainingBalanceAmount = totalAfterDiscount - depositAmount;
    const remainingBalanceDueAt = calcRemainingBalanceDueAt(state.date);

    // ── Stripe Customer ───────────────────────────────────────────────────────
    // Upsert our Supabase customer record, then get/create a Stripe customer
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
      .select('id, stripe_customer_id')
      .single();

    if (customerError) throw customerError;

    const customerRecord = customerData as { id: string; stripe_customer_id: string | null };

    // Get existing Stripe customer or create a new one
    let stripeCustomerId = customerRecord.stripe_customer_id ?? null;
    if (stripeCustomerId) {
      // Verify it still exists (could have been deleted in Stripe dashboard)
      const existing = await getStripeCustomer(stripeCustomerId);
      if (!existing) stripeCustomerId = null;
    }

    if (!stripeCustomerId) {
      const newCustomer = await createStripeCustomer(state.customer.name, state.customer.email);
      stripeCustomerId = newCustomer.id;
      // Persist back to Supabase customer record
      await supabase
        .from('customers')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', customerRecord.id);
    }

    // ── Tour lookup ───────────────────────────────────────────────────────────
    const { data: tourData } = await supabase
      .from('tours')
      .select('id')
      .eq('type', state.trail_type as TrailType)
      .eq('active', true)
      .single();

    const tour = tourData as { id: string } | null;
    if (!tour) {
      console.error(`[checkout] No active tour for trail_type=${state.trail_type}`);
    }

    // ── Create pending booking ────────────────────────────────────────────────
    const { data: bookingData, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        customer_id: customerRecord.id,
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
        participant_info: (state.additional_participants?.length ?? 0) > 0
          ? state.additional_participants
          : null,
        base_price: priceBreakdown.base_price,
        addons_price: priceBreakdown.addons_price,
        total_price: priceBreakdown.total,
        // Discount
        discount_code: discountDef?.code ?? null,
        discount_label: discountDef?.label ?? null,
        discount_percentage: discountDef?.percentage ?? null,
        discount_amount_cents: discountAmountCents,
        subtotal_before_discount_cents: discountDef ? priceBreakdown.total : null,
        total_after_discount_cents: discountDef ? totalAfterDiscount : null,
        // Deposit split
        deposit_amount: depositAmount,
        remaining_balance_amount: remainingBalanceAmount,
        remaining_balance_due_at: remainingBalanceDueAt,
        deposit_payment_status: 'pending',
        remaining_balance_status: 'pending',
        stripe_customer_id: stripeCustomerId,
        // Booking status
        status: 'pending',
        waiver_accepted: true,
        waiver_accepted_at: new Date().toISOString(),
        waiver_session_id: state.waiver_session_id,
        zip_code: state.customer.zip_code ?? null,
        marketing_source: state.customer.marketing_source ?? null,
        lead_id: effectiveLeadId,
        booking_session_id: state.lead_session_id ?? null,
        attribution_snapshot: {
          ...(state.last_touch_attribution ?? state.first_touch_attribution ?? {}),
          ...(eventSourceUrl ? { meta_event_source_url: eventSourceUrl } : {}),
          ...(clientIpAddress ? { meta_client_ip_address: clientIpAddress } : {}),
          ...(clientUserAgent ? { meta_client_user_agent: clientUserAgent } : {}),
          ...(fbc ? { meta_fbc: fbc } : {}),
          ...(fbp ? { meta_fbp: fbp } : {}),
          ...(liveTestMode ? { live_test_mode: true, live_test_total: PRICING.LIVE_TEST_TOTAL } : {}),
        },
      })
      .select('id, created_at')
      .single();

    if (bookingError) {
      const msg = bookingError.message ?? '';
      if (msg.includes('inventory_exhausted')) {
        const item = msg.split(':')[1] ?? 'item';
        return NextResponse.json(
          { error: 'Inventory unavailable', details: [`${item} was just taken by another booking.`] },
          { status: 409 }
        );
      }
      throw bookingError;
    }

    const booking = bookingData as { id: string; created_at: string };
    const appUrl = getAppUrl();

    // ── Create Stripe Checkout Session ────────────────────────────────────────
    const session = await createCheckoutSession({
      bookingState: state as BookingState,
      priceBreakdown,
      depositAmount,
      remainingBalance: remainingBalanceAmount,
      successUrl: `${appUrl}/booking/confirmation?booking_id=${booking.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl}/booking`,
      bookingId: booking.id,
      stripeCustomerId,
      liveTestMode,
      discountDef: discountDef ?? null,
      discountAmountCents,
      totalAfterDiscount,
    });

    // Update booking with Stripe session ID
    await supabase
      .from('bookings')
      .update({ stripe_session_id: session.id })
      .eq('id', booking.id);

    if (effectiveLeadId && state.lead_session_id) {
      await markLeadSessionCheckoutStarted(effectiveLeadId, state.lead_session_id);
    }

    const metaUserData = buildMetaUserData({
      email: state.customer.email,
      phone: state.customer.phone ?? null,
      fullName: state.customer.name,
      clientIpAddress,
      clientUserAgent,
      fbc,
      fbp,
      externalId: effectiveLeadId ?? customerRecord.id ?? booking.id,
    });

    // Use Stripe's checkout session ID as event_id so retries stay deduped and the
    // server-side InitiateCheckout event is anchored to the real payment session.
    const metaEventId = session.id;

    await sendMetaEvent({
      data: [
        {
          event_name: 'InitiateCheckout',
          event_time: Math.floor(Date.now() / 1000),
          event_id: metaEventId,
          action_source: 'website',
          ...(eventSourceUrl ? { event_source_url: eventSourceUrl } : {}),
          ...(Object.keys(metaUserData).length > 0 ? { user_data: metaUserData } : {}),
          custom_data: {
            currency: 'USD',
            value: Number((priceBreakdown.total / 100).toFixed(2)),
            booking_id: booking.id,
            stripe_session_id: session.id,
          },
        },
      ],
    });

    const checkoutAttributes = {
      booking_id: booking.id,
      lead_id: effectiveLeadId,
      booking_session_id: state.lead_session_id ?? null,
      stripe_session_id: session.id,
      stripe_customer_id: stripeCustomerId,
      customer_id: customerRecord.id,
      customer_email: state.customer.email,
      customer_name: state.customer.name,
      customer_phone: state.customer.phone ?? null,
      trail_type: state.trail_type,
      skill_level: state.skill_level ?? null,
      location_id: state.location_id,
      location_name: state.location_name,
      date: state.date,
      time_slot: state.time_slot,
      duration_hours: effectiveDuration,
      participant_count: state.participant_count,
      bike_rental: state.bike_rental,
      total_amount: priceBreakdown.total,
      discount_code: discountDef?.code ?? null,
      discount_label: discountDef?.label ?? null,
      discount_percentage: discountDef?.percentage ?? null,
      discount_amount_cents: discountAmountCents,
      total_after_discount: totalAfterDiscount,
      deposit_amount: depositAmount,
      remaining_balance_amount: remainingBalanceAmount,
      remaining_balance_due_at: remainingBalanceDueAt,
      live_test_mode: liveTestMode,
    };

    await sendSenzaiEvent({
      event_name: 'booking.started',
      occurred_at: booking.created_at,
      source_event_id: booking.id,
      idempotency_key: `booking:${booking.id}:started`,
      source_route: '/api/create-checkout',
      authoritative_source: 'supabase.bookings.insert_and_stripe.checkout_session.create',
      entity_type: 'booking',
      entity_id: booking.id,
      refs: {
        booking_id: booking.id,
        lead_id: effectiveLeadId,
        customer_id: customerRecord.id,
        waiver_session_id: state.waiver_session_id,
        stripe_session_id: session.id,
      },
      data: checkoutAttributes,
    });

    await sendSenzaiEvent({
      event_name: 'booking.created',
      occurred_at: booking.created_at,
      source_event_id: booking.id,
      idempotency_key: `booking:${booking.id}:created`,
      source_route: '/api/create-checkout',
      authoritative_source: 'supabase.bookings.insert',
      entity_type: 'booking',
      entity_id: booking.id,
      refs: {
        booking_id: booking.id,
        lead_id: effectiveLeadId,
        customer_id: customerRecord.id,
        waiver_session_id: state.waiver_session_id,
        stripe_session_id: session.id,
      },
      data: checkoutAttributes,
    });

    await recordFinancialEvent({
      event_name: 'booking.created',
      event_category: 'booking',
      severity: 'info',
      entity_type: 'booking',
      entity_id: booking.id,
      booking_id: booking.id,
      lead_id: effectiveLeadId,
      stripe_session_id: session.id,
      amount: priceBreakdown.total,
      currency: 'usd',
      status: 'pending',
      message: `Booking created for ${state.customer.email}`,
      metadata: checkoutAttributes,
      occurred_at: booking.created_at,
    });

    await sendSenzaiEvent({
      event_name: 'payment.requested',
      occurred_at: new Date().toISOString(),
      source_event_id: session.id,
      idempotency_key: `stripe_session:${session.id}:payment.requested`,
      source_route: '/api/create-checkout',
      authoritative_source: 'stripe.checkout_session.create',
      entity_type: 'payment_request',
      entity_id: session.id,
      refs: {
        booking_id: booking.id,
        lead_id: effectiveLeadId,
        customer_id: customerRecord.id,
        waiver_session_id: state.waiver_session_id,
        stripe_session_id: session.id,
      },
      data: {
        ...checkoutAttributes,
        charge_type: 'deposit',
        payment_provider: 'stripe',
        checkout_url_present: Boolean(session.url),
      },
    });

    await recordFinancialEvent({
      event_name: 'payment.deposit_requested',
      event_category: 'payment',
      severity: 'info',
      entity_type: 'stripe_checkout_session',
      entity_id: session.id,
      booking_id: booking.id,
      lead_id: effectiveLeadId,
      stripe_session_id: session.id,
      amount: depositAmount,
      currency: 'usd',
      status: 'requested',
      message: 'Deposit checkout session created',
      metadata: {
        booking_id: booking.id,
        customer_email: state.customer.email,
        total_amount: priceBreakdown.total,
        deposit_amount: depositAmount,
        remaining_balance_amount: remainingBalanceAmount,
        remaining_balance_due_at: remainingBalanceDueAt,
        live_test_mode: liveTestMode,
      },
    });

    return NextResponse.json({
      checkout_url: session.url,
      session_id: session.id,
    });
  } catch (error) {
    console.error('[checkout] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

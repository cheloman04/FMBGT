import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent, stripe } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createCalBooking } from '@/lib/cal';
import { addHoursToIso, easternLocalToUtcIso } from '@/lib/booking-datetime';
import { formatSkillLevel } from '@/lib/booking-email';
import { cancelActiveFollowUpForConversion } from '@/lib/lead-followup';
import { getBookingLocationMeta } from '@/lib/location-meta';
import { confirmLeadSessionAbandoned, markLeadSessionConverted } from '@/lib/lead-sessions';
import { getAppUrl } from '@/lib/app-url';
import { sendSenzaiEvent } from '@/lib/senzai-ingest';
import { recordFinancialEvent } from '@/lib/financial-log';
import { notifySupportAlert, triggerN8nEvent, type N8nWebhookResult } from '@/lib/n8n';
import { buildMetaUserData, sendMetaEvent } from '@/lib/meta-capi';

type WebhookAttemptResult = N8nWebhookResult;

const REMAINING_BALANCE_WEBHOOK_URL =
  'https://fmbgt-n8n.yvjziu.easypanel.host/webhook/remaining-balance';

type RemainingBalanceBookingDetails = {
  id: string;
  lead_id: string | null;
  date: string | null;
  time_slot: string | null;
  duration_hours: number | null;
  participant_count: number | null;
  participant_info: unknown;
  trail_type: string | null;
  skill_level: string | null;
  remaining_balance_amount: number | null;
  remaining_balance_due_at: string | null;
  attribution_snapshot: Record<string, unknown> | null;
  customers?: {
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  locations?: {
    name: string | null;
  } | null;
};

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  let event;
  try {
    event = constructWebhookEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log(`[stripe-webhook] ${event.type} | id=${event.id} | ts=${new Date(event.created * 1000).toISOString()}`);

  const supabase = getSupabaseAdmin();

  try {
    switch (event.type) {

      // ── Deposit paid via Checkout ───────────────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object;
        const bookingId = session.metadata?.booking_id;

        if (!bookingId) {
          console.warn('[stripe-webhook] checkout.session.completed missing booking_id');
          break;
        }

        // Only process sessions where Stripe actually collected payment
        if (session.payment_status !== 'paid') {
          console.warn(`[stripe-webhook] checkout.session.completed payment_status=${session.payment_status} for booking ${bookingId} — skipping`);
          break;
        }

        // Require a PaymentIntent — no PI means no charge was captured
        if (!session.payment_intent) {
          console.warn(`[stripe-webhook] checkout.session.completed missing payment_intent for booking ${bookingId} — skipping`);
          break;
        }

        // Idempotency: skip if deposit already marked paid
        const { data: existing } = await supabase
          .from('bookings')
          .select('status, deposit_payment_status')
          .eq('id', bookingId)
          .single();

        if (!existing) {
          await recordFinancialEvent({
            event_name: 'reconciliation.booking_missing_for_deposit',
            event_category: 'reconciliation',
            severity: 'critical',
            entity_type: 'booking',
            entity_id: bookingId,
            booking_id: bookingId,
            stripe_session_id: session.id,
            payment_intent_id: (session.payment_intent as string | null) ?? null,
            requires_attention: true,
            status: 'missing',
            message: 'Stripe deposit completed but booking row was missing in Supabase',
            metadata: {
              stripe_event_id: event.id,
              customer_email: session.customer_email ?? session.metadata?.customer_email ?? null,
              date: session.metadata?.date ?? null,
              live_test_mode: session.metadata?.live_test_mode ?? null,
            },
            occurred_at: new Date(event.created * 1000).toISOString(),
          });

          await notifySupportAlert({
            source: '/api/webhooks/stripe',
            severity: 'critical',
            summary: `Stripe deposit completed for missing booking ${bookingId}`,
            bookingId,
            stripeSessionId: session.id,
            paymentIntentId: (session.payment_intent as string | null) ?? null,
            details: {
              stripe_event_id: event.id,
              customer_email: session.customer_email ?? session.metadata?.customer_email ?? null,
              date: session.metadata?.date ?? null,
            },
          });
          break;
        }

        if ((existing as { deposit_payment_status?: string } | null)?.deposit_payment_status === 'paid') {
          console.log(`[stripe-webhook] Booking ${bookingId} deposit already recorded — skipping`);
          break;
        }

        // Retrieve the PaymentIntent to get the saved payment method ID
        const paymentIntentId = session.payment_intent as string | null;
        let stripePaymentMethodId: string | null = null;
        let stripeCustomerId: string | null = session.customer as string | null;

        if (paymentIntentId) {
          try {
            const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
              expand: ['payment_method', 'latest_charge'],
            });
            const pm = pi.payment_method;
            stripePaymentMethodId = pm
              ? typeof pm === 'string' ? pm : pm.id
              : null;
            if (!stripeCustomerId && pi.customer) {
              stripeCustomerId = typeof pi.customer === 'string' ? pi.customer : pi.customer.id;
            }
          } catch (err) {
            console.error('[stripe-webhook] Failed to retrieve PaymentIntent:', err);
          }
        }

        // Update booking: confirmed, deposit paid, save PM for future charge
        const confirmedDepositCents = session.amount_total ?? 0;
        const { error: updateError } = await supabase
          .from('bookings')
          .update({
            status: 'confirmed',
            deposit_payment_status: 'paid',
            deposit_paid_cents: confirmedDepositCents,
            remaining_balance_status: 'pending',
            stripe_payment_intent_id: paymentIntentId,
            deposit_payment_intent_id: paymentIntentId,
            stripe_payment_method_id: stripePaymentMethodId,
            stripe_customer_id: stripeCustomerId,
          })
          .eq('id', bookingId);

        if (updateError) {
          console.error(`[stripe-webhook] Failed to confirm booking ${bookingId}:`, updateError);
          throw updateError;
        }

        // Override zip_code with Stripe billing postal code if available
        const stripePostalCode = (session as { customer_details?: { address?: { postal_code?: string } } })
          .customer_details?.address?.postal_code;
        if (stripePostalCode) {
          await supabase
            .from('bookings')
            .update({ zip_code: stripePostalCode })
            .eq('id', bookingId);
        }

        // Convert lead → booking (if a lead was linked at checkout time)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: bookingLeadRow } = await (supabase as any)
          .from('bookings')
          .select('lead_id, booking_session_id, attribution_snapshot')
          .eq('id', bookingId)
          .single();

        const leadId = (bookingLeadRow as { lead_id?: string } | null)?.lead_id;
        const bookingSessionId = (bookingLeadRow as { booking_session_id?: string } | null)?.booking_session_id;
        const attributionSnapshot =
          ((bookingLeadRow as { attribution_snapshot?: Record<string, unknown> | null } | null)
            ?.attribution_snapshot) ?? null;
        if (leadId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: leadConvertErr } = await (supabase as any)
            .from('leads')
            .update({
              status: 'converted',
              booking_id: bookingId,
              converted_at: new Date().toISOString(),
              last_step_completed: 'booking_confirmed',
              last_activity_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', leadId);

          if (leadConvertErr) {
            console.error(`[stripe-webhook] Failed to convert lead ${leadId}:`, leadConvertErr);
          } else {
            console.log(`[stripe-webhook] Lead ${leadId} converted → booking ${bookingId}`);
          }
        }

        if (leadId) {
          await cancelActiveFollowUpForConversion(leadId);
        }

        if (bookingSessionId) {
          await markLeadSessionConverted(bookingSessionId);
        }

        // Fetch full booking for Cal.com + n8n
        const { data: confirmedBooking } = await supabase
          .from('bookings')
          .select('date, time_slot, duration_hours, participant_count, participant_info, trail_type, skill_level, deposit_amount, remaining_balance_amount, remaining_balance_due_at')
          .eq('id', bookingId)
          .single();

        // Cal.com booking
        if (confirmedBooking?.date && confirmedBooking?.time_slot && confirmedBooking?.duration_hours) {
          // Build start in UTC using DST-aware Eastern time conversion.
          // Hardcoding -05:00 (EST) is wrong for March–November when Florida
          // observes EDT (UTC-4). This caused off-by-one-hour bookings in Cal.com.
          const startIso = easternLocalToUtcIso(confirmedBooking.date, confirmedBooking.time_slot);
          const endIso = addHoursToIso(startIso, confirmedBooking.duration_hours);

          // session.customer_email can be null when using a saved Stripe customer.
          // Fall back to the email we stored in session metadata.
          const calEmail = session.customer_email ?? session.metadata?.customer_email ?? '';
          console.log(`[stripe-webhook] Cal.com booking payload: start=${startIso} end=${endIso} name="${session.metadata?.customer_name}" email="${calEmail}"`);

          const calUid = await createCalBooking({
            startIso,
            endIso,
            name: session.metadata?.customer_name ?? '',
            email: calEmail,
            timeZone: 'America/New_York',
            notes: `Florida MTB Tour — ${session.metadata?.location ?? ''} — ${session.metadata?.date ?? ''}`,
            trailType: confirmedBooking?.trail_type ?? null,
            locationName: session.metadata?.location ?? null,
          });

          await supabase
            .from('bookings')
            .update(calUid
              ? { cal_booking_uid: calUid, cal_booking_status: 'created' }
              : { cal_booking_status: 'failed' }
            )
            .eq('id', bookingId);

          if (!calUid) {
            console.error(`[stripe-webhook] Cal.com booking FAILED for booking ${bookingId} — guide has no calendar event`);
          }
        }

        // Link waiver records
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: bookingWaiver } = await (supabase as any)
          .from('bookings')
          .select('waiver_session_id')
          .eq('id', bookingId)
          .single();

        if (bookingWaiver?.waiver_session_id) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: waiverLinkErr } = await (supabase as any)
            .from('waiver_records')
            .update({ booking_id: bookingId })
            .eq('session_id', bookingWaiver.waiver_session_id)
            .is('booking_id', null);

          if (waiverLinkErr) {
            console.error(`[stripe-webhook] Failed to link waivers for booking ${bookingId}:`, waiverLinkErr);
          } else {
            console.log(`[stripe-webhook] Waiver records linked to booking ${bookingId}`);
          }
        }

        // n8n webhook — deposit confirmed
        const depositCents = Number(session.metadata?.deposit_amount ?? 0);
        const remainingCents = Number(session.metadata?.remaining_balance ?? 0);
        const dueDateIso = (confirmedBooking as { remaining_balance_due_at?: string } | null)?.remaining_balance_due_at ?? null;

        const customerEmail = session.customer_email ?? session.metadata?.customer_email ?? null;
        const locationName = session.metadata?.location ?? 'Florida Mountain Bike Guides';
        const locationMeta = getBookingLocationMeta(locationName);
        const bookingStartIso = confirmedBooking?.date && confirmedBooking?.time_slot
          ? easternLocalToUtcIso(confirmedBooking.date, confirmedBooking.time_slot)
          : null;
        const bookingEndIso = bookingStartIso && confirmedBooking?.duration_hours
          ? addHoursToIso(bookingStartIso, confirmedBooking.duration_hours)
          : null;
        const appUrl = getAppUrl();
        const calendarUrl = `${appUrl}/api/calendar/${bookingId}`;

        const n8nResult = await triggerN8nWebhook('booking_confirmed', {
          booking_id: bookingId,
          session_id: session.id,
          customer_email: customerEmail,
          customer_name: session.metadata?.customer_name,
          customer_phone: session.metadata?.customer_phone,
          zip_code: stripePostalCode || session.metadata?.zip_code,
          marketing_source: session.metadata?.marketing_source,
          deposit_amount: depositCents,
          remaining_balance: remainingCents,
          remaining_balance_due_at: dueDateIso,
          total_amount: Number(session.metadata?.total_amount ?? 0),
          location: locationName,
          date: session.metadata?.date,
          time: session.metadata?.time,
          duration_hours: confirmedBooking?.duration_hours,
          participant_count: confirmedBooking?.participant_count,
          participant_info: confirmedBooking?.participant_info,
          trail_type: confirmedBooking?.trail_type,
          skill_level: formatSkillLevel(confirmedBooking?.skill_level),
          meeting_location_name: locationMeta.meetingPointName,
          meeting_location_address: locationMeta.meetingPointAddress,
          meeting_location_url: locationMeta.meetingPointUrl,
          booking_start_iso: bookingStartIso,
          booking_end_iso: bookingEndIso,
          calendar_url: calendarUrl,
        });

        await recordBookingWebhookAttempt(supabase, bookingId, n8nResult);
        if (!n8nResult.ok) {
          await notifySupportAlert({
            source: '/api/webhooks/stripe',
            severity: 'error',
            summary: `booking_confirmed webhook failed for booking ${bookingId}`,
            bookingId,
            stripeSessionId: session.id,
            paymentIntentId: paymentIntentId ?? null,
            details: {
              webhook_status_code: n8nResult.statusCode,
              webhook_error: n8nResult.error,
            },
          });
        }

        const occurredAt = new Date(event.created * 1000).toISOString();
        const metaEventSourceUrl = getStringAttributionValue(
          attributionSnapshot,
          'meta_event_source_url'
        );
        const metaUserData = buildMetaUserData({
          email: customerEmail,
          phone: session.metadata?.customer_phone ?? null,
          fullName: session.metadata?.customer_name ?? null,
          clientIpAddress: getStringAttributionValue(
            attributionSnapshot,
            'meta_client_ip_address'
          ),
          clientUserAgent: getStringAttributionValue(
            attributionSnapshot,
            'meta_client_user_agent'
          ),
          fbc: getStringAttributionValue(attributionSnapshot, 'meta_fbc'),
          fbp: getStringAttributionValue(attributionSnapshot, 'meta_fbp'),
          externalId: leadId ?? bookingId,
        });
        const purchaseAmountDollars = Number(
          (((session.amount_total ?? depositCents) || 0) / 100).toFixed(2)
        );

        // Use Stripe's payment identifier as event_id so webhook retries and any
        // browser/server Purchase dedupe converge on the same completed payment.
        const metaEventId = paymentIntentId ?? event.id;

        await sendMetaEvent({
          data: [
            {
              event_name: 'Purchase',
              event_time: Math.floor(new Date(occurredAt).getTime() / 1000),
              event_id: metaEventId,
              action_source: 'website',
              ...(metaEventSourceUrl ? { event_source_url: metaEventSourceUrl } : {}),
              ...(Object.keys(metaUserData).length > 0 ? { user_data: metaUserData } : {}),
              custom_data: {
                currency: 'USD',
                value: purchaseAmountDollars,
                booking_id: bookingId,
                stripe_session_id: session.id,
              },
            },
          ],
        });

        await sendSenzaiEvent({
          event_name: 'payment.succeeded',
          occurred_at: occurredAt,
          source_event_id: paymentIntentId ?? event.id,
          idempotency_key: `stripe_event:${event.id}:payment.succeeded`,
          source_route: '/api/webhooks/stripe',
          authoritative_source: 'stripe.checkout.session.completed',
          entity_type: 'payment',
          entity_id: paymentIntentId ?? event.id,
          refs: {
            booking_id: bookingId,
            lead_id: leadId ?? null,
            stripe_event_id: event.id,
            stripe_session_id: session.id,
            payment_intent_id: paymentIntentId,
          },
          data: {
            booking_id: bookingId,
            stripe_event_id: event.id,
            stripe_session_id: session.id,
            payment_intent_id: paymentIntentId,
            charge_type: 'deposit',
            amount: depositCents,
            customer_email: customerEmail,
            customer_name: session.metadata?.customer_name ?? null,
            location_name: locationName,
            date: session.metadata?.date ?? null,
            time: session.metadata?.time ?? null,
          },
        });

        await sendSenzaiEvent({
          event_name: 'booking.confirmed',
          occurred_at: occurredAt,
          source_event_id: bookingId,
          idempotency_key: `booking:${bookingId}:confirmed`,
          source_route: '/api/webhooks/stripe',
          authoritative_source: 'stripe.checkout.session.completed',
          entity_type: 'booking',
          entity_id: bookingId,
          refs: {
            booking_id: bookingId,
            lead_id: leadId ?? null,
            waiver_session_id: bookingWaiver?.waiver_session_id ?? null,
            stripe_event_id: event.id,
            stripe_session_id: session.id,
            payment_intent_id: paymentIntentId,
          },
          data: {
            booking_id: bookingId,
            stripe_event_id: event.id,
            stripe_session_id: session.id,
            payment_intent_id: paymentIntentId,
            deposit_amount: depositCents,
            remaining_balance_amount: remainingCents,
            remaining_balance_due_at: dueDateIso,
            customer_email: customerEmail,
            customer_name: session.metadata?.customer_name ?? null,
            customer_phone: session.metadata?.customer_phone ?? null,
            zip_code: stripePostalCode || session.metadata?.zip_code || null,
            location_name: locationName,
            date: session.metadata?.date ?? null,
            time: session.metadata?.time ?? null,
            duration_hours: confirmedBooking?.duration_hours ?? null,
            participant_count: confirmedBooking?.participant_count ?? null,
            trail_type: confirmedBooking?.trail_type ?? null,
            skill_level: confirmedBooking?.skill_level ?? null,
          },
        });

        console.log(`[stripe-webhook] Booking ${bookingId} confirmed — deposit paid, PM saved: ${stripePaymentMethodId ?? 'none'}`);
        break;
      }

      // ── Remaining balance paid (off-session PI succeeded) ───────────────────
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        // Only handle remaining-balance charges (deposit PIs are covered by checkout.session.completed)
        if (pi.metadata?.charge_type !== 'remaining_balance') break;

        const bookingId = pi.metadata?.booking_id;
        if (!bookingId) {
          console.warn('[stripe-webhook] payment_intent.succeeded missing booking_id');
          break;
        }

        const { data: existingBooking } = await supabase
          .from('bookings')
          .select(`
            id,
            lead_id,
            date,
            time_slot,
            duration_hours,
            participant_count,
            participant_info,
            trail_type,
            skill_level,
            remaining_balance_amount,
            remaining_balance_due_at,
            attribution_snapshot,
            customers(name, email, phone),
            locations(name)
          `)
          .eq('id', bookingId)
          .maybeSingle<RemainingBalanceBookingDetails>();

        if (!existingBooking) {
          await recordFinancialEvent({
            event_name: 'reconciliation.booking_missing_for_remaining_balance_success',
            event_category: 'reconciliation',
            severity: 'critical',
            entity_type: 'booking',
            entity_id: bookingId,
            booking_id: bookingId,
            payment_intent_id: pi.id,
            amount: pi.amount,
            currency: pi.currency,
            status: 'missing',
            requires_attention: true,
            message: 'Remaining balance payment succeeded in Stripe but booking row was missing in Supabase',
            metadata: {
              stripe_event_id: event.id,
            },
            occurred_at: new Date(event.created * 1000).toISOString(),
          });

          await notifySupportAlert({
            source: '/api/webhooks/stripe',
            severity: 'critical',
            summary: `Remaining balance payment succeeded for missing booking ${bookingId}`,
            bookingId,
            paymentIntentId: pi.id,
            details: {
              stripe_event_id: event.id,
              amount: pi.amount,
              currency: pi.currency,
            },
          });
          break;
        }

        const { error: updateError } = await supabase
          .from('bookings')
          .update({
            remaining_balance_status: 'paid',
            remaining_balance_payment_intent_id: pi.id,
          })
          .eq('id', bookingId);

        if (updateError) {
          console.error(`[stripe-webhook] Failed to update remaining balance for booking ${bookingId}:`, updateError);
          throw updateError;
        }

        // n8n webhook — final balance charged
        const remainingBalanceLocationName = existingBooking.locations?.name ?? 'Florida Mountain Bike Guides';
        const remainingBalanceLocationMeta = getBookingLocationMeta(remainingBalanceLocationName);
        const remainingBalanceStartIso = existingBooking.date && existingBooking.time_slot
          ? easternLocalToUtcIso(existingBooking.date, existingBooking.time_slot)
          : null;
        const remainingBalanceEndIso = remainingBalanceStartIso && existingBooking.duration_hours
          ? addHoursToIso(remainingBalanceStartIso, existingBooking.duration_hours)
          : null;
        const remainingBalanceCalendarUrl = `${getAppUrl()}/api/calendar/${bookingId}`;

        await triggerN8nWebhook(
          'remaining_balance_paid',
          {
            booking_id: bookingId,
            payment_intent_id: pi.id,
            amount: pi.amount,
            currency: pi.currency,
            customer_email: existingBooking.customers?.email ?? null,
            customer_name: existingBooking.customers?.name ?? null,
            customer_phone: existingBooking.customers?.phone ?? null,
            remaining_balance_amount: existingBooking.remaining_balance_amount ?? pi.amount,
            remaining_balance_due_at: existingBooking.remaining_balance_due_at,
            location: remainingBalanceLocationName,
            date: existingBooking.date,
            time: existingBooking.time_slot,
            duration_hours: existingBooking.duration_hours,
            participant_count: existingBooking.participant_count,
            participant_info: existingBooking.participant_info,
            trail_type: existingBooking.trail_type,
            skill_level: formatSkillLevel(existingBooking.skill_level),
            meeting_location_name: remainingBalanceLocationMeta.meetingPointName,
            meeting_location_address: remainingBalanceLocationMeta.meetingPointAddress,
            meeting_location_url: remainingBalanceLocationMeta.meetingPointUrl,
            booking_start_iso: remainingBalanceStartIso,
            booking_end_iso: remainingBalanceEndIso,
            calendar_url: remainingBalanceCalendarUrl,
          },
          {
            webhookUrl: process.env.N8N_REMAINING_BALANCE_WEBHOOK_URL || REMAINING_BALANCE_WEBHOOK_URL,
          }
        );

        await sendSenzaiEvent({
          event_name: 'payment.succeeded',
          occurred_at: new Date(event.created * 1000).toISOString(),
          source_event_id: pi.id,
          idempotency_key: `stripe_event:${event.id}:payment.succeeded`,
          source_route: '/api/webhooks/stripe',
          authoritative_source: 'stripe.payment_intent.succeeded',
          entity_type: 'payment',
          entity_id: pi.id,
          refs: {
            booking_id: bookingId,
            stripe_event_id: event.id,
            payment_intent_id: pi.id,
          },
          data: {
            booking_id: bookingId,
            stripe_event_id: event.id,
            payment_intent_id: pi.id,
            charge_type: 'remaining_balance',
            amount: pi.amount,
            currency: pi.currency,
          },
        });

        const remainingBalanceSuccessDedupeKey = `remaining_balance_succeeded:${bookingId}:${pi.id}`;
        const remainingMetaEventSourceUrl = getStringAttributionValue(
          existingBooking.attribution_snapshot,
          'meta_event_source_url'
        );
        const remainingMetaUserData = buildMetaUserData({
          email: existingBooking.customers?.email ?? null,
          phone: existingBooking.customers?.phone ?? null,
          fullName: existingBooking.customers?.name ?? null,
          clientIpAddress: getStringAttributionValue(
            existingBooking.attribution_snapshot,
            'meta_client_ip_address'
          ),
          clientUserAgent: getStringAttributionValue(
            existingBooking.attribution_snapshot,
            'meta_client_user_agent'
          ),
          fbc: getStringAttributionValue(existingBooking.attribution_snapshot, 'meta_fbc'),
          fbp: getStringAttributionValue(existingBooking.attribution_snapshot, 'meta_fbp'),
          externalId: existingBooking.lead_id ?? bookingId,
        });
        const remainingPurchaseAmountDollars = Number(
          (((pi.amount_received || pi.amount) || 0) / 100).toFixed(2)
        );

        // Use the succeeded PaymentIntent ID as event_id so each collected payment
        // has one stable Meta dedupe key even if Stripe replays the webhook.
        const metaEventId = pi.id;

        await sendMetaEvent({
          data: [
            {
              event_name: 'Purchase',
              event_time: Math.floor(new Date(event.created * 1000).getTime() / 1000),
              event_id: metaEventId,
              action_source: 'website',
              ...(remainingMetaEventSourceUrl
                ? { event_source_url: remainingMetaEventSourceUrl }
                : {}),
              ...(Object.keys(remainingMetaUserData).length > 0
                ? { user_data: remainingMetaUserData }
                : {}),
              custom_data: {
                currency: 'USD',
                value: remainingPurchaseAmountDollars,
                booking_id: bookingId,
                payment_intent_id: pi.id,
              },
            },
          ],
        });

        await recordFinancialEvent({
          event_name: 'payment.remaining_balance_succeeded',
          event_category: 'payment',
          severity: 'info',
          entity_type: 'payment_intent',
          entity_id: pi.id,
          booking_id: bookingId,
          payment_intent_id: pi.id,
          amount: pi.amount,
          currency: pi.currency,
          status: 'paid',
          message: 'Remaining balance payment succeeded',
          dedupe_key: remainingBalanceSuccessDedupeKey,
          metadata: {
            stripe_event_id: event.id,
          },
          occurred_at: new Date(event.created * 1000).toISOString(),
        });

        console.log(`[stripe-webhook] Remaining balance paid for booking ${bookingId} — PI ${pi.id}`);
        break;
      }

      // ── Remaining balance charge failed ────────────────────────────────────
      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        if (pi.metadata?.charge_type !== 'remaining_balance') break;

        const bookingId = pi.metadata?.booking_id;
        if (!bookingId) break;

        const { data: existingBooking } = await supabase
          .from('bookings')
          .select('id')
          .eq('id', bookingId)
          .maybeSingle();

        if (!existingBooking) {
          await recordFinancialEvent({
            event_name: 'reconciliation.booking_missing_for_remaining_balance_failure',
            event_category: 'reconciliation',
            severity: 'critical',
            entity_type: 'booking',
            entity_id: bookingId,
            booking_id: bookingId,
            payment_intent_id: pi.id,
            amount: pi.amount,
            currency: pi.currency,
            status: 'missing',
            requires_attention: true,
            message: 'Remaining balance payment failed in Stripe but booking row was missing in Supabase',
            metadata: {
              stripe_event_id: event.id,
              error_message: pi.last_payment_error?.message ?? 'Unknown error',
            },
            occurred_at: new Date(event.created * 1000).toISOString(),
          });

          await notifySupportAlert({
            source: '/api/webhooks/stripe',
            severity: 'critical',
            summary: `Remaining balance failure reported for missing booking ${bookingId}`,
            bookingId,
            paymentIntentId: pi.id,
            details: {
              stripe_event_id: event.id,
              amount: pi.amount,
              currency: pi.currency,
              error_message: pi.last_payment_error?.message ?? 'Unknown error',
            },
          });
          break;
        }

        const { error: updateError } = await supabase
          .from('bookings')
          .update({
            remaining_balance_status: 'failed',
            remaining_balance_payment_intent_id: pi.id,
          })
          .eq('id', bookingId);

        if (updateError) {
          console.error(`[stripe-webhook] Failed to record balance failure for booking ${bookingId}:`, updateError);
        }

        // n8n webhook — final balance failed, needs admin attention
        await triggerN8nWebhook('remaining_balance_failed', {
          booking_id: bookingId,
          payment_intent_id: pi.id,
          error_message: pi.last_payment_error?.message ?? 'Unknown error',
        });

        await sendSenzaiEvent({
          event_name: 'payment.failed',
          occurred_at: new Date(event.created * 1000).toISOString(),
          source_event_id: pi.id,
          idempotency_key: `stripe_event:${event.id}:payment.failed`,
          source_route: '/api/webhooks/stripe',
          authoritative_source: 'stripe.payment_intent.payment_failed',
          entity_type: 'payment',
          entity_id: pi.id,
          refs: {
            booking_id: bookingId,
            stripe_event_id: event.id,
            payment_intent_id: pi.id,
          },
          data: {
            booking_id: bookingId,
            stripe_event_id: event.id,
            payment_intent_id: pi.id,
            charge_type: 'remaining_balance',
            amount: pi.amount,
            currency: pi.currency,
            error_message: pi.last_payment_error?.message ?? 'Unknown error',
          },
        });

        await recordFinancialEvent({
          event_name: 'payment.remaining_balance_failed',
          event_category: 'payment',
          severity: 'error',
          entity_type: 'payment_intent',
          entity_id: pi.id,
          booking_id: bookingId,
          payment_intent_id: pi.id,
          amount: pi.amount,
          currency: pi.currency,
          status: 'failed',
          requires_attention: true,
          message: pi.last_payment_error?.message ?? 'Unknown error',
          metadata: {
            stripe_event_id: event.id,
          },
          occurred_at: new Date(event.created * 1000).toISOString(),
        });

        await notifySupportAlert({
          source: '/api/webhooks/stripe',
          severity: 'error',
          summary: `Remaining balance failed for booking ${bookingId}`,
          bookingId,
          paymentIntentId: pi.id,
          details: {
            stripe_event_id: event.id,
            amount: pi.amount,
            currency: pi.currency,
            error_message: pi.last_payment_error?.message ?? 'Unknown error',
          },
        });

        console.log(`[stripe-webhook] Remaining balance FAILED for booking ${bookingId} — PI ${pi.id}`);
        break;
      }

      // ── Checkout session expired ───────────────────────────────────────────
      case 'checkout.session.expired': {
        const session = event.data.object;
        const bookingId = session.metadata?.booking_id;
        if (!bookingId) break;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: bookingLeadRow } = await (supabase as any)
          .from('bookings')
          .select('lead_id, booking_session_id')
          .eq('id', bookingId)
          .single();

        const expiredLeadId = (bookingLeadRow as { lead_id?: string } | null)?.lead_id;
        const expiredSessionId = (bookingLeadRow as { booking_session_id?: string } | null)?.booking_session_id;

        const { error: updateError } = await supabase
          .from('bookings')
          .update({
            status: 'cancelled',
            deposit_payment_status: 'cancelled',
            remaining_balance_status: 'cancelled',
          })
          .eq('id', bookingId)
          .eq('status', 'pending');

        if (updateError) {
          console.error(`[stripe-webhook] Failed to cancel booking ${bookingId}:`, updateError);
          throw updateError;
        }

        if (expiredLeadId && expiredSessionId) {
          await confirmLeadSessionAbandoned({
            leadId: expiredLeadId,
            sessionId: expiredSessionId,
            reason: 'checkout_expired',
            allowedStatuses: ['checkout_started'],
          });
        }

        // Update lead funnel stage so abandoned-at-payment is visible in admin
        if (expiredLeadId) {
          const now = new Date().toISOString();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('leads')
            .update({
              last_step_completed: 'checkout_abandoned',
              last_activity_at: now,
              updated_at: now,
            })
            .eq('id', expiredLeadId)
            .in('status', ['lead', 'lost']);
        }

        console.log(`[stripe-webhook] Booking ${bookingId} cancelled (session expired)`);
        break;
      }

      // ── Refund ────────────────────────────────────────────────────────────
      case 'charge.refunded': {
        const charge = event.data.object as { payment_intent?: string };
        const paymentIntentId = charge.payment_intent;
        if (!paymentIntentId) break;

        const { data: matchingRefundBookings, error: refundLookupErr } = await supabase
          .from('bookings')
          .select('id')
          .or(`stripe_payment_intent_id.eq.${paymentIntentId},remaining_balance_payment_intent_id.eq.${paymentIntentId}`);

        if (refundLookupErr) {
          console.error(`[stripe-webhook] Failed to look up refunded booking for PI ${paymentIntentId}:`, refundLookupErr);
        }

        const refundedBookingIds = (matchingRefundBookings ?? []).map((row) => row.id);
        const refundedBookingId = refundedBookingIds.length === 1 ? refundedBookingIds[0] : null;

        // Match on either deposit or remaining balance PI
        const { error: depositRefundErr } = await supabase
          .from('bookings')
          .update({ status: 'refunded' })
          .or(`stripe_payment_intent_id.eq.${paymentIntentId},remaining_balance_payment_intent_id.eq.${paymentIntentId}`);

        if (depositRefundErr) {
          console.error(`[stripe-webhook] Failed to mark refund for PI ${paymentIntentId}:`, depositRefundErr);
          throw depositRefundErr;
        }

        await sendSenzaiEvent({
          event_name: 'refund.processed',
          occurred_at: new Date(event.created * 1000).toISOString(),
          source_event_id: paymentIntentId,
          idempotency_key: `stripe_event:${event.id}:refund.processed`,
          source_route: '/api/webhooks/stripe',
          authoritative_source: 'stripe.charge.refunded',
          entity_type: 'refund',
          entity_id: paymentIntentId,
          refs: {
            booking_id: refundedBookingId,
            stripe_event_id: event.id,
            payment_intent_id: paymentIntentId,
          },
          data: {
            booking_id: refundedBookingId,
            booking_ids: refundedBookingIds,
            booking_match_count: refundedBookingIds.length,
            stripe_event_id: event.id,
            payment_intent_id: paymentIntentId,
            charge_type: 'refund',
          },
        });

        console.log(`[stripe-webhook] Booking refunded — PI ${paymentIntentId}`);
        break;
      }

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[stripe-webhook] Processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

function trimWebhookError(message: string): string {
  return message.replace(/\s+/g, ' ').trim().slice(0, 300);
}

function getStringAttributionValue(
  snapshot: Record<string, unknown> | null | undefined,
  key: string
): string | null {
  const value = snapshot?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function recordBookingWebhookAttempt(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  bookingId: string,
  result: WebhookAttemptResult
) {
  const { error } = await supabase
    .from('bookings')
    .update({
      webhook_sent: result.ok,
      webhook_last_attempt_at: result.attemptedAt,
      webhook_last_status_code: result.statusCode,
      webhook_last_error: result.ok ? null : result.error,
    })
    .eq('id', bookingId);

  if (error) {
    console.error(`[stripe-webhook] Failed to persist webhook status for booking ${bookingId}:`, error);
  }
}

async function triggerN8nWebhook(
  event: string,
  data: Record<string, unknown>,
  options?: {
    envKeys?: string[];
    webhookUrl?: string | null;
  }
): Promise<WebhookAttemptResult> {
  const result = await triggerN8nEvent({
    event,
    data,
    source: '/api/webhooks/stripe',
    envKeys: options?.envKeys ?? ['N8N_WEBHOOK_URL'],
    webhookUrl: options?.webhookUrl,
  });

  if (!result.ok) {
    console.error(`[stripe-webhook] ${result.error}`);
  } else {
    console.log(`[stripe-webhook] n8n notified: ${event}`);
  }

  return {
    ...result,
    error: result.error ? trimWebhookError(result.error) : null,
  };
}

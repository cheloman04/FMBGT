import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent, stripe } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createCalBooking } from '@/lib/cal';
import { addHoursToIso, easternLocalToUtcIso } from '@/lib/booking-datetime';
import { formatSkillLevel } from '@/lib/booking-email';
import { getBookingLocationMeta } from '@/lib/location-meta';

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

        // Idempotency: skip if deposit already marked paid
        const { data: existing } = await supabase
          .from('bookings')
          .select('status, deposit_payment_status')
          .eq('id', bookingId)
          .single();

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
              expand: ['payment_method'],
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
        const { error: updateError } = await supabase
          .from('bookings')
          .update({
            status: 'confirmed',
            deposit_payment_status: 'paid',
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
          .select('lead_id')
          .eq('id', bookingId)
          .single();

        const leadId = (bookingLeadRow as { lead_id?: string } | null)?.lead_id;
        if (leadId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: leadConvertErr } = await (supabase as any)
            .from('leads')
            .update({
              status: 'converted',
              booking_id: bookingId,
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
          });

          if (calUid) {
            await supabase
              .from('bookings')
              .update({ cal_booking_uid: calUid })
              .eq('id', bookingId);
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
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
        const calendarUrl = `${appUrl}/api/calendar/${bookingId}`;

        const n8nSent = await triggerN8nWebhook('booking_confirmed', {
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

        if (n8nSent) {
          await supabase
            .from('bookings')
            .update({ webhook_sent: true })
            .eq('id', bookingId);
        }

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
        await triggerN8nWebhook('remaining_balance_paid', {
          booking_id: bookingId,
          payment_intent_id: pi.id,
          amount: pi.amount,
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

        console.log(`[stripe-webhook] Remaining balance FAILED for booking ${bookingId} — PI ${pi.id}`);
        break;
      }

      // ── Checkout session expired ───────────────────────────────────────────
      case 'checkout.session.expired': {
        const session = event.data.object;
        const bookingId = session.metadata?.booking_id;
        if (!bookingId) break;

        const { error: updateError } = await supabase
          .from('bookings')
          .update({ status: 'cancelled' })
          .eq('id', bookingId)
          .eq('status', 'pending');

        if (updateError) {
          console.error(`[stripe-webhook] Failed to cancel booking ${bookingId}:`, updateError);
          throw updateError;
        }

        console.log(`[stripe-webhook] Booking ${bookingId} cancelled (session expired)`);
        break;
      }

      // ── Refund ────────────────────────────────────────────────────────────
      case 'charge.refunded': {
        const charge = event.data.object as { payment_intent?: string };
        const paymentIntentId = charge.payment_intent;
        if (!paymentIntentId) break;

        // Match on either deposit or remaining balance PI
        const { error: depositRefundErr } = await supabase
          .from('bookings')
          .update({ status: 'refunded' })
          .eq('stripe_payment_intent_id', paymentIntentId);

        if (depositRefundErr) {
          console.error(`[stripe-webhook] Failed to mark refund for PI ${paymentIntentId}:`, depositRefundErr);
          throw depositRefundErr;
        }

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

async function triggerN8nWebhook(event: string, data: Record<string, unknown>): Promise<boolean> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl || webhookUrl === 'your_n8n_webhook_url_here') {
    console.warn('[stripe-webhook] N8N_WEBHOOK_URL not configured, skipping');
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, data, timestamp: new Date().toISOString() }),
    });

    if (!response.ok) {
      console.error(`[stripe-webhook] n8n webhook returned ${response.status}`);
      return false;
    }

    console.log(`[stripe-webhook] n8n notified: ${event}`);
    return true;
  } catch (error) {
    console.error('[stripe-webhook] n8n webhook failed:', error);
    return false;
  }
}

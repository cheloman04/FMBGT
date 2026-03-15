import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createCalBooking } from '@/lib/cal';

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
      case 'checkout.session.completed': {
        const session = event.data.object;
        const bookingId = session.metadata?.booking_id;

        if (!bookingId) {
          console.warn('[stripe-webhook] checkout.session.completed missing booking_id in metadata');
          break;
        }

        // Idempotency: skip if already confirmed
        const { data: existing } = await supabase
          .from('bookings')
          .select('status')
          .eq('id', bookingId)
          .single();

        if (existing?.status === 'confirmed') {
          console.log(`[stripe-webhook] Booking ${bookingId} already confirmed — skipping`);
          break;
        }

        const { error: updateError } = await supabase
          .from('bookings')
          .update({
            status: 'confirmed',
            stripe_payment_intent_id: session.payment_intent as string,
          })
          .eq('id', bookingId);

        if (updateError) {
          console.error(`[stripe-webhook] Failed to confirm booking ${bookingId}:`, updateError);
          throw updateError;
        }

        // Override zip_code with Stripe billing postal code if available (more verified)
        const stripePostalCode = (session as { customer_details?: { address?: { postal_code?: string } } })
          .customer_details?.address?.postal_code;
        if (stripePostalCode) {
          await supabase
            .from('bookings')
            .update({ zip_code: stripePostalCode })
            .eq('id', bookingId);
        }

        // Fetch full booking for Cal.com + enriched n8n payload
        const { data: confirmedBooking } = await supabase
          .from('bookings')
          .select('date, time_slot, duration_hours, participant_count, participant_info, trail_type')
          .eq('id', bookingId)
          .single();

        // Create Cal.com booking (skips silently if CAL_API_KEY is not set)
        if (confirmedBooking?.date && confirmedBooking?.time_slot && confirmedBooking?.duration_hours) {
          const startIso = new Date(
            `${confirmedBooking.date}T${confirmedBooking.time_slot}:00-05:00`
          ).toISOString();
          const endIso = new Date(
            new Date(startIso).getTime() + confirmedBooking.duration_hours * 3600000
          ).toISOString();

          const calUid = await createCalBooking({
            startIso,
            endIso,
            name: session.metadata?.customer_name ?? '',
            email: session.customer_email ?? '',
            notes: `Florida MTB Tour — ${session.metadata?.location ?? ''} — ${session.metadata?.date ?? ''}`,
          });

          if (calUid) {
            await supabase
              .from('bookings')
              .update({ cal_booking_uid: calUid })
              .eq('id', bookingId);
          }
        }

        // Trigger n8n webhook for post-booking automations
        const n8nSent = await triggerN8nWebhook('booking_confirmed', {
          booking_id: bookingId,
          session_id: session.id,
          customer_email: session.customer_email,
          customer_name: session.metadata?.customer_name,
          customer_phone: session.metadata?.customer_phone,
          zip_code: stripePostalCode || session.metadata?.zip_code,
          marketing_source: session.metadata?.marketing_source,
          amount_total: session.amount_total,
          location: session.metadata?.location,
          date: session.metadata?.date,
          time: session.metadata?.time,
          duration_hours: confirmedBooking?.duration_hours,
          participant_count: confirmedBooking?.participant_count,
          participant_info: confirmedBooking?.participant_info,
          trail_type: confirmedBooking?.trail_type,
        });

        // Only mark webhook as sent if n8n actually received it
        if (n8nSent) {
          await supabase
            .from('bookings')
            .update({ webhook_sent: true })
            .eq('id', bookingId);
        }

        console.log(`[stripe-webhook] Booking ${bookingId} confirmed`);
        break;
      }

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

      case 'charge.refunded': {
        const charge = event.data.object as { payment_intent?: string };
        const paymentIntentId = charge.payment_intent;

        if (!paymentIntentId) break;

        const { error: updateError } = await supabase
          .from('bookings')
          .update({ status: 'refunded' })
          .eq('stripe_payment_intent_id', paymentIntentId);

        if (updateError) {
          console.error(`[stripe-webhook] Failed to mark refund for intent ${paymentIntentId}:`, updateError);
          throw updateError;
        }

        console.log(`[stripe-webhook] Booking refunded for payment_intent=${paymentIntentId}`);
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
    // Don't throw — n8n failures must not break the Stripe response
    return false;
  }
}

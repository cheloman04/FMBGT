import Stripe from 'stripe';
import type { BookingState } from '@/types/booking';
import { getPriceLineItems } from './pricing';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', {
  apiVersion: '2026-02-25.clover',
});

export interface CreateCheckoutSessionParams {
  bookingState: BookingState;
  priceBreakdown: PriceBreakdown;
  successUrl: string;
  cancelUrl: string;
  bookingId: string;
}

export async function createCheckoutSession({
  bookingState,
  priceBreakdown,
  successUrl,
  cancelUrl,
  bookingId,
}: CreateCheckoutSessionParams): Promise<Stripe.Checkout.Session> {
  const { bike_rental, duration_hours, addons, customer, location_name } = bookingState;

  if (!bike_rental || !duration_hours || !addons || !customer) {
    throw new Error('Incomplete booking state for checkout');
  }

  const lineItems = getPriceLineItems(bike_rental, duration_hours, addons, bookingState.trail_type, bookingState.additional_participants);

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: customer.email,
    line_items: lineItems.map((item) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.label,
          description: `Florida Mountain Bike Trail Guided Tours - ${location_name ?? ''}`,
        },
        unit_amount: item.amount,
      },
      quantity: 1,
    })),
    metadata: {
      booking_id: bookingId,
      customer_name: customer.name,
      customer_email: customer.email,
      customer_phone: customer.phone ?? '',
      location: location_name ?? '',
      date: bookingState.date ?? '',
      time: bookingState.time_slot ?? '',
      zip_code: customer.zip_code ?? '',
      marketing_source: customer.marketing_source ?? '',
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return session;
}

// Verify a Stripe webhook signature
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  secret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, secret);
}

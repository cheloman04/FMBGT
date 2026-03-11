import Stripe from 'stripe';
import type { BookingState, PriceBreakdown } from '@/types/booking';
import { getPriceLineItems, formatPrice } from './pricing';

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

  const lineItems = getPriceLineItems(bike_rental, duration_hours, addons);

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
      location: location_name ?? '',
      date: bookingState.date ?? '',
      time: bookingState.time_slot ?? '',
    },
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}&booking_id=${bookingId}`,
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

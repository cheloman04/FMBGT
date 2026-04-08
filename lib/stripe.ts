import Stripe from 'stripe';
import type { BookingState, PriceBreakdown } from '@/types/booking';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', {
  apiVersion: '2026-02-25.clover',
});

// ---------------------------------------------------------------------------
// Stripe Customer management
// ---------------------------------------------------------------------------

/** Create a new Stripe customer. */
export async function createStripeCustomer(
  name: string,
  email: string
): Promise<Stripe.Customer> {
  return stripe.customers.create({ name, email });
}

/** Retrieve an existing Stripe customer, returns null if deleted or not found. */
export async function getStripeCustomer(
  customerId: string
): Promise<Stripe.Customer | null> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if ((customer as Stripe.DeletedCustomer).deleted) return null;
    return customer as Stripe.Customer;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Checkout Session — 50% deposit + save card for future off-session charge
// ---------------------------------------------------------------------------

export interface CreateCheckoutSessionParams {
  bookingState: BookingState;
  priceBreakdown: PriceBreakdown;
  depositAmount: number;      // in cents — exactly Math.round(total / 2)
  remainingBalance: number;   // in cents — total - deposit
  successUrl: string;
  cancelUrl: string;
  bookingId: string;
  stripeCustomerId: string;   // must be created before calling this
}

export async function createCheckoutSession({
  bookingState,
  priceBreakdown,
  depositAmount,
  remainingBalance,
  successUrl,
  cancelUrl,
  bookingId,
  stripeCustomerId,
}: CreateCheckoutSessionParams): Promise<Stripe.Checkout.Session> {
  const { customer, location_name } = bookingState;

  if (!customer) throw new Error('Incomplete booking state for checkout');

  const fullTotal = priceBreakdown.total;
  const tourLabel = location_name ?? 'Florida MTB Guided Tour';
  const dateLabel = bookingState.date ?? '';

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer: stripeCustomerId,
    // save card so we can charge the remaining balance off-session
    payment_intent_data: {
      setup_future_usage: 'off_session',
      description: `50% deposit — ${tourLabel} ${dateLabel}`,
      metadata: {
        booking_id: bookingId,
        charge_type: 'deposit',
      },
    },
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `50% Deposit — ${tourLabel}`,
            description:
              `Tour on ${dateLabel}. ` +
              `Full price: ${formatCents(fullTotal)}. ` +
              `Remaining ${formatCents(remainingBalance)} will be charged automatically the day before your tour.`,
          },
          unit_amount: depositAmount,
        },
        quantity: 1,
      },
    ],
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
      total_amount: String(fullTotal),
      deposit_amount: String(depositAmount),
      remaining_balance: String(remainingBalance),
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    // surface remaining balance info on the Stripe-hosted page
    custom_text: {
      submit: {
        message: `By paying you authorize Florida Mountain Bike Guides to charge the remaining ${formatCents(remainingBalance)} to this card the day before your tour.`,
      },
    },
  });

  return session;
}

// ---------------------------------------------------------------------------
// Off-session charge — remaining balance (called by cron or admin retry)
// ---------------------------------------------------------------------------

export interface ChargeRemainingBalanceParams {
  bookingId: string;
  stripeCustomerId: string;
  stripePaymentMethodId: string;
  amount: number;       // remaining balance in cents
  description: string;
}

export interface ChargeResult {
  success: boolean;
  paymentIntentId?: string;
  errorMessage?: string;
}

export async function chargeRemainingBalance(
  params: ChargeRemainingBalanceParams
): Promise<ChargeResult> {
  try {
    const pi = await stripe.paymentIntents.create({
      amount: params.amount,
      currency: 'usd',
      customer: params.stripeCustomerId,
      payment_method: params.stripePaymentMethodId,
      confirm: true,
      off_session: true,
      description: params.description,
      metadata: {
        booking_id: params.bookingId,
        charge_type: 'remaining_balance',
      },
    });

    if (pi.status === 'succeeded') {
      return { success: true, paymentIntentId: pi.id };
    }
    return {
      success: false,
      paymentIntentId: pi.id,
      errorMessage: `Payment intent ended with status: ${pi.status}`,
    };
  } catch (err) {
    const stripeErr = err as Stripe.StripeRawError;
    return {
      success: false,
      errorMessage: stripeErr.message ?? 'Unknown Stripe error',
    };
  }
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  secret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, secret);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    cents / 100
  );
}

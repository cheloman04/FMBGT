# Analytics and Client-Hub Delivery Audit

Audit date: 2026-07-13

## Authoritative flow

| Event | Browser | Backend / database | GA4 | Meta CAPI | Senzai Hub |
| --- | --- | --- | --- | --- | --- |
| CTA | `cta_clicked` once per click | None | Browser `gtag` | None | None |
| Form / booking start | `booking_started`, `booking_step_view` | Lead/session rows begin when identity is submitted | Browser `gtag` | `Lead` is queued after the lead row exists | `lead.created` is queued after the lead row exists |
| Form submit / checkout start | `contact_form_submit` or `checkout_started` | Lead or booking + Stripe Checkout Session persisted | Browser `gtag` | `InitiateCheckout` queued using Stripe Session ID | `booking.started`, `booking.created`, `payment.deposit_requested` queued |
| Deposit paid | Browser confirmation emits only `booking_completed` (no revenue) | Stripe `checkout.session.completed` updates booking payment state | Server outbox `purchase`; transaction ID = deposit PaymentIntent; value = amount collected | Server outbox `Purchase`; event ID = deposit PaymentIntent; value = amount collected | `payment.deposit_succeeded`; source ID = deposit PaymentIntent; root `amount` = amount collected |
| Balance paid | None required | Stripe `payment_intent.succeeded` updates balance state | Server outbox `purchase`; transaction ID = balance PaymentIntent; value = amount collected | Server outbox `Purchase`; event ID = balance PaymentIntent; value = amount collected | `payment.remaining_balance_succeeded`; source ID = balance PaymentIntent; root `amount` = amount collected |
| Booking completed | Browser confirmation is behavioral only | Booking remains authoritative in Supabase | `booking_completed`, no revenue fields | No duplicate purchase | `booking.confirmed` is queued from the Stripe-confirmed state |
| Failed balance | None | Stripe failure updates booking and financial log | No revenue | No purchase | `payment.remaining_balance_failed` queued with stable PaymentIntent identity |

There is no standalone `form_start` event in the current UI. `booking_started` is the funnel-start signal. Contact-form submission is tracked, while the durable conversion is the server-created `lead.created` event.

## Root causes found

1. The spoke put `amount` inside `attributes.data`; the Hub adapter only reads root `amount`, so canonical `amount_cents` was null.
2. `entity_type` and `entity_id` were also attributes instead of root `entity.type` / `entity.id`.
3. Senzai, GA4, and Meta calls were direct network requests after state mutations. A timeout or process exit could lose them permanently.
4. Any Senzai 2xx response was considered delivered, including non-`translated` outcomes.
5. GA4 reported the full booking total at deposit time and emitted no balance transaction. This overstated cash collected until the balance actually settled.
6. The confirmation page emitted browser revenue using the booking ID even though the authoritative financial identity is the Stripe PaymentIntent.
7. Landing CTAs called two helpers that both emitted `cta_clicked`; booking-start was also emitted at destination-page load.
8. The remaining-balance request identity included the current timestamp, preventing durable deduplication.

## Corrected delivery model

`analytics_delivery_outbox` stores one row per logical destination delivery. `delivery_key` is unique, and the external identity is stable:

- Senzai: spoke idempotency key + stable source event ID.
- GA4: Stripe PaymentIntent as `transaction_id` for each collected payment.
- Meta: Stripe PaymentIntent as `event_id` for each collected payment.
- Checkout intent: Stripe Checkout Session ID.
- Lead: persisted lead UUID.

Workers claim due rows using `FOR UPDATE SKIP LOCKED`. Failed deliveries use bounded exponential backoff. A stale `processing` claim can be recovered after 15 minutes. The Senzai transport accepts success only when the Hub response contains `data.status = translated`.

## Required environment variables

- Shared persistence: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Retry worker authorization: `CRON_SECRET`; `ADMIN_SECRET` is the optional manual-call path.
- Senzai: `SENZAI_INGEST_URL`, `SENZAI_CONNECTION_KEY`, `SENZAI_CONNECTION_SECRET`.
- GA4: `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-SMP4GWTYJW`, `GA4_API_SECRET`.
- Meta CAPI: `META_PIXEL_ID`, `META_ACCESS_TOKEN`, `META_API_VERSION`; `META_TEST_EVENT_CODE` is optional outside production.

The local `.env.local` has the expected GA4 Measurement ID. The operator confirmed that the two Senzai connection credentials were configured in production and redeployed; their values were not inspected or printed. Public checks made before this branch was published still showed the previous application code, so end-to-end delivery must be verified after this PR is merged and deployed.

## Deployment order

1. Migration `031_analytics_delivery_outbox.sql` was applied by the operator; validate claim/retry behavior without reapplying it blindly.
2. Deploy the Hub adapter change that accepts deposit/balance canonical event names.
3. Confirm the production environment-variable names are available to the deployment without printing values (the operator reports this is complete).
4. Deploy the client code. The built-in retry cron runs daily because the current Vercel Hobby plan rejects more frequent schedules; use an authorized external scheduler or upgrade to Pro for ten-minute recovery.
5. Exercise a test-mode deposit and balance, then reconcile Stripe amounts against GA4, Meta Events Manager, Hub ingestion events, and Hub business events.

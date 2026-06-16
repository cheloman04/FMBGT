# META CAPI CLIENT DEPLOYMENT STANDARD V1
## Revenue Signal Infrastructure Standard

Created by Senzai Automations  
Proven on: Florida Mountain Bike Guides (FMBGT)  
Purpose: Establish a reusable Meta Pixel + Conversions API implementation that transforms ad traffic into measurable revenue intelligence.

---

# 1. Executive Summary

This deployment delivered a modern Meta measurement system built for real commercial use, not just ad platform setup.

The final infrastructure combines:

- Browser-side Meta Pixel activity
- Server-side Meta Conversions API (CAPI)
- Lead capture attribution
- Checkout intent attribution
- Stripe purchase attribution
- Safe production diagnostics
- Fail-safe architecture that never interrupts the customer journey

In practical terms, this means Meta can now learn from real business outcomes rather than low-signal traffic events alone.

---

# 2. Strategic Outcome

The deployment created a foundation for performance marketing that is:

- measurable
- reusable
- scalable
- revenue-aware

Instead of relying on page visits as the primary optimization input, the system now sends Meta the events that matter most to growth:

- `PageView`
- `Lead`
- `InitiateCheckout`
- `Purchase`

This shifts advertising from visibility-based optimization to outcome-based optimization.

---

# 3. Live Event Status

| Event | Source | Status |
|---|---|---|
| PageView | Browser | Live |
| Lead | Server | Live and processed |
| InitiateCheckout | Server | Live and processed |
| Purchase | Server | Fully wired and ready for final validation via low-cost internal checkout |

## Accuracy Note

At the moment this standard was documented:

- `Lead` was confirmed in production as a server-side processed Meta event.
- `InitiateCheckout` was confirmed in production as a server-side processed Meta event.
- `Purchase` was fully wired through the live Stripe webhook path and prepared for final validation using a dedicated `$1` internal payment flow.

---

# 4. Business Value Created

This infrastructure enables Meta to optimize around meaningful customer intent and revenue events rather than surface activity alone.

## Immediate value

- Better lead generation optimization
- Better checkout intent retargeting
- Better purchase optimization inputs
- Stronger audience quality
- More reliable conversion feedback loops

## Audience opportunities

- Website visitors with no lead
- Leads with no purchase
- Checkout initiated with no purchase
- Purchasers
- Future high-value lookalike audiences

## Commercial advantage

The client now owns a cleaner signal architecture that supports:

- lower CPA over time
- stronger ROAS optimization
- more precise funnel diagnostics
- more scalable ad account learning

---

# 5. Technology Layer

This deployment was built on:

- Next.js
- Vercel
- Meta Pixel
- Meta Conversions API
- Stripe
- Supabase
- Senzai internal event infrastructure

---

# 6. Required Environment Variables

## Server-side Meta CAPI

```env
META_PIXEL_ID=
META_ACCESS_TOKEN=
META_API_VERSION=v23.0
META_TEST_EVENT_CODE=
```

## Browser-side Meta Pixel

```env
NEXT_PUBLIC_META_PIXEL_ID=
```

## Internal Purchase Verification

```env
LIVE_TEST_BOOKING_TOKEN=
```

## Deployment guidance

- Keep `META_TEST_EVENT_CODE` enabled while validating events in Meta Test Events.
- Remove or clear `META_TEST_EVENT_CODE` once testing is complete and campaign traffic is ready for standard production attribution.
- `NEXT_PUBLIC_META_PIXEL_ID` should match the same dataset/pixel used by server-side CAPI.

---

# 7. Core Files and Responsibilities

## Core Meta CAPI engine

### `lib/meta-capi.ts`

Responsible for:

- sending events to Meta
- hashing required user identifiers
- enforcing timeout protection
- logging production-safe diagnostics
- failing safely without breaking checkout or lead flow

## Browser pixel layer

### `components/MetaPixelPageView.tsx`
### `app/layout.tsx`

Responsible for:

- loading the base Meta Pixel
- tracking browser `PageView`
- supporting route-based page tracking
- maintaining browser-side signal continuity

## Business event triggers

### `app/api/leads/route.ts`

Fires:

- `Lead`

### `app/api/create-checkout/route.ts`

Fires:

- `InitiateCheckout`

### `app/api/webhooks/stripe/route.ts`

Fires:

- `Purchase` for deposit collection
- `Purchase` for remaining balance collection

## Internal test pricing override

### `lib/pricing.ts`
### `components/steps/StepPayment.tsx`

Responsible for:

- internal verification pricing
- operator-visible test mode messaging

---

# 8. Event Architecture

## PageView

Tracked in the browser through Meta Pixel.

Primary value:

- visitor audience creation
- browser-side attribution coverage
- top-of-funnel visibility

## Lead

Triggered when a new prospect successfully submits the lead / booking capture form.

Primary value:

- lead generation campaign optimization
- lead audience creation
- top-of-funnel outcome measurement

## InitiateCheckout

Triggered after a Stripe Checkout Session is successfully created.

Primary value:

- high-intent retargeting
- funnel drop-off visibility
- mid-funnel optimization signal

## Purchase

Triggered through Stripe success webhooks.

Primary value:

- revenue optimization
- ROAS feedback
- purchaser audience creation
- downstream buyer lookalikes

---

# 9. Purchase Trigger Standard

## Deposit purchase

The primary booking purchase signal fires from:

- `checkout.session.completed`

This is the event path that matters first for validating Meta `Purchase` on a normal booking deposit.

## Remaining balance purchase

A second purchase signal is supported from:

- `payment_intent.succeeded`

This applies to the later off-session remaining balance charge only.

## Practical validation rule

For most service-business deployments, the first Meta `Purchase` validation should focus on:

- `checkout.session.completed`

---

# 10. Problems Solved During Deployment

## Meta rejection of server events

Meta initially rejected server events because user identifiers were being sent unhashed.

### Resolution

The helper was upgraded to automatically SHA-256 hash the required fields before transmission:

- email
- phone
- first name
- last name
- external ID

## Hidden production delivery failures

Early production logging showed event attempts but not final delivery outcomes.

### Resolution

Production-safe diagnostics were added so each event now resolves clearly as one of:

- attempting
- payload prepared
- success
- failed
- timeout
- exception

## Revenue-path protection

Meta failures could not be allowed to interfere with live business operations.

### Resolution

The implementation was designed to fail safely:

- no Meta error blocks lead creation
- no Meta error blocks checkout session creation
- no Meta error blocks Stripe webhook completion

## Cost-efficient purchase validation

The internal live verification flow originally used a `$5.00` payment.

### Resolution

The protected live-test checkout flow was reduced to `$1.00` so server-side `Purchase` validation could happen with minimal cost and no impact on customer pricing.

---

# 11. Data Governance Standard

## Recommended Meta platform settings

Enable:

- Automatic Website Matching
- First-party cookies

Avoid relying on:

- uncontrolled auto event tracking without code

## Domain hygiene

Recommended allowlist:

- `floridamountainbikeguides.com`
- approved subdomains as needed

This improves trust in the event stream and reduces contamination from irrelevant traffic sources.

---

# 12. Diagnostics Standard

## Production logs should always resolve to:

- `[meta-capi] attempting EVENT_NAME`
- `[meta-capi] payload EVENT_NAME`
- `[meta-capi] success EVENT_NAME`
- `[meta-capi] failed EVENT_NAME STATUS BODY`
- `[meta-capi] timeout EVENT_NAME`
- `[meta-capi] exception EVENT_NAME ERROR`

## Logging policy

Diagnostics are designed to be operationally useful without exposing sensitive data.

The system does not log:

- access tokens
- raw customer email
- raw phone
- full unsafe Meta payloads

The system does log enough to support fast troubleshooting in production.

---

# 13. Internal Live Test Flow

The app supports a protected live verification flow using:

- `live_test=1`
- `test_token=<LIVE_TEST_BOOKING_TOKEN>`

## Current verification amount

- `$1.00` total booking value

## Purpose

This exists solely to validate:

- real Stripe checkout completion
- webhook success handling
- Meta server-side `Purchase` delivery

## Safety assurance

This does not alter:

- standard customer pricing
- normal checkout behavior
- live booking economics

---

# 14. Recommended Campaign Usage

## Cold traffic

Primary optimization target:

- `Lead`

## Warm traffic

Primary optimization target:

- `InitiateCheckout`

## Hot retargeting

Primary optimization target:

- `Purchase`

---

# 15. Plug-and-Play Future Client SOP

## Step 1

Create the Meta dataset / pixel.

## Step 2

Install required environment variables:

- `META_PIXEL_ID`
- `META_ACCESS_TOKEN`
- `META_API_VERSION`
- `META_TEST_EVENT_CODE`
- `NEXT_PUBLIC_META_PIXEL_ID`

## Step 3

Reuse the shared Meta infrastructure:

- `lib/meta-capi.ts`
- `MetaPixelPageView.tsx`

## Step 4

Map the client’s business routes to:

- `Lead`
- `InitiateCheckout`
- `Purchase`

## Step 5

Validate the full flow in Meta `Test Events`.

## Step 6

Confirm Stripe webhook-based purchase delivery.

## Step 7

Remove `META_TEST_EVENT_CODE` when launch readiness is complete.

## Step 8

Launch paid traffic using verified conversion signals.

---

# 16. Senzai Standardization Advantage

This system creates more than a single-client implementation.

It creates a standardized event language that can be reused across future Senzai accounts:

- `PageView`
- `Lead`
- `InitiateCheckout`
- `Purchase`
- `Refund`
- `BookingConfirmed`
- `CompletedService`

That standardization is what allows cross-client intelligence to compound over time.

---

# 17. Estimated Future Deployment Time

## Initial build: FMBGT

This first deployment required several hours because it included:

- Meta payload rejection debugging
- hashing corrections
- production diagnostics hardening
- Vercel environment and deployment verification

## Future clients using this standard

Estimated deployment time:

- `30–60 minutes` for standard implementations
- longer only when custom event logic or custom payment architecture is required

---

# 18. Strategic Conclusion

This deployment should not be viewed as a simple pixel installation.

It is a revenue signal system.

It gives Meta cleaner intelligence about:

- who became a lead
- who showed buying intent
- who actually paid

That is what creates the operating leverage required for:

- lower CPA
- stronger ROAS
- better retargeting precision
- more scalable campaign performance

---

# 19. Senzai Recommendation

This framework should become the default onboarding standard for paid traffic clients.

Recommended commercial positioning:

- Meta Ads
- Tracking Infrastructure
- Attribution Layer
- Revenue Intelligence Dashboard

Together, these move the conversation from “running ads” to “building growth systems.”

---

# 20. Recommended Next Action

For FMBGT, the next operational step is straightforward:

1. Run the protected `$1.00` live-test checkout
2. Confirm `Purchase` appears in Meta Events Manager as:
   - `Server`
   - `Processed`
3. Archive the successful proof
4. Remove `META_TEST_EVENT_CODE` when testing is fully complete

---

END

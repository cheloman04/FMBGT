# Booking Platform + Admin Dashboard Export Summary

## Purpose

This repo is a single Next.js application that contains:

1. A public booking platform at `/booking`
2. A cookie-protected admin dashboard at `/admin`
3. Supporting API routes, payment/webhook logic, lead tracking, waiver storage, and scheduled balance charging

If these features are moved to another repo, they should be treated as one product slice, not as isolated pages. The booking flow, dashboard, database schema, Stripe webhook handling, waiver storage, and cron charging logic are tightly coupled.

---

## Current Architecture

### Runtime

- Framework: Next.js App Router
- Language: TypeScript
- UI: React 19 + Tailwind CSS 4 + shadcn/ui
- Deploy target: Vercel

### External services

- Supabase
  - primary database
  - storage bucket for waivers
  - service-role access used by server routes and server components
- Stripe
  - checkout for deposit payment
  - webhook processing for confirmation / refund / remaining balance events
  - off-session future charge using saved payment method
- Cal.com
  - availability lookup
  - booking creation after successful payment
- n8n
  - downstream automation after booking/payment events
- Upstash Redis
  - optional rate limiting for checkout

### Important top-level folders

- `app/`
  - routes, server components, API handlers
- `components/`
  - booking steps, dashboard UI, landing page UI
- `context/BookingContext.tsx`
  - central booking state machine and local persistence
- `lib/`
  - pricing, inventory, Stripe, Cal.com, Supabase, waiver PDF helpers, analytics helpers
- `supabase/`
  - schema + migrations
- `types/booking.ts`
  - shared domain model for booking flow and API payloads

---

## Product Surfaces

### 1. Public booking platform

Relevant routes:

- `/booking`
- `/booking/confirmation`
- `/booking/lookup`

Relevant files:

- `app/booking/page.tsx`
- `app/booking/layout.tsx`
- `context/BookingContext.tsx`
- `components/steps/*`
- `lib/steps.ts`
- `lib/pricing.ts`
- `lib/inventory.ts`
- `app/api/availability/route.ts`
- `app/api/validate-inventory/route.ts`
- `app/api/leads/route.ts`
- `app/api/leads/[id]/progress/route.ts`
- `app/api/waivers/store/route.ts`
- `app/api/create-checkout/route.ts`
- `app/api/booking-lookup/route.ts`

Core behavior:

- Single-route wizard rendered dynamically at `/booking`
- Step routing is state-driven, not URL-driven
- State is persisted in `localStorage` under `fmtg_booking_v1`
- Flow captures lead data before payment
- Flow supports 1 to 6 riders
- Waiver completion is required before checkout
- Checkout only charges a 50% deposit
- Remaining balance is charged later via cron/off-session Stripe payment

### 2. Admin dashboard

Relevant routes:

- `/admin`
- `/admin/login`

Relevant files:

- `app/admin/page.tsx`
- `app/admin/AdminClient.tsx`
- `app/api/admin/login/route.ts`
- `app/api/admin/update-booking/route.ts`
- `app/api/admin/retry-charge/route.ts`
- `app/api/admin/delete-booking/route.ts`

Core behavior:

- password-only login based on `ADMIN_SECRET`
- auth is an `admin_session` httpOnly cookie
- dashboard server-loads bookings, leads, and aggregate stats from Supabase
- supports:
  - booking status changes
  - retrying failed remaining-balance charges
  - deleting bookings
  - viewing waiver records through signed Supabase storage URLs
  - lead funnel monitoring

---

## Booking Flow Architecture

### State engine

The booking flow is controlled by `BookingContext` plus `lib/steps.ts`.

Important properties of the implementation:

- active step list changes depending on booking state
- `skill` is skipped for paved trails
- `duration` is skipped for paved trails and first-time MTB riders
- `addons` is skipped for paved trails
- `goNext()` also sends best-effort lead progress updates when a lead already exists
- `price_breakdown` and `waiver_signers` are intentionally not persisted to localStorage

### Step order

Current logical flow:

1. Trail type
2. Lead capture
3. Skill level
4. Location
5. Bike selection
6. Date/time
7. Duration
8. Add-ons
9. Waiver
10. Payment

Actual active steps vary by trail type and rider skill.

### Flow data contracts

`types/booking.ts` is the shared domain contract. The most important type is `BookingState`, which carries:

- trail configuration
- rider and additional participant details
- date/time and duration
- add-ons
- waiver participants/signers/session
- customer info
- lead id
- UTM attribution
- computed pricing

If moved, this file should remain the single source of truth for request/response typing and UI state shape.

---

## Pricing Model

Main implementation:

- `lib/pricing.ts`

Current rules:

- Paved tours:
  - flat `$115` base per booking
  - bike included
  - fixed 2 hours
  - GoPro and pickup/dropoff multiply by participant count
  - electric upgrade is counted per rider marked as electric
- MTB tours:
  - base price depends on whether rider rents a bike
  - duration surcharge is per rider for extra hours beyond 2
  - GoPro and pickup/dropoff multiply by participant count
  - electric upgrade logic combines per-rider electric selections plus legacy upgrade flag
- Florida state tax is 7%
- checkout charges only 50% deposit now
- remaining 50% is stored on the booking and charged later

Important coupling:

- client displays estimated pricing
- server recalculates pricing in `/api/create-checkout`
- do not trust client totals during extraction

---

## Inventory Model

Main implementation:

- `lib/inventory.ts`
- `app/api/validate-inventory/route.ts`
- Supabase trigger migrations `003_fix_electric_trigger.sql` and `006_fix_participant_info.sql`

Current rules:

- inventory is enforced at two levels:
  - app-level validation for UX
  - database trigger for correctness under concurrency
- electric bike availability must count:
  - lead rider `bike_rental`
  - all additional riders inside `participant_info`
- same-date bookings with status `pending` or `confirmed` count as reserved
- fleet cap logic also exists in checkout validation:
  - max 2 electric bikes per booking
  - max 4 standard bikes per booking in capped scenarios

Important coupling:

- if the DB trigger is not migrated with the app, overselling can happen
- `participant_info` must remain JSON array shaped; migration `006` fixes historical bad data

---

## Payments Architecture

Main implementation:

- `lib/stripe.ts`
- `app/api/create-checkout/route.ts`
- `app/api/webhooks/stripe/route.ts`
- `app/api/cron/charge-remaining/route.ts`
- `app/api/admin/retry-charge/route.ts`

### Checkout phase

`/api/create-checkout` does all important server-side work:

- validates request shape with Zod
- enforces origin/content-type
- rate limits by IP if Upstash is configured
- validates participant caps and bike restrictions
- validates minimum 24h lead time
- validates waiver session existence
- validates current inventory
- recalculates final price server-side
- upserts customer in Supabase
- creates or reuses Stripe customer
- creates a `pending` booking row before redirect
- creates Stripe Checkout Session for the deposit only
- stores `stripe_session_id` back on the booking

### Webhook phase

`/api/webhooks/stripe` is the actual booking confirmation engine.

On `checkout.session.completed` it:

- marks booking `confirmed`
- marks deposit as paid
- saves Stripe payment method ID for off-session later charge
- updates postal code from Stripe billing details when available
- converts linked lead from `lead` to `converted`
- creates Cal.com booking
- links stored waiver records to the final booking id
- triggers n8n webhook
- marks `webhook_sent = true` only if n8n succeeded

Other handled events:

- `payment_intent.succeeded`
  - marks remaining balance as paid
- `payment_intent.payment_failed`
  - marks remaining balance as failed
- `checkout.session.expired`
  - cancels pending booking
- `charge.refunded`
  - marks booking refunded

### Scheduled charge phase

`/api/cron/charge-remaining`:

- runs daily through `vercel.json`
- charges bookings whose remaining balance is due
- requires `CRON_SECRET` as bearer token, or `x-admin-secret` with `ADMIN_SECRET`
- only charges bookings that are:
  - `confirmed`
  - `remaining_balance_status = pending`
  - have no previous remaining-balance payment intent
  - have saved payment method

Admin can also manually retry failed charges through `/api/admin/retry-charge`.

---

## Leads and Funnel Tracking

Main implementation:

- `app/api/leads/route.ts`
- `app/api/leads/[id]/progress/route.ts`
- `context/BookingContext.tsx`
- dashboard leads view in `app/admin/page.tsx` and `app/admin/AdminClient.tsx`

Behavior:

- a lead is created early in the booking flow
- progress updates are best-effort and intentionally non-blocking
- lead fields store:
  - identity/contact
  - trail choice
  - location/date/duration selections
  - UTM attribution
  - funnel stage
  - last activity timestamp
- after successful deposit payment, webhook converts lead to `converted` and links it to `booking_id`

This means the dashboard is not only operational; it is also the funnel analytics surface for this product.

---

## Waiver Architecture

Main implementation:

- `components/steps/StepWaiver.tsx`
- `components/waiver/SignatureCanvas.tsx`
- `lib/waiver-text.ts`
- `lib/waiver-pdf.ts`
- `app/api/waivers/store/route.ts`
- `supabase/migrations/008_waivers.sql`

Behavior:

- waiver is completed before checkout
- one waiver row is stored per signer
- booking does not exist yet when waiver is stored
- records are initially tied to `session_id`
- after Stripe checkout succeeds, webhook links those rows to `booking_id`
- signatures and PDFs are uploaded to Supabase Storage bucket `waivers`
- dashboard generates signed URLs at read time so admin can view PDFs/signatures safely

Important extraction note:

- waiver storage is not optional glue; checkout explicitly validates `waiver_session_id`
- if waivers are migrated later than booking, checkout will hard-fail

---

## Admin Dashboard Data Loading

Main implementation:

- `app/admin/page.tsx`
- `app/admin/AdminClient.tsx`

Server-side page responsibilities:

- verify `admin_session` cookie
- fetch bookings or leads depending on filter
- fetch stats
- fetch related locations and customers
- fetch waiver records by `booking_id` or by `waiver_session_id`
- sign waiver asset URLs for dashboard display

Current dashboard views:

- all bookings
- confirmed
- completed
- cancelled
- refunded
- leads

Current stats:

- total bookings excluding `pending`
- active leads
- confirmed bookings
- completed bookings
- revenue
- projected revenue
- conversion rate
- pending balance count
- failed balance count

---

## Database Dependencies

Base schema lives in:

- `supabase/schema.sql`

Critical migrations:

- `002_participant_columns.sql`
- `003_fix_electric_trigger.sql`
- `005_marketing_fields.sql`
- `006_fix_participant_info.sql`
- `008_waivers.sql`
- `009_deposit_payment.sql`
- `011_leads.sql`

Conceptual tables required by booking + dashboard:

- `customers`
- `locations`
- `tours`
- `bookings`
- `inventory`
- `addon_pricing`
- `waiver_records`
- `leads`

Important booking columns beyond the obvious:

- `participant_count`
- `participant_info`
- `waiver_session_id`
- `deposit_amount`
- `remaining_balance_amount`
- `remaining_balance_due_at`
- `deposit_payment_status`
- `remaining_balance_status`
- `stripe_payment_method_id`
- `webhook_sent`
- `zip_code`
- `marketing_source`
- `lead_id`

Important extraction note:

- the app code assumes these columns already exist
- the product will not run correctly if only `schema.sql` is copied without the later migrations

---

## Environment Variables Required

### Required for core booking

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `ADMIN_SECRET`

### Required for current production behavior

- `CAL_API_KEY`
- `CAL_EVENT_TYPE_ID`
- `CAL_USERNAME`
- `N8N_WEBHOOK_URL`
- `CRON_SECRET`

### Optional but used when available

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

---

## Extraction Boundaries

If moving to another repo, treat these as the minimum slices that should move together.

### Slice A: Domain + infra

- `types/booking.ts`
- `lib/supabase.ts`
- `lib/pricing.ts`
- `lib/inventory.ts`
- `lib/stripe.ts`
- `lib/cal.ts`
- `lib/waiver-text.ts`
- `lib/waiver-pdf.ts`
- all required env handling
- Supabase schema + migrations

### Slice B: Booking UI

- `app/booking/*`
- `components/steps/*`
- `components/Booking*`
- `components/PriceSummary.tsx`
- `components/waiver/*`
- `context/BookingContext.tsx`
- any shared UI primitives used by booking

### Slice C: Booking APIs

- `/api/availability`
- `/api/validate-inventory`
- `/api/leads`
- `/api/leads/[id]/progress`
- `/api/waivers/store`
- `/api/create-checkout`
- `/api/booking-lookup`
- `/api/webhooks/stripe`
- `/api/cron/charge-remaining`

### Slice D: Admin

- `app/admin/*`
- `/api/admin/login`
- `/api/admin/update-booking`
- `/api/admin/retry-charge`
- `/api/admin/delete-booking`

If only the public UI is moved without slices A and C, the booking platform will be visually portable but behaviorally incomplete.

---

## Non-Obvious Product Decisions

- Booking confirmation happens in the Stripe webhook, not at checkout creation time
- `pending` bookings are intentionally created before payment and later promoted
- dashboard excludes `pending` bookings by default
- booking flow lives on one route and is step-state driven
- paved and MTB flows are materially different
- waiver must happen before payment, not after
- remaining balance is card-on-file, not manual invoicing
- lead tracking is embedded into booking, not a separate CRM integration
- admin auth is intentionally simple and cookie-based, not user-based RBAC

---

## Gotchas To Preserve During Migration

- Keep Next.js server/client boundaries intact:
  - admin page and confirmation page fetch on the server
  - booking wizard and dashboard UI are client-heavy
- Keep webhook route deployed and reachable publicly, or bookings will never become confirmed
- Keep `success_url` behavior exactly aligned with booking id handling
- Preserve DST-safe Eastern time conversion in Stripe webhook before creating Cal.com bookings
- Preserve `participant_info` JSON shape and related DB trigger logic
- Preserve localStorage key versioning if `BookingState` changes
- Preserve signed URL creation for waiver assets in admin
- Preserve both cron auth paths if ops still uses manual/n8n triggers
- Preserve allowed origin logic in checkout route if domain changes

---

## Recommended Migration Order

1. Move schema + migrations first
2. Move shared domain/lib layer
3. Move booking API routes
4. Move booking UI + context
5. Move Stripe webhook and cron route
6. Move admin page + admin APIs
7. Reconnect external services
8. Run end-to-end deposit booking test
9. Run remaining-balance retry test from admin
10. Verify waiver signing + dashboard access to waiver files

---

## Validation Checklist After Moving

- can create a lead
- can progress through all booking steps
- can store waiver session
- can create checkout session
- Stripe webhook confirms booking
- lead becomes converted
- Cal.com booking UID is saved
- n8n webhook fires
- booking appears in admin
- waiver PDFs/signatures open in admin
- cron can find and charge due balances
- failed balance can be retried in admin

---

## Short Summary

This product is not just a booking form plus an admin page. It is a tightly integrated booking system where UI, API routes, Supabase schema, Stripe webhooks, waiver storage, lead tracking, and scheduled payment collection all cooperate. For a clean export to another repo, the correct unit of migration is the entire booking/admin domain slice, not only the visible pages.

# Blueprint Client Implementation

> Canonical blueprint for future client projects derived from this repository.
> Priority: every implementation must be designed to integrate cleanly with `Senzai v1`.

---

## 1. Purpose

This document defines how to create future client projects using this repository as the base operational pattern.

It is not only a setup guide.
It is the architectural blueprint for:

- public-facing customer experience
- booking and lead capture
- payments and post-payment automation
- admin operations
- support observability
- event delivery into `Senzai v1`

The most important rule is this:

**The client app is not the system of record for business meaning. `Senzai v1` is the cross-client intelligence layer, so every implementation must emit stable, high-signal, canonical business events from day one.**

That means future projects should not be designed as isolated booking websites. They should be designed as event-producing operational systems with a branded UI on top.

---

## 2. What This Blueprint Is

This blueprint is the recommended baseline for a service business that needs:

- a marketing site or landing page
- a lead capture and booking flow
- payment collection with deposit plus later balance charge
- waiver or compliance capture before payment when needed
- an admin dashboard for operations
- downstream automations
- reliable event streaming into `Senzai v1`

This blueprint is especially strong for businesses where:

- each booking has lifecycle milestones
- customer intent matters before payment
- operations need to see both funnel and fulfillment
- finance events need traceability
- support needs actionable alerts

Examples:

- guided tours
- outdoor experiences
- rentals with deposits
- classes or workshops
- field services with reservation windows

---

## 3. Core Architectural Principle

Every future client implementation should be designed around three simultaneous responsibilities:

1. `Customer experience`
   The site must convert, educate, and make booking feel simple.

2. `Operational truth`
   The app must safely manage bookings, payments, waivers, inventory, and admin workflows.

3. `Senzai-compatible event intelligence`
   The app must produce trustworthy lifecycle events that can be consumed by `Senzai v1` without custom rescue work later.

If tradeoffs appear, prefer decisions that preserve event quality, reconciliation quality, and deterministic business-state transitions.

---

## 3.1 Non-Negotiable Rules

These rules should be treated as blueprint invariants.

1. Booking confirmation must be webhook-authoritative, never redirect-authoritative.
2. Revenue KPIs must represent collected money, not theoretical booking value.
3. Every critical outbound event must carry an idempotency strategy.
4. Every project must validate real ingestion into `Senzai v1` before go-live.
5. Public write routes must enforce server-side validation even if the UI already validates.
6. Payment, reconciliation, and support-relevant workflows must produce append-only events.
7. Cron-driven money movement must always have authentication and a manual trigger path.
8. Stripe payment success must always be linkable to a booking or create a reconciliation alert.
9. Inventory-sensitive flows must be protected at the database layer, not only in the UI.
10. Timezone and due-date semantics must be explicitly documented per client.
11. Support must be able to understand failures from the app/admin surface, not only vendor dashboards.
12. Migrations are part of the product contract and must ship with feature evolution.
13. Projects must not invent client-specific replacements for canonical event names without a deliberate contract update.
14. Destructive actions must be guarded when financial or compliance records exist.
15. `BLUEPRINT_CLIENT_IMPLEMENTATION.md` should win over local improvisation when architectural ambiguity appears.
16. Every client project must define a canonical acquisition vocabulary before launch.
17. Every lead capture path must preserve source context at the database level when present.
18. Attribution data must be persisted in the app database, not only inside analytics platform dashboards.
19. Revenue KPIs across all reporting layers must represent collected revenue, not theoretical pipeline value.
20. Tracking and attribution are product infrastructure. They are not optional marketing tooling added after launch.

---

## 4. Reference Documents In This Repo

Current repo docs serve different roles:

- [README.md](C:/Users/chegl/OneDrive/Desktop/Florida%20Mountain%20Bike%20Trail%20Guided%20Tours/README.md)
  Quick start only. Good for local setup, not sufficient as a blueprint.

- [PROJECT.md](C:/Users/chegl/OneDrive/Desktop/Florida%20Mountain%20Bike%20Trail%20Guided%20Tours/PROJECT.md)
  Best current general technical reference. Covers stack, flow, routes, DB, gotchas, and deployment notes.

- [EXPORT_BOOKING_DASHBOARD_SUMMARY.md](C:/Users/chegl/OneDrive/Desktop/Florida%20Mountain%20Bike%20Trail%20Guided%20Tours/EXPORT_BOOKING_DASHBOARD_SUMMARY.md)
  Best current domain-slice export summary. Covers booking, dashboard, payments, waivers, cron, env vars, extraction boundaries, and migration order.

- [N8N_CONFIRMATION_EMAIL_PAYLOAD.md](C:/Users/chegl/OneDrive/Desktop/Florida%20Mountain%20Bike%20Trail%20Guided%20Tours/N8N_CONFIRMATION_EMAIL_PAYLOAD.md)
  Integration-specific email payload reference.

This file supersedes the others as the architectural starting point for future client implementations.

---

## 5. Canonical Stack

The default stack for future client builds should remain:

- `Next.js App Router`
- `TypeScript`
- `React`
- `Tailwind CSS`
- `Supabase`
- `Stripe`
- `Vercel`
- `n8n`
- `Senzai v1`

Recommended supporting tools:

- `Zod` for runtime request validation
- `next-themes` if the project uses theme switching
- `Upstash Redis` for rate limiting on high-risk public endpoints

Why this stack works:

- Next.js gives a clean split between public UI, server-rendered admin surfaces, and protected API routes.
- Supabase gives fast operational development for relational data, storage, and service-role server access.
- Stripe handles both checkout and later off-session collection.
- n8n is useful for operational automation that should stay decoupled from app code.
- `Senzai v1` becomes the canonical event-analysis and lifecycle-intelligence destination.

---

## 6. Required System Surfaces

Every client implementation should explicitly define these surfaces up front.

### 6.1 Public surface

This is the branded website experience.

Typical responsibilities:

- landing page
- service explanation
- FAQs
- lead capture
- booking wizard
- booking confirmation
- booking lookup when needed

### 6.2 Operational surface

This is the admin dashboard and protected operational tooling.

Typical responsibilities:

- booking visibility
- status management
- payment state visibility
- support actions
- waiver access
- lead funnel visibility
- financial event visibility

### 6.3 Integration surface

This is the set of APIs and background behaviors that connect the app to the outside world.

Typical responsibilities:

- Stripe webhook handling
- scheduled jobs
- automation webhooks
- event emission to `Senzai v1`
- support alert dispatching

The integration surface must be designed as first-class product infrastructure, not as an afterthought.

---

## 7. System of Record Boundaries

Future implementations should preserve these boundaries.

### App database

Use Supabase as the transactional source of truth for:

- customers
- leads
- bookings
- inventory
- waivers
- operational statuses
- financial event log

### Stripe

Use Stripe as the payment authority for:

- checkout sessions
- payment intents
- charge success/failure
- refunds
- saved payment methods for future charges

### n8n

Use n8n for:

- email sending
- support notifications
- non-critical branching workflows
- CRM-style follow-up automations

Do not make n8n the only owner of core transactional truth.

### Senzai v1

Use `Senzai v1` as the downstream lifecycle-intelligence layer for:

- canonical business milestones
- cross-client behavioral modeling
- operational analytics
- AI-assisted support context
- replayable business timeline

The app must emit events cleanly enough that `Senzai v1` can trust them with minimal project-specific translation.

---

## 8. Senzai v1 First Design Rules

These are the most important blueprint rules.

### Rule 1: emit business events, not only technical events

Good:

- `booking.created`
- `payment.deposit_requested`
- `payment.succeeded`
- `booking.confirmed`
- `payment.remaining_balance_requested`
- `payment.remaining_balance_succeeded`
- `review.request_enrolled`

Less useful by itself:

- `route.called`
- `supabase.insert.success`
- `stripe.webhook.received`

Technical telemetry can exist, but `Senzai v1` should receive business-meaningful events.

### Rule 2: each event should be authoritative or clearly best-effort

An event should make its source clear:

- authoritative from Stripe webhook
- authoritative from app booking creation
- best-effort from UI progress update

### Rule 3: use stable IDs and references

Every event sent to `Senzai v1` should include enough references to join it to the business object:

- `booking_id`
- `lead_id`
- `customer_id` when available
- `stripe_session_id`
- `payment_intent_id`
- `stripe_event_id`
- external calendar id if relevant

### Rule 4: preserve idempotency

Every meaningful outbound event should have an idempotency strategy.

Examples:

- Stripe webhook event id
- booking id plus milestone name
- payment intent id plus event name

### Rule 5: design for append-only auditability

Do not rely only on mutating rows like `status = paid`.

Also capture append-only events so `Senzai v1`, support, and finance can reconstruct what happened.

### Rule 6: track missing-record and reconciliation anomalies as first-class events

If Stripe says a payment succeeded but the booking row is missing, that must emit a critical reconciliation event and notify support.

---

## 9. Canonical Event Model For Future Clients

Every future project should start with a canonical event vocabulary. The exact names can expand by domain, but the foundation should stay stable.

### Lead lifecycle

- `lead.created`
- `lead.progressed`
- `lead.follow_up_requested`
- `lead.follow_up_sent`
- `lead.lost`
- `lead.converted`

### Booking lifecycle

- `booking.started`
- `booking.created`
- `booking.confirmed`
- `booking.updated`
- `booking.cancelled`
- `booking.completed`
- `booking.refunded`

### Payment lifecycle

- `payment.deposit_requested`
- `payment.deposit_succeeded`
- `payment.deposit_failed`
- `payment.remaining_balance_requested`
- `payment.remaining_balance_succeeded`
- `payment.remaining_balance_failed`
- `payment.refunded`

### Review lifecycle

- `review.request_enrolled`
- `review.step_sent`
- `review.received`
- `review.sequence_completed`

### Reconciliation lifecycle

- `reconciliation.booking_missing_for_remaining_balance_success`
- `reconciliation.booking_missing_for_remaining_balance_failure`
- `reconciliation.missing_payment_method`

### Support / ops lifecycle

- `support.alert_triggered`
- `ops.manual_retry_requested`
- `ops.manual_retry_succeeded`
- `ops.manual_retry_failed`

The event names above should be treated as a starting vocabulary for future clients, not random examples.

---

## 10. Recommended Event Payload Shape For Senzai v1

Every Senzai-bound event should aim to contain:

```json
{
  "event_name": "payment.remaining_balance_succeeded",
  "occurred_at": "2026-04-22T19:02:00.000Z",
  "source_route": "/api/webhooks/stripe",
  "authoritative_source": "stripe.payment_intent.succeeded",
  "idempotency_key": "payment_intent:pi_123:payment.remaining_balance_succeeded",
  "entity_type": "payment",
  "entity_id": "pi_123",
  "refs": {
    "booking_id": "uuid",
    "lead_id": null,
    "stripe_event_id": "evt_123",
    "payment_intent_id": "pi_123"
  },
  "data": {
    "charge_type": "remaining_balance",
    "amount": 250,
    "currency": "usd",
    "location_name": "Soldiers Creek Park"
  }
}
```

Design notes:

- `event_name` should be business-readable
- `occurred_at` should represent when the business event occurred
- `authoritative_source` should explain which system truly knew the fact
- `refs` should be lean and stable
- `data` should contain business context, not raw vendor blobs

Avoid dumping full Stripe payloads into Senzai unless there is a specific downstream need.

---

## 11. Domain Modules To Preserve In Future Projects

This repo has already shown the minimum domains that should remain explicit.

### 11.1 Marketing / acquisition

- landing page
- attribution capture
- lead capture

### 11.2 Booking domain

- booking state model
- pricing rules
- availability rules
- inventory rules
- customer data capture

### 11.3 Compliance domain

- waiver or consent capture
- signer relationships
- document storage

### 11.4 Payment domain

- deposit
- balance due later
- retries
- refund handling
- reconciliation

### 11.5 Operations domain

- dashboard
- financial log
- support actions
- manual overrides

### 11.6 Intelligence domain

- event generation
- Senzai ingestion
- support alerting
- lifecycle annotations

If future clients omit the explicit intelligence domain, the project may still function operationally but will not meet blueprint quality.

### 11.7 Growth intelligence domain

Every client project must include a standardized tracking and attribution architecture.

This domain is not the same as the intelligence domain. The intelligence domain is about business lifecycle observability for operations and Senzai. The growth intelligence domain is about measuring acquisition, conversion, and revenue by source so the client can optimize where customers come from and what converts them.

The growth intelligence domain must be designed to measure:

- traffic source quality
- lead quality by acquisition channel
- booking conversion rate by source
- collected revenue by source and campaign
- automation-assisted conversion impact
- repeat customer source value

This domain spans three layers simultaneously:

- `app database` — normalized attribution fields persisted at the lead, booking, and customer level
- `analytics platform` — GA4, Meta Pixel, or equivalent behavioral signal for reporting and ad optimization
- `Senzai v1` — normalized acquisition context attached to business events so cross-client intelligence can reason about source quality

If any of these three layers is absent, the client has incomplete growth infrastructure. A site with GA4 but no database-level attribution cannot answer source-to-revenue questions reliably. A site with database attribution but no analytics platform cannot run paid acquisition efficiently. Neither alone is sufficient.

Tracking is not just for ad platforms. It is part of the Senzai-compatible operational architecture.

Future client projects must preserve source and attribution data in a reusable, normalized form from day one.

---

## 12. Database Design Guidance

Future clients should keep a relational schema with business-first tables.

Minimum conceptual tables:

- `customers`
- `leads`
- `bookings`
- `locations`
- `inventory`
- `waiver_records`
- `financial_event_logs`

Additional tables by domain:

- `review_request_enrollments`
- `review_request_steps`
- `lead_followup_enrollments`
- `lead_followup_steps`
- domain-specific service tables

### Required characteristics

- UUID primary keys for business entities
- append-only event table for finance and reconciliation
- explicit columns for payment state, not only JSON blobs
- explicit foreign keys where possible
- server-owned timestamps
- migrations treated as first-class deploy artifacts

### Important rule

Do not assume `schema.sql` alone is enough.

Future blueprints must treat migrations as part of the product contract. App code and schema evolution are coupled.

---

## 12.1 Canonical Status Dictionaries

Future projects should avoid inventing inconsistent status strings. Use explicit dictionaries and extend only with care.

### Booking status

- `pending`
- `confirmed`
- `completed`
- `cancelled`
- `refunded`

### Deposit payment status

- `pending`
- `paid`
- `failed`
- `refunded`

### Remaining balance status

- `pending`
- `paid`
- `failed`
- `waived`

### Lead status

- `lead`
- `converted`
- `lost`

### Lead follow-up enrollment status

- `active`
- `completed`
- `cancelled`
- `lost`

### Lead follow-up step status

- `pending`
- `sent`
- `cancelled`
- `skipped`

### Review request enrollment status

- `active`
- `completed`
- `cancelled`
- `reviewed`

### Review request step status

- `pending`
- `sent`
- `skipped`

### Financial log severity

- `info`
- `warning`
- `error`
- `critical`

### Why this matters

- KPI logic becomes predictable
- admin badges remain consistent
- Senzai event normalization stays reusable
- support reasoning does not depend on project-specific wording

---

## 12.2 Canonical Acquisition Vocabulary

Every future client project must define a canonical acquisition vocabulary before launch. This vocabulary must be consistent across the app database, analytics platform, Senzai events, and any CRM or automation layer. Ad hoc or project-specific naming creates permanent reporting fragmentation.

### traffic_source

The origin domain or named source of a visit or lead.

Controlled values:

- `google`
- `meta`
- `tiktok`
- `youtube`
- `bing`
- `organic`
- `direct`
- `referral`
- `email`
- `sms`
- `partner`
- `unknown`

### traffic_medium

The method or channel type by which the visitor arrived.

Controlled values:

- `cpc`
- `paid_social`
- `organic_search`
- `organic_social`
- `referral`
- `direct`
- `email`
- `sms`
- `offline`
- `unknown`

### campaign_type

The strategic intent of the campaign that drove the visit.

Controlled values:

- `branded`
- `non_branded`
- `remarketing`
- `competitor`
- `awareness`
- `lead_gen`
- `promotion`
- `retention`
- `unknown`

### lead_channel

The mechanism through which the lead was created in the system.

Controlled values:

- `form`
- `booking_flow`
- `phone_call`
- `whatsapp`
- `chat`
- `walk_in`
- `referral_link`
- `manual_import`
- `unknown`

### attribution_stage

Which attribution touch is being described.

Controlled values:

- `first_touch`
- `last_touch`
- `assisted`
- `unknown`

### conversion_stage

Where in the customer journey the entity currently sits.

Controlled values:

- `visitor`
- `engaged`
- `lead`
- `qualified`
- `booked`
- `paid`
- `completed`
- `repeat_customer`
- `lost`

### Why canonical vocabulary matters

Tracking names that vary project to project make cross-client Senzai intelligence impossible to normalize. A consistent vocabulary means that a campaign tagged `cpc` in client A means exactly the same thing as `cpc` in client B. Revenue by `traffic_source: google` + `traffic_medium: cpc` becomes a reusable query pattern rather than a per-client archaeological exercise.

---

## 12.3 Standard Tracking Event Vocabulary

Future projects should emit a standardized set of acquisition and funnel behavioral events. These exist alongside the canonical business lifecycle events defined in section 9, not as replacements for them.

### Distinction between event types

**Tracking events** represent behavioral and funnel signals. They are typically best-effort, UI-originated, or analytics-platform-oriented. They answer: what did the user do?

**Business lifecycle events** represent authoritative state transitions. They are server-authoritative, database-backed, and Senzai-bound. They answer: what did the system confirm?

**Authoritative business milestones** are a strict subset of business lifecycle events where money or compliance is involved. They must never be best-effort.

Future client projects should not conflate these categories. A `booking_started` tracking event is not the same as a `booking.created` business event. The former is a UI signal; the latter is an authoritative record.

### Standardized tracking events

Acquisition and landing:

- `page_view`
- `landing_view`
- `cta_clicked`

Lead and form:

- `form_started`
- `form_submitted`
- `lead_submitted`

Booking funnel:

- `booking_started`
- `booking_step_completed`
- `booking_completed`
- `checkout_started`

Engagement:

- `call_clicked`
- `whatsapp_clicked`
- `chat_started`
- `map_viewed`
- `photo_gallery_viewed`

Post-service:

- `review_left`
- `repeat_purchase`

### Payment tracking events

Payment events should remain authoritative through the systems already defined elsewhere in the blueprint. The following tracking variants exist only for analytics platform signal purposes and must always be downstream of the authoritative server confirmation:

- `deposit_paid` — analytics signal only, triggered after Stripe webhook confirmation
- `remaining_balance_paid` — analytics signal only, triggered after remaining-balance confirmation

Never rely on client-side payment events as the source of truth for booking or payment state. They exist only to fire analytics platform conversion tags.

### Recommended attribution context to attach to tracking events

When available, tracking events should carry:

- `traffic_source`
- `traffic_medium`
- `campaign_type`
- `lead_channel`

This allows analytics platforms to attribute funnel events back to normalized acquisition context consistently.

---

## 13. Payment Architecture Pattern

The pattern proven in this repo should remain the default.

### Phase 1: create pending booking before payment

Why:

- gives a stable `booking_id`
- lets all downstream systems reference the same record
- allows waiver linking and operational traceability before confirmation

### Phase 2: collect deposit through Stripe Checkout

Why:

- improves conversion for higher-ticket services
- reduces payment friction
- still captures payment method for later charge

### Phase 3: confirm booking through Stripe webhook

Why:

- webhook is the authoritative confirmation moment
- prevents false positives from redirect completion only

### Phase 4: collect remaining balance through cron or manual retry

Why:

- supports card-on-file business models
- keeps admin workflow simple
- allows support visibility and recovery

### Required safeguards

- save Stripe customer id
- save Stripe payment method id
- persist due date explicitly
- keep idempotency around payment intent creation
- emit payment events to both local event log and `Senzai v1`

---

## 14. Admin Architecture Pattern

Future clients should keep an operator-first admin, even if authentication is simple in early stages.

Recommended admin capabilities:

- booking table and mobile cards
- lifecycle status visibility
- payment state visibility
- lead visibility
- waiver access
- financial log
- manual retry actions for recoverable cases
- support notes or internal annotations if needed later

### Strong recommendation

Keep support observability inside the app, not only in Stripe, n8n, or Supabase.

Operators need one place to answer:

- what happened
- what failed
- what was charged
- what remains due
- whether support has to intervene

The financial log introduced in this repo should be considered blueprint-standard.

---

## 15. Financial Event Log Pattern

This repo now establishes an important pattern for future clients:

- append-only financial ledger
- admin-visible
- includes severity
- includes support-attention signal
- supports reconciliation cases
- captures both happy-path and anomaly-path events

Future client projects should include a financial event log when:

- money moves through the system
- payments are split across time
- support needs explainability
- external systems can disagree

### Design considerations

- events should be append-only
- the UI should sort newest first
- duplicates should be prevented when the same business fact can be observed by two routes
- support-facing severity should be explicit

---

## 16. Support Alerting Pattern

If a workflow failure could create customer pain or revenue leakage, it should be support-visible.

Recommended routing:

- app identifies critical anomaly
- app records local financial/reconciliation event
- app calls support webhook in n8n
- n8n forwards to the human support channel

Examples that should trigger support alerts:

- payment succeeded but booking missing
- charge failed and requires human follow-up
- webhook downstream failed after payment confirmation
- destructive admin action with partial failure

The app should not depend on a human discovering failures manually in logs.

---

## 17. Booking Flow Design Guidance

The booking flow should remain:

- state-driven
- dynamically skippable
- server-validated
- recoverable

### Client-side responsibilities

- guide the user smoothly
- capture inputs progressively
- persist safe in-progress state locally where appropriate
- show estimated pricing

### Server-side responsibilities

- validate request shape
- validate inventory
- validate pricing
- validate compliance prerequisites
- create authoritative records

Never trust client-computed totals or eligibility.

---

## 18. Compliance / Waiver Pattern

If the domain requires waivers, consent, or signed acknowledgements:

- capture them before checkout when operationally required
- persist each signer separately
- store evidence documents safely
- link temporary session artifacts to final `booking_id` after payment confirmation

This pattern is reusable well beyond tours.

Examples:

- rentals
- minors participating in activities
- liability-heavy services
- medical or legal acknowledgements

---

## 19. Timezone and Scheduling Rules

Future clients must treat date and time design as architecture, not formatting.

Rules:

- store canonical timestamps in UTC
- preserve local business date meaning when displaying due dates
- document which source is authoritative for appointment time
- explicitly handle DST when converting local scheduled services
- define cron timing in UTC with local-business interpretation documented

Why this matters:

- booking date displays can drift a day in local time if implemented carelessly
- due-date semantics can break finance support trust
- calendar integrations fail silently when offsets are wrong

This repo has already demonstrated these failure modes, so future projects should account for them from the start.

---

## 20. Environment Variable Categories

Future clients should categorize environment variables by responsibility.

### Core app

- app URL
- admin secret
- public client-safe vars

### Database

- Supabase URL
- Supabase anon key
- Supabase service role key

### Payments

- Stripe secret key
- Stripe publishable key
- Stripe webhook secret
- cron secret

### Automation

- n8n booking webhook
- support webhook
- follow-up secrets

### Intelligence

- `SENZAI_INGEST_URL`
- any future `SENZAI_API_KEY` or auth secret if introduced

### Tracking and analytics

- `NEXT_PUBLIC_GA_MEASUREMENT_ID` — GA4 measurement ID
- `NEXT_PUBLIC_GTM_ID` — GTM container ID if tag manager is used
- `NEXT_PUBLIC_META_PIXEL_ID` — Meta Pixel ID if Meta is an active acquisition channel
- `GOOGLE_ADS_CONVERSION_ID` — Google Ads conversion sync if implemented
- any CAPI or server-side tagging credentials if applicable

### Rate limiting / infra

- Upstash keys

Do not let env vars accumulate without ownership. Each env var should belong to an architectural category.

---

## 21. Deployment Pattern

Default deployment target remains `Vercel`.

Recommended production pattern:

- deploy app to Vercel
- host Supabase separately
- configure Stripe webhook to public app URL
- configure cron in `vercel.json`
- configure automation webhooks in env vars
- verify Senzai ingestion in production before go-live

### Mandatory go-live checks

- successful lead creation
- successful waiver save if applicable
- successful checkout session creation
- successful Stripe webhook confirmation
- successful event ingestion into `Senzai v1`
- successful admin visibility
- successful scheduled or manual remaining-balance charge path
- successful support alert path for at least one controlled failure

If `Senzai v1` integration is not tested in production-like conditions, the implementation is incomplete.

---

## 21.1 Cross-System Source Of Truth Table

To reduce ambiguity, future client projects should define authority by concern.

| Concern | Source of truth | Notes |
|---|---|---|
| Booking record existence | Supabase | Booking row is created before payment redirect |
| Booking confirmation | Stripe webhook + Supabase update | Redirect success alone is not authoritative |
| Deposit payment success | Stripe | Supabase mirrors it after verified webhook handling |
| Remaining balance success/failure | Stripe | Supabase mirrors it through webhook or controlled retry flow |
| Payment display state in admin | Supabase | Must be synchronized from Stripe outcomes |
| Financial event audit trail | Supabase `financial_event_logs` | Append-only operational ledger |
| Booking availability / inventory truth | Supabase + DB constraints | UI and API checks are only first layers |
| Waiver evidence | Supabase Storage + waiver records | Must remain privately stored and linkable |
| Support notifications | n8n | App decides when to alert, n8n delivers |
| Lifecycle intelligence | `Senzai v1` | Consumes normalized events, not raw app state |
| UI booking progress | App state + lead persistence | Best-effort until authoritative booking/payment transition |
| Calendar fulfillment booking | Calendar provider after app orchestration | Provider is downstream, not booking authority |
| Acquisition source attribution | Supabase (app database) | Raw UTMs and normalized source fields persisted at lead and booking level; this is operational attribution truth |
| Behavioral analytics and funnel reporting | GA4 / equivalent analytics platform | Best-effort reporting signal for optimization; not authoritative for business decisions |
| Ad platform conversion signal | Meta Pixel / Google Ads tag / CAPI | Platform-side reporting only; app database is the source of revenue truth |
| Revenue by source analysis | Supabase + Senzai | App attribution persisted at lead and booking level enables source-to-revenue joins without depending on platform dashboards |
| Cross-client acquisition intelligence | `Senzai v1` | Normalized acquisition metadata forwarded from app events enables Senzai to reason about source quality across clients |

If a future project cannot answer this table clearly, it is not yet architecturally ready.

---

## 22. Recommended Build Order For Future Clients

Build future projects in this order.

1. Define canonical business event vocabulary first
1.5. Define canonical acquisition vocabulary and attribution data contract
2. Define Supabase schema and migrations
3. Define server-side domain utilities
4. Define booking / lead / payment request contracts
5. Implement event emission to `Senzai v1`
6. Implement booking UI
7. Implement payment flow
8. Implement Stripe webhook confirmation
9. Implement admin dashboard
10. Implement scheduled jobs and manual retries
11. Implement support alerts
12. Run end-to-end test with real event validation

This order matters because many teams build UI first and event architecture last. For the blueprint, that is backwards.

---

## 23. Adaptation Rules For Future Clients

When adapting this blueprint for a new client:

### Safe to customize heavily

- branding
- landing page layout
- copy
- service catalog
- pricing formulas
- waiver copy
- admin visual design

### Customize carefully

- booking flow step order
- inventory logic
- deposit percentage logic
- due-date policy
- review request timing
- support escalation rules

### Do not casually break

- webhook-authoritative confirmation model
- append-only event logging
- payment state transitions
- idempotency strategy
- canonical event naming discipline
- `Senzai v1` integration layer

---

## 24. Anti-Patterns To Avoid

Avoid these in future client projects:

- confirming bookings on redirect success alone
- storing only final status without event history
- trusting client-side price totals
- hiding failures in vendor dashboards instead of surfacing them in admin
- using ad hoc event names that change project to project
- sending raw vendor payloads to `Senzai v1` with no business normalization
- making support depend on developers to inspect logs
- treating cron timing as “good enough” without business-time semantics
- capturing UTM parameters in the browser but not persisting them to the database
- relying only on GA4 or Meta dashboards for source-to-revenue analysis
- defining tracking event names casually per project instead of using the canonical vocabulary
- treating tracking as a post-launch add-on rather than day-one product infrastructure
- reporting revenue from pipeline booking value rather than collected money

---

## 25. Recommended Repo Documentation Strategy

For future client repos derived from this blueprint, keep these docs:

- `README.md`
  Local setup and run instructions

- `PROJECT.md`
  Full repo reference and technical notes

- `BLUEPRINT_CLIENT_IMPLEMENTATION.md`
  Cross-client architectural standard and system design rules

- integration-specific docs as needed
  Example: email payloads, event contracts, migration notes

This file should remain intentionally more stable than `PROJECT.md`.

`PROJECT.md` can evolve with feature detail.
`BLUEPRINT_CLIENT_IMPLEMENTATION.md` should evolve only when the architectural standard itself changes.

---

## 26. Implementation Checklist For New Client Projects

Before calling a derived client project blueprint-compliant, confirm:

- canonical event vocabulary is defined
- `Senzai v1` integration path exists and is tested
- all key business actions emit normalized events
- booking confirmation is webhook-authoritative
- admin can see operational truth without vendor hopping
- financial event log exists if money moves through the system
- support alerts exist for critical anomalies
- due-date and timezone rules are explicitly documented
- migrations are versioned and applied
- end-to-end testing covered both happy path and failure path

---

## 27. Short Final Standard

Future clients should not receive just a website.

They should receive:

- a branded acquisition surface
- an operational booking system
- a support-aware admin layer
- a finance-aware event ledger
- a growth intelligence layer with database-level attribution
- and a `Senzai v1` compatible event architecture

That is the actual product standard established by this repository.

---

## 28. Plug-and-Play Standard

The real goal of this blueprint is not "easy cloning."

The goal is:

- one repeatable architecture
- one stable operational model
- one stable event vocabulary
- one stable deployment model
- one stable admin model
- one stable support model

So that each new client project only changes:

- brand
- catalog
- copy
- pricing rules
- waiver text
- automation payload details
- a small number of domain-specific steps

Everything else should be as standardized as possible.

### 28.1 What should remain identical across client projects

- core framework stack
- Stripe lifecycle model
- webhook-authoritative booking confirmation
- Supabase relational structure pattern
- append-only financial log pattern
- Senzai event emission contract
- support alert routing pattern
- admin operational surface pattern
- cron and retry architecture
- environment variable naming strategy
- migration discipline
- canonical acquisition vocabulary and controlled values
- attribution data contract at the lead and booking level
- tracking event naming discipline

### 28.2 What should be client-configurable

- business name
- logo
- color system
- service/location catalog
- tax rules by jurisdiction
- deposit percentage policy
- remaining balance due policy
- waiver copy
- email templates
- review request timing
- support recipients

---

## 29. Standard Product Modules

Every future client implementation should be assembled from explicit modules.

### Module A: Brand shell

Responsibilities:

- client identity
- global theme
- logo
- typography
- navigation
- footer

This module should be swappable without affecting operations.

### Module B: Marketing and acquisition

Responsibilities:

- landing page
- service education
- FAQs
- CTA routing
- attribution parameter capture
- analytics platform tag firing
- canonical tracking event emission
- normalized source context handoff to lead capture

### Module C: Lead capture

Responsibilities:

- early identity capture
- contact persistence
- attribution persistence
- booking-progress tracking
- handoff to booking domain

### Module D: Booking engine

Responsibilities:

- step orchestration
- dynamic step skipping
- business-rule enforcement
- state persistence
- customer/rider data normalization

### Module E: Pricing engine

Responsibilities:

- server-side truth
- client-side estimate
- line-item generation
- tax handling
- deposit calculation
- remaining-balance calculation

### Module F: Inventory and availability

Responsibilities:

- real-time UX validation
- server-side validation
- database-level concurrency protection
- date/time slot availability rules

### Module G: Compliance

Responsibilities:

- waiver flow
- signer role handling
- evidence storage
- booking linkage

### Module H: Payment orchestration

Responsibilities:

- pending booking creation
- Stripe customer handling
- checkout session creation
- Stripe webhook processing
- off-session charge
- retry path
- refund path

### Module I: Operational admin

Responsibilities:

- bookings
- leads
- statuses
- retries
- waiver viewing
- financial log
- support actions

### Module J: Event intelligence

Responsibilities:

- canonical event normalization
- Senzai ingestion
- idempotency
- observability
- reconciliation annotations

### Module K: Automation and support

Responsibilities:

- transactional notifications
- lifecycle emails
- support alerts
- review requests
- lead follow-up orchestration

If a derived client repo cannot be described in these modules, its architecture is probably getting too ad hoc.

---

## 30. Golden Flow For Future Implementations

Every client project should preserve a single golden booking lifecycle.

### Stage 1: customer enters acquisition surface

- landing page loads
- attribution parameters are captured
- Senzai-ready lead context begins accumulating

### Stage 2: lead is created early

- create lead before payment
- associate contact and service intent
- persist last completed step
- emit `lead.created`

### Stage 3: booking intent becomes concrete

- collect service, date, participants, location, options
- validate inventory and policy rules
- emit best-effort flow progression events

### Stage 4: compliance is completed if required

- save waiver session
- store signer evidence
- block checkout unless prerequisites exist
- emit `waiver.completed` or equivalent compliance milestone

### Stage 5: pending booking row is created

- create authoritative booking row before redirecting to Stripe
- save deposit and remaining-balance amounts
- save due-at timestamp
- emit `booking.created`

### Stage 6: deposit checkout is created

- create Stripe Checkout Session
- save `stripe_session_id`
- emit `payment.deposit_requested`

### Stage 7: webhook confirms booking

- Stripe webhook marks booking confirmed
- deposit becomes paid
- payment method is saved for future off-session use
- lead is converted
- downstream automation fires
- Senzai receives authoritative milestones

### Stage 8: downstream fulfillment systems receive enriched payload

- n8n gets normalized payload
- calendar provider gets booking
- support or operations can inspect state in admin

### Stage 9: remaining balance is collected later

- cron or manual retry attempts charge
- booking updates accordingly
- finance log records the attempt and result
- Senzai receives authoritative payment outcome

### Stage 10: post-service lifecycle continues

- review request enrollment
- follow-up automations
- completion or refund lifecycle

This is the golden path. New client projects should adapt it, not reinvent it.

---

## 31. Standard Data Contract Rules

### 31.1 Shared type ownership

Future projects should keep a shared domain contract file similar to `types/booking.ts`.

This file should define:

- booking state shape
- participant shape
- waiver shape
- pricing summary shape
- lead attribution shape
- API payload shape

This contract must be the single source of truth for:

- client state
- server validation input
- internal route payloads

### 31.2 Server validation is mandatory

All important public write routes should validate with `Zod`.

At minimum:

- `/api/leads`
- `/api/waivers/store`
- `/api/create-checkout`
- admin mutation routes
- automation callback routes

### 31.3 Normalize before persisting

Normalize:

- emails to lowercase
- empty strings to null when appropriate
- phone formatting strategy
- numeric cents instead of float dollars
- UTC timestamps instead of local ad hoc strings

---

## 32. Database Baseline For Future Clients

The baseline database package for derived projects should include:

- full `schema.sql`
- all migrations
- seed data strategy
- storage bucket setup instructions
- index checklist
- RLS checklist

### 32.1 Tables that should be considered blueprint-standard

- `customers`
- `locations`
- `bookings`
- `leads`
- `inventory`
- `waiver_records`
- `financial_event_logs`

### 32.2 Tables that should be added whenever the feature exists

- `lead_followup_enrollments`
- `lead_followup_steps`
- `booking_review_request_enrollments`
- `booking_review_request_steps`

### 32.5 Attribution fields that should be persisted at the lead level

Raw inbound values:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_term`
- `utm_content`

Normalized canonical values derived from raw UTMs:

- `traffic_source` — normalized using the canonical vocabulary in section 12.2
- `traffic_medium` — normalized using the canonical vocabulary in section 12.2
- `campaign_type` — normalized using the canonical vocabulary in section 12.2
- `lead_channel` — how the lead record was created

Attribution timing:

- `first_touch_attribution` — full attribution snapshot at the moment of first known visit
- `last_touch_attribution` — full attribution snapshot at the moment of lead creation or conversion
- `attribution_updated_at` — when last-touch was refreshed

Additional context:

- `landing_page_path` — the first page the visitor landed on
- `referrer_url` — the referring URL if available
- `device_type` — desktop, mobile, or tablet
- `session_id` — if session-level tracking is implemented

Do not store only raw UTMs. The canonical normalized values must also be persisted so Senzai-bound events can carry standardized source context without requiring a re-derivation step at query time.

### 32.6 Attribution inheritance at the booking level

When a booking is created from a lead, the booking should inherit or snapshot the lead's attribution context.

Recommended approach:

- store an `attribution_snapshot` JSONB column on the bookings table
- populate it at booking creation time with the lead's last-touch attribution or the canonical normalized source values
- do not rely on joining back to the lead record at query time for attribution reporting, since the lead may later change status or be modified

This means that a simple `SELECT booking_id, attribution_snapshot->>'traffic_source' AS source, total_price` style query can produce source-to-revenue data without multi-table complexity.

### 32.3 Important booking columns that should remain explicit

- `status`
- `date`
- `time_slot`
- `participant_count`
- `participant_info`
- `waiver_session_id`
- `deposit_amount`
- `remaining_balance_amount`
- `remaining_balance_due_at`
- `deposit_payment_status`
- `remaining_balance_status`
- `stripe_customer_id`
- `stripe_payment_method_id`
- `stripe_session_id`
- `deposit_payment_intent_id`
- `remaining_balance_payment_intent_id`
- `webhook_sent`
- `lead_id`
- `marketing_source`
- `zip_code`

### 32.4 DB design lessons already learned

- JSON participant data is convenient but dangerous if triggers are not updated with schema changes.
- inventory constraints must exist at the database layer, not only in the UI
- event log tables need indexes on booking, occurred time, and attention flags
- append-only tables need deduplication strategy if the same fact can be observed twice
- RLS should be explicit, even when service-role-only tables are not user-facing

---

## 33. Migration Discipline Standard

This repo already proved that migrations are part of product behavior, not infrastructure housekeeping.

### Rules

- never launch from `schema.sql` alone
- every feature with data implications must ship with migration(s)
- migration order must be documented
- production go-live checklist must reference exact migration names
- destructive schema changes must be rare and carefully staged

### Suggested categories

- base schema
- booking data evolution
- payment evolution
- lead funnel evolution
- compliance evolution
- observability evolution

### Minimum migration checklist before go-live

- participant structure
- inventory trigger correctness
- waiver schema
- deposit/balance schema
- lead schema
- follow-up schema if used
- review request schema if used
- financial log schema

---

## 34. Inventory and Availability Architecture

This is one of the easiest places for future client projects to become inconsistent.

### Required pattern

- UX-level availability check for speed
- server-level validation before transaction
- DB-level enforcement for correctness under concurrency

### Why all three matter

- UX-only checks are not safe
- server-only checks can still race
- DB-only checks are safe but can feel abrupt to users without earlier feedback

### Inventory rules should account for

- lead rider and additional riders
- per-item class, not just total participants
- status-based reservation logic
- date-based overlap logic
- special caps by location or service type

### Availability rules should account for

- provider slot availability
- minimum lead time
- blocked dates
- blackout periods
- local business timezone

---

## 35. Payment Rules To Standardize

To keep future projects predictable, standardize payment architecture wherever possible.

### 35.1 Monetary storage

- store all amounts as integer cents
- never compute business truth from formatted strings
- never store tax as presentation-only logic

### 35.2 Payment statuses

Recommended explicit statuses:

- deposit: `pending | paid | failed | refunded`
- remaining balance: `pending | paid | failed | waived`

### 35.3 Payment moments

- deposit requested
- deposit succeeded
- deposit expired
- remaining requested
- remaining succeeded
- remaining failed
- refund processed

### 35.4 Why the split-payment model matters

It enables:

- lower-friction booking conversion
- more realistic cash collection patterns
- operator visibility into still-due revenue
- support workflows for recovery

### 35.5 Required retry architecture

Future projects that allow delayed balance charges should include:

- automated cron path
- manual admin retry path
- clear support escalation path
- event logging for both automatic and manual attempts

---

## 36. Cron, Due Date, and Timezone Operational Rules

This repo surfaced several non-obvious realities that should now be blueprint standard.

### 36.1 Vercel cron is UTC-based

Never reason about Vercel cron as if it were local time.

Document:

- the cron expression
- the equivalent business-local time
- whether DST changes its local behavior

### 36.2 Due date semantics must be explicit

Ask this early for each client:

- should the second charge happen exactly 24 hours before service start?
- or once on the prior calendar day?
- or at a fixed local business hour?

Those are not the same rule.

### 36.3 Display dates and charge logic are different problems

- UTC timestamps may be ideal for charge queries
- calendar display may need date-only local preservation

Do not assume the same formatter should serve both.

### 36.4 Manual cron invocation should always remain possible

The blueprint should preserve two auth paths when appropriate:

- Vercel `Authorization: Bearer <CRON_SECRET>`
- manual/admin/n8n `x-admin-secret: <ADMIN_SECRET>`

This helps support and validation workflows without needing to wait on schedule.

### 36.5 Production rule

`CRON_SECRET` must exist in Vercel and deployments should be recreated after adding it.

---

## 37. Webhook Architecture Rules

Webhooks are not optional plumbing. They are business-critical state transition engines.

### Rules

- verify signatures
- fail loudly on invalid configuration
- treat webhook success as authoritative for payment confirmation
- make writes idempotent
- emit business events after authoritative transitions
- record reconciliation anomalies

### Stripe webhook should generally handle

- deposit success
- remaining-balance success
- remaining-balance failure
- session expiration
- refunds

### Supportability rule

If a webhook succeeds partially and fails on downstream automation, that should be visible in admin and support alerts.

---

## 38. Senzai v1 Integration Contract

This section should be treated as blueprint-critical.

### 38.1 Required env vars for Senzai

- `SENZAI_INGEST_URL`
- `SENZAI_CONNECTION_KEY`
- `SENZAI_CONNECTION_SECRET`

### 38.2 Standard send behavior

The app should send normalized events to:

- `SENZAI_INGEST_URL + /api/ingest/events` when needed by the helper

### 38.3 Required properties for every Senzai event

- `event_name`
- `occurred_at`
- `entity_type`
- `entity_id`
- `source_route`
- `authoritative_source`
- `idempotency_key`
- `refs`
- `data`

### 38.4 Event quality rules

- never send meaningless placeholder values
- avoid leaking raw secret-bearing payloads
- avoid highly client-specific naming unless truly domain-specific
- prefer normalized amounts and stable identifiers

### 38.5 Minimum event coverage before considering integration complete

- lead created
- booking started
- booking created
- waiver stored if applicable
- deposit requested
- deposit succeeded
- booking confirmed
- remaining requested
- remaining succeeded or failed
- admin status change
- review/follow-up milestones if implemented

### 38.6 Senzai is not a backup for missing app data

The app must still be internally coherent.

Senzai complements operational truth; it does not excuse weak local data modeling.

---

## 39. n8n Integration Standard

Future client projects should use n8n for orchestrated outbound actions, not as the only source of business state.

### Recommended n8n env vars

- `N8N_WEBHOOK_URL`
- `N8N_SUPPORT_WEBHOOK_URL`
- `N8N_LEAD_FOLLOWUP_WEBHOOK_URL`
- `N8N_FOLLOWUP_SECRET`

### Recommended use cases

- booking confirmation email
- support escalation
- lead follow-up
- review request delivery
- calendar invite handling
- CRM mirroring if needed

### Rules

- send normalized payloads, not raw database rows without shape control
- treat n8n as downstream automation, not authoritative booking confirmation
- when n8n gates a step, preserve explicit callback routes and auth secrets

---

## 40. Support and Reconciliation Design

Support architecture should be part of the product spec.

### The admin must answer

- did the booking exist?
- did payment succeed?
- was the deposit paid?
- is there a remaining balance?
- was the balance attempted?
- did it fail?
- was support already alerted?
- is this a duplicate or reconciliation issue?

### The system must create artifacts for support

- append-only financial log
- webhook status visibility
- explicit failed states
- retry controls where safe
- support alerts via n8n

### Reconciliation cases to explicitly design for

- payment succeeded but booking missing
- webhook failed after payment succeeded
- remaining charge failed due to missing payment method
- charge job processed same fact from two routes
- stale processing marker stuck on booking
- manual destructive deletion attempted on financially active booking

---

## 41. Destructive Action Guardrails

This repo already needed safeguards around deleting leads and bookings.

Future client projects should preserve the rule:

Do not allow destructive deletes when there is financial or compliance history that must be preserved.

### At minimum, block or heavily guard deletion when a record has

- deposit paid
- remaining balance pending/paid/failed
- Stripe session id
- Stripe customer id
- Stripe payment method id
- payment intent ids
- waiver artifacts

### Recommended approach

- prefer soft delete or archival in mature versions
- if hard delete exists, log it as a financial/ops event
- require explicit admin authentication

---

## 42. Admin UX Standard

The admin should feel like an operational cockpit, not a developer console.

### Required characteristics

- mobile usable
- desktop dense enough for operators
- clear money-state visibility
- clear lifecycle badges
- clear failure affordances
- low-friction search/filtering

### Minimum core views

- bookings
- leads
- financial log

### Strongly recommended derived stats

- total bookings
- active leads
- confirmed
- completed
- revenue actually collected
- projected revenue still due
- conversion rate
- pending balance count
- failed balance count

### KPI rule

Revenue should mean collected revenue, not theoretical booking value.

This was a real issue already encountered in this repo, so future builds should define KPI semantics explicitly from the start.

---

## 42.1 Acquisition and Growth KPI Standardization

Every future client project should define acquisition and growth KPIs explicitly before launch. KPIs should be computed from the app database wherever possible, not sourced exclusively from analytics platform dashboards.

### Standard acquisition funnel metrics

- `sessions` — visits to the site, measured via analytics platform
- `qualified_visits` — visits that engaged meaningfully with the booking or lead flow
- `leads` — lead records created in the app database
- `booked_customers` — leads that completed a booking
- `paid_customers` — bookings where deposit payment succeeded
- `completed_services` — bookings in completed status
- `repeat_customers` — customers with more than one completed booking

### Standard acquisition efficiency metrics

- `cost_per_lead` — ad spend divided by leads created during the period
- `cost_per_booking` — ad spend divided by confirmed bookings during the period
- `lead_to_booking_rate` — confirmed bookings divided by leads
- `booking_to_paid_rate` — deposit-paid bookings divided by confirmed bookings
- `conversion_rate_by_source` — lead-to-booking rate segmented by `traffic_source`

### Standard revenue metrics

- `collected_revenue_by_source` — sum of deposit plus remaining balance for confirmed/completed bookings, grouped by `attribution_snapshot.traffic_source`
- `collected_revenue_by_campaign` — same, grouped by `attribution_snapshot.utm_campaign`
- `projected_remaining_revenue` — sum of remaining balance amounts for confirmed bookings where remaining balance is pending
- `failed_charge_revenue_at_risk` — sum of remaining balance amounts where `remaining_balance_status = failed`

### KPI semantics rules

- `collected_revenue` counts only when money has actually moved: deposit paid or remaining balance paid
- `theoretical_booking_value` is useful for pipeline forecasting but must never be labeled as revenue
- refunded bookings must be excluded from collected revenue or shown as negative
- revenue metrics must be computable directly from Supabase without depending on Stripe exports or analytics dashboards
- all revenue KPIs passed to Senzai-bound events should use the same collected-revenue semantics

### Why this standardization matters

Different projects that define revenue differently cannot be compared inside `Senzai v1`. A normalized KPI vocabulary means that cross-client benchmarking, seasonal pattern detection, and optimization signal can accumulate meaningfully over time instead of requiring per-client metric translation.

---

## 43. Observability Standard

The blueprint should aim for three layers of observability.

### Layer 1: operational UI observability

- admin dashboard
- financial log
- visible error states

### Layer 2: app-side logging

- route logs for failures
- cron logs
- webhook logs

### Layer 3: downstream event observability

- Senzai events
- n8n support alerts
- Stripe dashboard cross-check

### Rule

No critical workflow should require only one observability layer.

---

## 43.1 Marketing and Tracking Stack Standard

Future client projects should implement a defined tracking stack before launch. Tracking infrastructure should be treated like payment infrastructure: it is not optional and it is not added after the fact.

### Required baseline stack

Every project should include the following before launch:

- `Google Analytics 4` — behavioral analytics, funnel visibility, audience creation
- `Google Tag Manager` — tag management for analytics and conversion events
- `Google Search Console` — organic search performance and indexing health
- `App-database-level attribution persistence` — normalized source fields stored at the lead and booking level as defined in section 32.5
- `Senzai-compatible acquisition context` — normalized source metadata forwarded with Senzai-bound events

### Recommended extended stack

For clients with meaningful paid acquisition:

- `Meta Pixel` — if Meta is a traffic source; required for audience and conversion optimization
- `Meta Conversions API (CAPI)` — server-side conversion signal for Meta; reduces dependence on browser-based pixel attribution
- `Google Ads conversion sync` — conversion events from the app database sent back to Google for optimization signal
- `Offline conversion feedback` — bookings and payments exported from the app database to ad platforms so that platform optimization can optimize for actual revenue rather than only form submissions
- `Call tracking integration` — if phone leads represent a meaningful acquisition channel

### When server-side tagging is appropriate

Server-side Google Tag Manager or equivalent server-side event pipelines should be considered when:

- cookie blocking or browser privacy changes are degrading pixel signal meaningfully
- CAPI integration is required and server-side relay simplifies implementation
- the project is in a jurisdiction where client-side tracking carries elevated compliance risk

### Environment variable additions for tracking stack

The following env vars should be added to the tracking category:

- `NEXT_PUBLIC_GA_MEASUREMENT_ID` — GA4 measurement ID
- `NEXT_PUBLIC_GTM_ID` — GTM container ID if used
- `NEXT_PUBLIC_META_PIXEL_ID` — Meta Pixel ID if applicable
- `GOOGLE_ADS_CONVERSION_ID` — server-side conversion sync if implemented

### Why both client-side and server-side attribution matter

Client-side analytics platforms capture user behavior quickly and cheaply. Server-side attribution persisted in the app database captures actual business outcomes reliably. Neither alone is sufficient.

Platform dashboards show what ad networks want to show. App-database attribution shows what actually happened. The combination is what enables real optimization.

---

## 44. Security and Secret Handling Standard

### Core rules

- keep public and server secrets clearly separated
- service-role keys only on the server
- webhook secrets never exposed client-side
- admin routes protected by cookie session or stronger auth
- cron routes protected by `CRON_SECRET` or explicit alternative auth path
- internal automation callbacks protected by dedicated secrets

### Secret generation rule

Production secrets should be long random values, not human-readable placeholders.

### Deployment rule

Whenever an environment variable is added or changed in Vercel:

- verify the environment scope
- redeploy production
- validate the flow that depends on it

---

## 45. Client Configuration Matrix

Each new client should be onboarded by filling out a configuration matrix before implementation starts.

### Identity

- legal business name
- display name
- support email
- support phone
- logo assets
- brand colors

### Commercial model

- service catalog
- location catalog
- base pricing
- tax logic
- deposit percentage
- remaining-balance policy
- cancellation/refund policy

### Operations

- operating timezone
- slot provider
- blocked dates policy
- maximum participants
- inventory categories

### Compliance

- waiver required?
- minors allowed?
- signer model
- document retention expectations

### Automation

- booking emails
- support escalation destinations
- review request policy
- lead follow-up policy

### Intelligence

- required Senzai events
- entity vocabulary
- custom refs
- tenant/client identifiers if needed later
- normalized acquisition context fields to attach to Senzai events

### Marketing and tracking

- primary paid acquisition channels (Google, Meta, other)
- analytics platform(s) in use
- GA4 measurement ID
- GTM container ID if used
- Meta Pixel ID if applicable
- whether CAPI or offline conversion sync is required
- call tracking platform if phone leads are tracked
- canonical `traffic_source` values expected for this client
- primary campaign types in use
- whether server-side tagging is needed

This matrix should be filled before code customization begins.

---

## 46. What To Parameterize Early

To get closer to plug-and-play, future derivations should move the following into config or data where practical:

- business metadata
- service names
- location metadata
- pricing constants
- inventory caps
- review timing rules
- lead follow-up timing rules
- support copy
- calendar meeting-point metadata
- client logo / imagery

### What should stay in code

- event normalization
- payment architecture
- webhook/state transition logic
- deduplication and idempotency logic
- security/auth guardrails

---

## 47. Real Problems Already Encountered In This Repo

These are not theoretical. Future client builds should actively account for them.

### Payment and webhook issues

- webhook endpoint not configured in Stripe at all
- webhook secret confusion
- assuming redirect success equals payment success
- duplicate success logging from cron plus webhook

### Timezone and date issues

- local Florida time shifting due dates visually to the prior day
- DST mismatch between EST and EDT
- calendar booking times drifting when offsets were hardcoded
- Vercel cron interpreted in UTC while humans reasoned in local business time

### Environment and deployment issues

- production app URL left pointing to localhost
- environment variables added without redeploy
- cron secret missing or blank in production

### Data modeling issues

- participant JSON shape changes affecting inventory logic
- dashboard KPI showing total booking value instead of collected revenue
- deletion paths needing protection once financial history existed

### Operational issues

- need for manual cron invocation during validation
- need for support alerts when charge or reconciliation failed
- need for append-only financial audit surface inside admin

These issues should be considered baseline design constraints for future projects.

---

## 48. Test Strategy Standard

Blueprint compliance should include tests at multiple layers.

### 48.1 Contract tests

- request payload validation
- pricing computation
- inventory rule evaluation
- date/time conversion helpers

### 48.2 Integration tests

- create lead
- create lead with attribution context and verify database persistence
- create waiver session
- create checkout session
- process Stripe webhook
- process cron charge
- process admin retry

### 48.3 End-to-end tests

- full booking conversion path
- delayed remaining-balance path
- at least one failure-and-recovery path

### 48.4 Manual production validation checklist

- booking appears in admin
- waiver artifacts open
- Stripe charge exists
- Senzai events exist
- support alert path works
- financial log reflects reality

---

## 48.5 Acceptance Criteria Per Module

The following defines what "done" should mean for each major module in a future client project.

### Brand shell

Done means:

- the app has a coherent client identity
- the theme works in supported modes
- navigation is stable on desktop and mobile
- brand assets can be replaced without touching business logic

### Marketing and acquisition

Done means:

- CTA paths lead into the booking or lead funnel correctly
- analytics platform tag is installed and firing
- core conversion events fire exactly once per qualifying action
- attribution parameters are captured from URL and passed to lead capture
- landing content can be customized without breaking the app shell

### Lead capture

Done means:

- a lead can be created before payment
- lead progress can be updated safely
- converted and lost states are representable
- attribution context is persisted to the lead record in the database
- normalized `traffic_source` and `traffic_medium` values are stored alongside raw UTMs
- Senzai receives normalized lead milestones with acquisition context attached

### Booking engine

Done means:

- step logic is deterministic
- skips are intentional and documented
- customer cannot proceed with invalid state
- booking state is valid across refresh/back navigation scenarios

### Pricing engine

Done means:

- client estimate and server truth are aligned
- cents-based values are used end to end
- deposit and remaining balance are explicit
- tax behavior is documented and reproducible

### Inventory and availability

Done means:

- availability is visible to the customer
- server catches invalid inventory
- database prevents overselling under concurrency
- special caps are enforced consistently

### Compliance

Done means:

- required waiver/compliance records are captured before payment when applicable
- evidence files are stored safely
- records can be linked to final booking
- admin can view them securely

### Payment orchestration

Done means:

- pending booking is created before checkout
- Stripe session is linked to booking
- webhook confirms booking
- payment method is stored for future use when required
- remaining balance can be charged by cron or retry path
- Senzai receives canonical payment milestones

### Operational admin

Done means:

- bookings are visible
- money state is visible
- important statuses are mutable only through controlled paths
- manual retry works when eligible
- operators can answer what happened without leaving the app

### Financial log

Done means:

- key money events are append-only
- support-critical anomalies are visible
- duplicate equivalent events are prevented
- ledger is readable in admin

### Automation and support

Done means:

- booking notifications can be delivered
- support alert path works
- follow-up/review flows work if enabled
- failed downstream actions are visible somewhere support can inspect

### Senzai integration

Done means:

- canonical event names are used
- required refs are present
- idempotency keys are stable
- at least one real end-to-end production-like flow has been verified in Senzai

---

## 48.6 Operational Runbooks

These runbooks should be adapted per client project but the pattern should remain standard.

### Runbook A: booking paid but not confirmed

Check:

- Stripe event delivery status
- webhook secret correctness
- webhook route deployment health
- Supabase booking row existence
- admin/financial log for reconciliation events

Expected resolution path:

- verify webhook config
- inspect Stripe event id
- reprocess if safe
- emit support alert if booking/payment mismatch persists

### Runbook B: cron did not charge remaining balance

Check:

- `vercel.json` schedule
- UTC vs local business time interpretation
- `CRON_SECRET` presence in production
- deployment happened after env variable changes
- booking eligibility state in Supabase
- presence of saved Stripe payment method

Expected resolution path:

- trigger cron manually via authenticated route
- inspect admin and financial log
- retry or correct timing/config issue

### Runbook C: Stripe charged but admin does not show it

Check:

- Stripe payment intent id
- webhook delivery log
- Supabase payment status columns
- financial event log
- dedupe logic or reconciliation events

Expected resolution path:

- determine whether webhook failed, DB update failed, or UI semantics are wrong
- correct the authoritative state path, not only the UI

### Runbook D: Senzai is not receiving events

Check:

- `SENZAI_INGEST_URL`
- `SENZAI_CONNECTION_KEY`
- `SENZAI_CONNECTION_SECRET`
- route logs around event send attempts
- whether event emission branch was actually executed

Expected resolution path:

- repair credentials or endpoint config
- validate one controlled event end to end
- do not declare go-live complete until this passes

### Runbook E: n8n support or confirmation flow failed

Check:

- target webhook URL env var
- payload shape
- secret/header expectations
- app financial/support event visibility

Expected resolution path:

- re-trigger safely if needed
- ensure support can see failure from app-side surfaces

### Runbook F: date or due date looks wrong

Check:

- UTC stored timestamp
- local display formatter
- whether the business rule is exact-hour based or calendar-day based
- DST assumptions

Expected resolution path:

- fix display semantics separately from charge-query semantics when necessary

These runbooks should eventually be mirrored into client-operational docs, but the blueprint should already anticipate them.

---

## 49. Go-Live Blueprint Checklist

Before a new client project is considered launch-ready:

- all migrations applied
- storage buckets created
- Stripe live webhook registered
- Stripe live secret configured
- `NEXT_PUBLIC_APP_URL` correct in production
- `CRON_SECRET` configured and verified after redeploy
- `ADMIN_SECRET` configured
- Senzai credentials configured
- Senzai event ingestion validated
- n8n booking webhook validated
- n8n support webhook validated
- calendar integration validated
- one real or controlled end-to-end booking tested
- one delayed or manual remaining-balance charge tested
- one refund or failure path reviewed

### Tracking and attribution go-live checklist

- GA4 tag installed and verified firing in production
- GTM container published and tag firing confirmed
- core conversion events firing exactly once per qualifying action
- no duplicate conversion event fires on page reload or back-navigation
- attribution parameters captured correctly from a test URL containing UTM params
- attribution parameters persisted to lead record in Supabase after form submission
- normalized `traffic_source` and `traffic_medium` visible on the persisted lead record
- booking `attribution_snapshot` populated correctly from lead attribution at booking creation
- Senzai event for `lead.created` carries normalized acquisition context
- if Meta Pixel is used: pixel firing confirmed in Meta Events Manager
- if CAPI is used: server-side event deduplication confirmed against pixel events
- if Google Ads is used: at least one conversion event verified as received in Google Ads dashboard
- revenue by source is queryable from Supabase using `attribution_snapshot` without requiring analytics platform export
- client briefed on what GA4, Meta, and Senzai each measure and what the app database is the source of truth for

---

## 50. Recommended Future Enhancements To The Blueprint

To make future client launches even closer to true plug-and-play, the next generation of this blueprint should eventually extract:

- client config file for business metadata
- shared event-name registry
- shared acquisition vocabulary registry
- shared Senzai payload builder package with canonical acquisition context attachment
- shared Stripe booking orchestration package
- shared admin shell package
- shared financial log UI component set
- shared attribution persistence utility (UTM capture → normalize → persist to lead)
- shared tracking event emitter for canonical funnel events
- shared migration bootstrap checklist

That would reduce each new client project to mostly:

- content
- data config
- branding
- pricing rules
- waiver/legal copy

---

## 51. Final Operating Philosophy

This blueprint should produce projects that are:

- branded enough for clients
- operational enough for staff
- observable enough for support
- structured enough for finance
- normalized enough for `Senzai v1`
- measurable enough to optimize acquisition with confidence

If a future derived project looks pretty but weakens event quality, auditability, payment rigor, supportability, or attribution integrity, it is not blueprint-compliant.

The standard is not "the site works."

The standard is:

- the business can operate it
- support can trust it
- finance can reconcile it
- acquisition can be optimized from it
- and `Senzai v1` can understand it cleanly across clients

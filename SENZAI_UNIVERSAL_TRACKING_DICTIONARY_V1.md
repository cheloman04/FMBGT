# Senzai Universal Tracking Dictionary V1

> Canonical tracking vocabulary for all Senzai-powered client systems.
> Version: 1.0 — Treat this file as a living standard. Update it only when the standard itself changes, not when individual clients deviate.

---

## 1. Purpose

This document defines the one shared tracking language for every system built on the Senzai architecture.

Without a shared dictionary:

- reporting fragments across clients
- dashboards become inconsistent even within the same project
- ad optimization loops weaken because conversion signals are named differently in every account
- cross-client benchmarks become impossible even when the business models are identical
- automation logic becomes brittle when field names drift between systems
- new implementations require custom mapping instead of inheriting an established standard

With this standard:

- all clients plug into the same reporting model
- Senzai can compare funnel quality, source performance, and revenue patterns across businesses
- client onboarding accelerates because the vocabulary is already defined
- tracking QA becomes a checklist, not a discovery exercise
- growth intelligence becomes reusable and compoundable across projects over time

This file is not a GA4 setup guide and not a Meta Ads naming convention document. It is the architectural tracking standard for all systems where Senzai v1 is the intelligence layer.

---

## 2. Core Principles

### Principle 1: Business meaning over tool-specific naming

Event names, field names, and vocabulary should describe what happened in the business, not which tool recorded it. `lead.created` is correct. `form_fill_step_3_v2_new` is not.

### Principle 2: Stable names over trendy names

A naming convention that changes every year breaks reporting continuity. Prefer names that will still be accurate and meaningful in three years. Avoid names tied to platform UI labels, which change frequently.

### Principle 3: Revenue-linked measurement over vanity metrics

Tracking infrastructure should ultimately be able to answer: what did each source, channel, and campaign produce in collected revenue? Impressions, sessions, and clicks are context; revenue is the business outcome.

### Principle 4: Reusable vocabulary across all clients

If a field name means `google` in one client and `Google Ads` in another, cross-client analysis is broken. The canonical controlled values defined here are mandatory, not suggestions.

### Principle 5: Operational truth preferred over platform assumptions

GA4 and Meta Ads dashboards contain self-reported, modeled, and estimated data. The app database contains authoritative transactional truth. When the two disagree, the database is the starting point for investigation.

### Principle 6: Canonical normalization before dashboarding

Raw UTM values should be stored as-is for debugging. Normalized canonical values should be derived and persisted immediately, before any dashboard or reporting query depends on them. Normalizing at query time is fragile.

### Principle 7: Attribution should survive tool changes

Google Analytics 4 will eventually be replaced by something else. Meta's attribution window will change again. A system whose entire attribution model lives inside vendor tools is one contract renewal away from losing its history. The canonical fields defined in this standard must be persisted in the application database regardless of which analytics platform the client uses.

---

## 3. Universal Entity Model

The following entities are the foundational objects tracked across all client systems. They appear in events, attribution records, and Senzai-bound payloads.

### Visitor

A user who has loaded a page on the client's public surface. No identity is known yet.

- Valid from: first page load
- Identifiers: `session_id` (analytics platform), `ga_client_id` if available, `fbp` if available
- Becomes a lead when contact information is captured

### Session

A single continuous interaction with the client's site or funnel. May span multiple pages within one visit.

- Valid from: first page load in a visit window
- Identifiers: `session_id`
- Attribution context is captured at the session level and inherited by leads created within it

### Lead

A person whose contact information has been captured by the system, before confirmed booking or payment.

- Valid from: lead record created in app database
- Identifiers: `lead_id` (UUID, app database), `email` (normalized)
- Stages: `lead`, `qualified`, `converted`, `lost`

### Customer

A person who has completed at least one paid booking.

- Valid from: first booking with deposit paid
- Identifiers: `customer_id` (UUID, app database), `stripe_customer_id`
- Distinguished from lead by the existence of a payment transaction

### Booking

A reservation for a specific service, date, location, and participant set.

- Valid from: booking row created in app database (pending state, before payment)
- Identifiers: `booking_id` (UUID, app database), `stripe_session_id`
- Authoritative confirmation: webhook-driven status update, not redirect success

### Payment

A financial transaction associated with a booking.

- Valid from: Stripe payment intent created or charge attempted
- Identifiers: `payment_intent_id`, `stripe_session_id`, `booking_id`
- Types: deposit, remaining balance, refund
- Source of truth: Stripe, mirrored to app database

### Campaign

A named marketing effort targeting a specific audience with specific creative and budget.

- Valid from: defined in the ad platform and referenced in UTM parameters
- Identifiers: `utm_campaign`, `campaign_type`, ad platform campaign ID if available
- Does not exist as a database entity unless the client implements a campaign registry

### Source

The origin of a visit, lead, or booking. Defined by the `traffic_source` canonical value, not by raw platform labels.

- Valid from: captured at session start and persisted to lead at creation
- Identifiers: `traffic_source`, `utm_source`

### Review

Feedback submitted by a customer following a completed service.

- Valid from: review submitted (external platform) or review flag set in app database
- Identifiers: `booking_id`, `customer_id`, platform review ID if available

### Service

The type of offering a customer books.

- Valid from: defined in the service/tour catalog
- Identifiers: `tour_id`, `trail_type`, `service_name`

### Location

The physical or virtual site where a service is delivered.

- Valid from: defined in the locations catalog
- Identifiers: `location_id`, `location_name`

### Call

A phone interaction initiated from the client's website or marketing.

- Valid from: call initiated via tracked number or click-to-call element
- Identifiers: call tracking session ID, `phone_number_dialed`, `source` at time of call

### Conversation

A structured interaction via chat, WhatsApp, or messaging channel.

- Valid from: conversation initiated via tracked widget or channel
- Identifiers: conversation ID from the messaging platform, `lead_id` if linked

---

## 4. Canonical Source Dictionary

These are the only acceptable values for normalized source fields. Raw UTM values may be stored separately but must be mapped to these canonical values before being persisted in normalized columns or forwarded to Senzai.

### traffic_source

Describes the origin of the visit or lead.

| Value | When to use |
|---|---|
| `google` | Google Search Ads, Google Shopping, Google Maps Ads |
| `meta` | Facebook or Instagram Ads, regardless of placement |
| `tiktok` | TikTok Ads |
| `youtube` | YouTube Ads or organic YouTube referrals |
| `bing` | Microsoft / Bing Ads |
| `organic` | Unpaid search from any search engine |
| `direct` | No referrer, typed URL, or dark social |
| `referral` | External website link with no UTM attribution |
| `email` | Email campaigns with tracked UTMs |
| `sms` | SMS campaigns with tracked UTMs |
| `partner` | Partner or affiliate traffic with agreed attribution |
| `offline` | In-person, phone, or event-driven leads with no digital origin |
| `unknown` | Source could not be determined from available signals |

Do not use values like `Google CPC`, `FB Ads`, `Paid - Meta`, or any variation. Use only the values listed above.

### traffic_medium

Describes the type of channel used.

| Value | When to use |
|---|---|
| `cpc` | Any paid search click (Google, Bing, or equivalent) |
| `paid_social` | Any paid social ad click (Meta, TikTok, YouTube, etc.) |
| `organic_search` | Unpaid search engine visits |
| `organic_social` | Unpaid social media visits |
| `referral` | External website link with no UTM |
| `direct` | Direct visit with no referrer |
| `email` | Email campaign with UTM |
| `sms` | SMS campaign with UTM |
| `display` | Display or banner ads |
| `retargeting` | Retargeting ads on any platform |
| `offline` | No digital medium |
| `unknown` | Medium could not be determined |

### campaign_type

Describes the strategic intent of the campaign.

| Value | When to use |
|---|---|
| `search` | Keyword-targeted search campaigns |
| `retargeting` | Audiences who have previously visited or interacted |
| `awareness` | Top-of-funnel brand or reach campaigns |
| `lead_gen` | Campaigns with explicit lead generation objective |
| `branded` | Campaigns targeting the client's own brand keywords |
| `local` | Geographically constrained local service campaigns |
| `seasonal` | Time-limited campaigns around events or seasons |
| `promo` | Discount or promotional offer campaigns |
| `nurture` | Follow-up sequences for existing leads or past customers |
| `unknown` | Campaign type not tagged or determinable |

### lead_channel

Describes the mechanism by which the lead record was created.

| Value | When to use |
|---|---|
| `web_form` | Lead capture form on the website |
| `booking_flow` | Lead captured partway through the booking wizard |
| `phone_call` | Lead created from a tracked inbound call |
| `whatsapp` | Lead created from a WhatsApp conversation |
| `chat` | Lead created from a live chat or chatbot interaction |
| `walk_in` | Lead created from an in-person or offline interaction |
| `referral_link` | Lead arrived via a tracked partner or referral link |
| `manual_import` | Lead created by staff import or manual entry |
| `unknown` | Channel not determinable |

---

## 5. Funnel Stage Dictionary

The following stages define the canonical customer journey. Every entity moves forward through these stages; stages are never skipped silently.

| Stage | Definition | Entered when |
|---|---|---|
| `visitor` | Person on the site with no identity captured | First page load in session |
| `engaged` | Visitor who has meaningfully interacted with the funnel | CTA click, form start, or significant scroll |
| `lead` | Contact information captured in the system | Lead record created in app database |
| `qualified` | Lead assessed as a likely buyer | Manual qualification flag, or scoring threshold passed |
| `booked` | Lead has completed a booking attempt | Booking row created, payment redirected |
| `deposit_paid` | Deposit payment confirmed by Stripe webhook | `checkout.session.completed` processed |
| `paid` | Deposit paid and booking confirmed | Equivalent to `deposit_paid` for most implementations |
| `completed` | Service has been delivered | Admin marks booking as completed |
| `repeat_customer` | Customer has completed more than one paid booking | Second confirmed booking with deposit paid |
| `refunded` | Payment was returned to the customer | Stripe refund processed and mirrored to booking |
| `lost` | Lead or customer will not progress further | Explicit lost flag or system-determined inactivity |

### Rules

- A lead does not become qualified automatically in most implementations. Qualification requires either a manual admin action or a scoring signal.
- `deposit_paid` and `paid` may be treated as the same stage in split-payment models, as long as the distinction between deposit and full collection is preserved elsewhere.
- `lost` may apply to leads who abandoned the funnel, declined to book, or are otherwise unreachable. The reason for loss should be captured separately when known.

---

## 6. Universal Event Naming Standard

All events in this system use the following naming convention:

```
entity.action
```

Both `entity` and `action` are lowercase. A single dot separates them. No spaces, no hyphens, no underscores, no camelCase.

### Correct examples

```
lead.created
lead.qualified
lead.converted
booking.started
booking.created
booking.confirmed
booking.completed
booking.cancelled
booking.refunded
payment.deposit_requested
payment.deposit_succeeded
payment.deposit_failed
payment.remaining_balance_requested
payment.remaining_balance_succeeded
payment.remaining_balance_failed
payment.refunded
review.request_enrolled
review.request_sent
review.received
call.started
call.connected
call.missed
customer.repeat_purchase
session.started
session.abandoned
```

### Incorrect examples — do not use

```
LeadCreated
lead_created
newLead
formComplete
bookingConfirmed_v2
DepositPaid_Stripe
lead.Form.Submitted
```

### Why dot notation

Dot notation makes event names parseable programmatically. An event can be decomposed into its entity and action without regex. `lead.created` is unambiguous across GA4 custom events, Senzai ingestion, n8n triggers, and database log entries.

---

## 7. Approved Action Verbs

Only these verbs are permitted in event names. If a new action does not fit any of the approved verbs, document the reason and extend this list deliberately rather than improvising.

| Verb | Meaning |
|---|---|
| `created` | A new record came into existence |
| `updated` | An existing record changed in a significant way |
| `started` | A process or flow began |
| `completed` | A process or flow reached its intended end |
| `confirmed` | An external system or authority validated the state |
| `qualified` | A record met a defined qualification threshold |
| `converted` | A lead became a customer or a booking became paid |
| `requested` | An action was initiated but not yet completed |
| `succeeded` | An attempted action produced the expected result |
| `failed` | An attempted action did not produce the expected result |
| `cancelled` | A record or process was stopped before completion |
| `refunded` | Money was returned after a successful payment |
| `sent` | An outbound communication was dispatched |
| `received` | An expected input was received from an external party |
| `connected` | Two systems or parties established contact |
| `scheduled` | A future action was formally set |
| `enrolled` | A record was added to a sequence or automation |
| `retried` | A previously failed action was attempted again |
| `lost` | A lead or opportunity was marked as no longer viable |
| `abandoned` | A user left a flow before completing it |

---

## 8. Standard Tracking Events (Behavioral)

These events represent front-end and funnel behavioral signals. They are best-effort UX telemetry and should not be treated as authoritative financial or booking state.

They are appropriate for:

- GA4 custom events
- GTM dataLayer pushes
- Meta Pixel custom events
- analytics platform conversion proxies

They are not appropriate for:

- confirming bookings
- triggering payment records
- driving operational database state

### Acquisition and landing events

| Event name | Trigger |
|---|---|
| `page_view` | Any page loaded |
| `landing_view` | The primary acquisition landing page loaded |
| `cta_clicked` | A primary call-to-action button was clicked |
| `service_viewed` | A specific service detail page or section was viewed |
| `gallery_viewed` | An image gallery was opened or scrolled through |
| `map_viewed` | A meeting location map was opened |
| `scroll_50` | User scrolled past the 50% mark of a page |
| `scroll_90` | User scrolled past the 90% mark of a page |
| `faq_opened` | A FAQ item was expanded |

### Lead and form events

| Event name | Trigger |
|---|---|
| `form_started` | User began entering data into a lead capture form |
| `form_submitted` | User submitted a lead capture form (client-side) |
| `lead_submitted` | Lead was accepted and persisted server-side |

### Booking funnel events

| Event name | Trigger |
|---|---|
| `booking_started` | User initiated the booking flow |
| `booking_step_completed` | User completed a step in the booking wizard |
| `checkout_started` | User was redirected to the Stripe checkout page |

### Contact and engagement events

| Event name | Trigger |
|---|---|
| `call_clicked` | User clicked a phone number link |
| `whatsapp_clicked` | User clicked a WhatsApp link |
| `chat_started` | User initiated a chat interaction |
| `directions_clicked` | User clicked a map or directions link |

### Post-service events

| Event name | Trigger |
|---|---|
| `review_prompt_viewed` | User saw a review request prompt |
| `review_link_clicked` | User clicked a review platform link |

### Behavioral tracking parameters

When emitting behavioral tracking events to analytics platforms, attach the following parameters when available:

- `traffic_source` — canonical value
- `traffic_medium` — canonical value
- `campaign_type` — canonical value
- `lead_channel` — canonical value where applicable
- `page_path` — the current URL path
- `funnel_step` — the specific step name when inside a booking or lead flow

---

## 9. Standard Business Events (Authoritative)

These events represent authoritative state transitions sourced from verified operational systems. They are not analytics approximations. They describe what the system confirmed, not what the user clicked.

Sources for authoritative events:

- Supabase: booking creation, lead creation, status transitions, admin actions
- Stripe webhook: payment confirmation, failure, refund
- Backend route processing: cron charge outcomes, retry outcomes

### Lead lifecycle (authoritative)

| Event name | Source | When |
|---|---|---|
| `lead.created` | App DB — `/api/leads` route | Lead record inserted |
| `lead.progressed` | App DB — lead step update | Last step completed updated |
| `lead.qualified` | App DB — admin action or scoring | Qualification flag set |
| `lead.follow_up_enrolled` | App DB — follow-up enrollment | Follow-up sequence started |
| `lead.follow_up_sent` | n8n callback | Follow-up communication delivered |
| `lead.converted` | App DB — Stripe webhook | Lead status set to converted after booking confirmed |
| `lead.lost` | App DB — admin action or inactivity | Lead status set to lost |

### Booking lifecycle (authoritative)

| Event name | Source | When |
|---|---|---|
| `booking.created` | App DB — checkout route | Pending booking row inserted |
| `booking.confirmed` | Stripe webhook + App DB | `checkout.session.completed` processed |
| `booking.updated` | App DB — admin action | Status or field changed |
| `booking.completed` | App DB — admin action | Service delivered, marked complete |
| `booking.cancelled` | App DB — admin or webhook | Cancelled by admin or expired session |
| `booking.refunded` | Stripe webhook + App DB | Refund processed and mirrored |

### Payment lifecycle (authoritative)

| Event name | Source | When |
|---|---|---|
| `payment.deposit_requested` | App DB — checkout session created | Stripe session created with booking |
| `payment.deposit_succeeded` | Stripe webhook | `checkout.session.completed` processed |
| `payment.deposit_failed` | Stripe webhook | Session expired without payment |
| `payment.remaining_balance_requested` | App DB — cron or admin retry | Off-session charge initiated |
| `payment.remaining_balance_succeeded` | Stripe webhook + App DB | Off-session PI succeeded |
| `payment.remaining_balance_failed` | Stripe webhook + App DB | Off-session PI failed |
| `payment.refunded` | Stripe webhook + App DB | Refund confirmed |

### Post-service lifecycle (authoritative)

| Event name | Source | When |
|---|---|---|
| `review.request_enrolled` | App DB | Review request sequence started |
| `review.request_sent` | n8n callback | Review request communication delivered |
| `review.received` | App DB — admin action | Review confirmed received |
| `customer.repeat_purchase` | App DB | Second confirmed booking recorded for the same customer |

### Reconciliation lifecycle (authoritative)

| Event name | Source | Severity |
|---|---|---|
| `reconciliation.payment_without_booking` | App DB — webhook | Critical |
| `reconciliation.missing_payment_method` | App DB — cron | Error |
| `reconciliation.charge_claimed_by_concurrent_run` | App DB — cron | Warning |
| `reconciliation.stuck_processing_cleared` | App DB — cron recovery | Warning |

### Rules for authoritative events

- Authoritative events must never be fired from the browser alone.
- If an authoritative event depends on a Stripe webhook, the event is only emitted after the webhook is verified and the database is updated.
- Authoritative events should carry an idempotency key that prevents duplicate records even when the triggering system retries.
- Senzai should receive authoritative events, not behavioral tracking events.

---

## 10. Attribution Contract

The following fields define what attribution data must be captured and persisted at the lead, booking, and customer level. These fields must be stored in the application database and must not exist exclusively inside analytics platform dashboards or cookies.

### Raw inbound values

Captured from URL parameters at session start. Stored as-is for debugging and audit.

| Field | Source |
|---|---|
| `utm_source` | URL parameter |
| `utm_medium` | URL parameter |
| `utm_campaign` | URL parameter |
| `utm_term` | URL parameter |
| `utm_content` | URL parameter |
| `gclid` | Google click identifier, from URL parameter |
| `gbraid` | Google app conversion parameter, from URL parameter |
| `wbraid` | Google web conversion parameter, from URL parameter |
| `fbclid` | Meta click identifier, from URL parameter |
| `referrer_url` | Document referrer at session start |
| `landing_page_path` | URL path of the first page loaded in the session |

### Normalized canonical values

Derived from raw inbound values using the controlled vocabularies in section 4. These are the fields used for reporting and Senzai event payloads.

| Field | Derived from | Values |
|---|---|---|
| `traffic_source` | `utm_source` → normalized | See section 4 |
| `traffic_medium` | `utm_medium` → normalized | See section 4 |
| `campaign_type` | `utm_campaign` pattern → classified | See section 4 |
| `lead_channel` | How the lead was created | See section 4 |

### Attribution timing

| Field | When captured |
|---|---|
| `first_touch_attribution` | Full attribution snapshot at the first known visit or session |
| `last_touch_attribution` | Full attribution snapshot at the moment of lead creation or conversion |
| `attribution_updated_at` | Timestamp when last-touch was last refreshed |

### Session and device context

| Field | Notes |
|---|---|
| `session_id` | Optional but useful for linking behavioral events to lead records |
| `device_type` | `desktop`, `mobile`, or `tablet` — derived from user agent |
| `geo_region` | State or country, when relevant to local business reporting |

### Attribution storage rules

- Store raw inbound values immediately when the session begins.
- Derive and store normalized canonical values before the lead record is created.
- Do not normalize at query time. Normalization must happen at write time.
- When a booking is created from a lead, snapshot the lead's last-touch attribution into the booking's `attribution_snapshot` field.
- Do not depend on joining back to the lead to determine booking attribution at reporting time. The snapshot on the booking must be self-contained.
- Attribution data must remain in the database even if the analytics platform account is closed, rotated, or migrated.

---

## 11. KPI Definitions

The following definitions are canonical. Future dashboards, reports, and Senzai-bound analytics events must use these exact meanings. Divergence between implementations makes cross-client benchmarks meaningless.

### Acquisition funnel metrics

| KPI | Exact definition |
|---|---|
| `sessions` | Distinct visit sessions recorded by the analytics platform during the period |
| `qualified_visits` | Sessions where the user reached at least the lead or booking entry point |
| `leads` | Lead records created in the app database during the period |
| `qualified_leads` | Leads with a qualification flag set, or leads that progressed past a defined scoring threshold |

### Conversion metrics

| KPI | Exact definition |
|---|---|
| `bookings` | Booking rows created in the app database during the period, in any status |
| `confirmed_bookings` | Bookings where `status = confirmed` as of the measurement date |
| `paid_bookings` | Bookings where `deposit_payment_status = paid` |
| `completed_services` | Bookings where `status = completed` |
| `repeat_customers` | Customers with two or more confirmed bookings with deposit paid |

### Efficiency metrics

| KPI | Exact definition |
|---|---|
| `lead_to_booking_rate` | `confirmed_bookings` divided by `leads` for the same period |
| `booking_to_paid_rate` | `paid_bookings` divided by `confirmed_bookings` for the same period |
| `conversion_rate_by_source` | `lead_to_booking_rate` segmented by `traffic_source` |
| `cost_per_lead` | Total ad spend for the period divided by `leads` |
| `cost_per_booking` | Total ad spend for the period divided by `confirmed_bookings` |
| `repeat_rate` | `repeat_customers` divided by total unique customers with at least one completed service |

### Revenue metrics

| KPI | Exact definition |
|---|---|
| `collected_revenue` | Sum of deposit amounts paid plus remaining balance amounts paid, for bookings confirmed in the period. Excludes refunded amounts. |
| `projected_remaining_revenue` | Sum of `remaining_balance_amount` for bookings where `remaining_balance_status = pending` |
| `failed_charge_revenue_at_risk` | Sum of `remaining_balance_amount` for bookings where `remaining_balance_status = failed` |
| `collected_revenue_by_source` | `collected_revenue` grouped by `attribution_snapshot.traffic_source` |
| `collected_revenue_by_campaign` | `collected_revenue` grouped by `attribution_snapshot.utm_campaign` |

### Critical revenue semantics rule

`collected_revenue` is the only revenue metric that should be treated as a business outcome.

Pipeline value, theoretical booking value, and pending balance are useful for forecasting but must never be labeled or reported as revenue. The operational definition of revenue in this standard is: money that Stripe has confirmed as collected and that the database reflects as paid.

---

## 12. Cross-System Source of Truth

When data across systems disagrees, the following table defines which system is authoritative for each concern. Disputes should be investigated starting from the authoritative system.

| Concern | Source of truth | Notes |
|---|---|---|
| Traffic and session counts | Analytics platform (GA4 or equivalent) | Sampled and estimated; not suitable for financial reconciliation |
| Lead existence | App database | Lead table is authoritative from creation |
| Lead source attribution | App database | Normalized fields stored at creation time |
| Booking existence | App database | Booking row created before payment redirect |
| Booking confirmation | Stripe webhook + app database | Redirect success alone is not confirmation |
| Deposit payment success | Stripe | App database mirrors after verified webhook |
| Remaining balance outcome | Stripe | App database mirrors through webhook or retry flow |
| Payment display in admin | App database | Synchronized from Stripe outcomes |
| Financial audit trail | App database `financial_event_logs` | Append-only ledger |
| Revenue by source | App database + `attribution_snapshot` | Source-to-revenue joins using persisted attribution fields |
| Ad spend | Ad platform APIs (Google Ads, Meta Ads) | External to the app; must be imported or reconciled manually |
| Conversion signal (ad optimization) | App database → ad platform sync | Server-to-server events or offline conversion uploads are more reliable than pixel-only attribution |
| Cross-client funnel intelligence | Senzai v1 | Normalized events from all clients; not raw platform data |
| Operational support context | App database + admin surface | Support should not need to query vendor dashboards for basic case resolution |
| Calendar fulfillment | Calendar provider (Cal.com or equivalent) | Downstream of app booking; not authoritative for booking existence |

---

## 13. Required Tracking Stack Standard

### Baseline — required for all client projects before launch

| Component | Purpose |
|---|---|
| Google Analytics 4 | Behavioral analytics, audience creation, funnel visibility |
| Google Tag Manager | Tag management, conversion event firing, dataLayer integration |
| Google Search Console | Organic search visibility, index health, query data |
| App-database attribution persistence | Normalized source fields stored at lead and booking level |
| Senzai-compatible acquisition context | Normalized source metadata forwarded with authoritative events |

### Extended — required when paid acquisition is active

| Component | When required |
|---|---|
| Meta Pixel | When Meta (Facebook/Instagram) is an active acquisition channel |
| Meta Conversions API (CAPI) | When Meta is a primary paid channel; reduces signal loss from browser privacy restrictions |
| Google Ads offline conversion sync | When Google Ads drives significant booking volume; sends confirmed bookings back to Google for optimization |
| Call tracking integration | When phone calls represent a meaningful lead channel |

### Advanced — evaluate based on client scale and margin

| Component | When to evaluate |
|---|---|
| Server-side Google Tag Manager | When client-side tracking signal is degrading; when CAPI requires server-side relay |
| TikTok Pixel + Events API | When TikTok is an active acquisition channel |
| Bing / Microsoft Ads UET | When Bing drives meaningful traffic |
| Multi-touch attribution tool | When the client needs to model assisted conversions across a long funnel |
| Predictive lead scoring | When lead volume is high enough to benefit from ML-assisted qualification |

### Selection criteria

Do not add tracking components to every project by default. Add only the components that correspond to active channels.

A client spending nothing on Meta Ads does not need a Meta Pixel configured for conversion optimization. A client with zero phone leads does not need call tracking.

The baseline components are non-negotiable regardless of channel mix, because GA4, GTM, and app-level attribution apply to all web-based projects.

---

## 14. Implementation Rules For New Clients

These rules are mandatory. They are not preferences.

1. Every client project must define its canonical acquisition vocabulary before implementation begins. The canonical values in section 4 are the default. Client-specific extensions must be documented explicitly.

2. No custom conversion event names are permitted without a documented reason and a mapping to the canonical event vocabulary. A note in the project's `PROJECT.md` or a comment in GTM is sufficient documentation.

3. Every lead capture path must preserve source context at the database level when present. If a user arrives via a UTM-tagged URL and submits a form, the normalized `traffic_source` and `traffic_medium` must appear on the persisted lead record.

4. Every booking must inherit or snapshot the lead's attribution context at creation time. The booking `attribution_snapshot` field is the mechanism. It must be populated regardless of whether the lead was formally linked.

5. Dashboards and reporting queries must consume normalized canonical fields, not raw UTM strings. Raw UTM values may be stored for debugging but must not be the primary reporting dimension.

6. Source names must not vary across client projects. `google` is always `google`. `meta` is always `meta`. If a client insists on different naming in their ad platform account labels, the canonical normalized value still applies in the app database and Senzai events.

7. Events bound for Senzai must carry normalized acquisition context when it is available on the entity. A `lead.created` event should include `traffic_source`, `traffic_medium`, and `lead_channel` when those fields are known.

8. Authoritative events must not be fired client-side. The browser may fire a behavioral proxy event for analytics platforms, but the authoritative Senzai-bound event must come from the server.

9. Attribution data must survive a tool change. If the client migrates from GA4 to another analytics platform, the attribution stored in the app database must remain intact and queryable.

10. Revenue KPIs presented to clients must use the `collected_revenue` definition from section 11. Pipeline value may be shown as a secondary metric but must be clearly labeled as projected, not collected.

---

## 15. QA and Go-Live Checklist

Before declaring a client project's tracking implementation complete, validate each item in this checklist end to end in production or a production-equivalent environment.

### Analytics platform

- GA4 tag installed exactly once per page; no duplicate pageview firing on navigation
- GTM container published and confirmed firing in Preview mode
- At least one custom conversion event visible in GA4 realtime reports
- No `measurement_id` mismatch between GTM tag and GA4 property

### Lead tracking

- `form_started` event fires when the form begins
- `lead_submitted` event fires after successful server-side lead creation, not only on form submit
- Normalized `traffic_source` and `traffic_medium` visible on the persisted lead record in Supabase after a test submission from a UTM-tagged URL
- Direct submission (no UTM) stores `unknown` or `direct` rather than null

### Booking and payment tracking

- `booking_started` event fires when the booking flow begins
- `checkout_started` event fires when the Stripe checkout redirect occurs
- `payment.deposit_succeeded` authoritative event fires after webhook processing, not on redirect
- `booking.confirmed` authoritative event reaches Senzai with normalized acquisition context attached
- No duplicate payment events from both client-side and server-side paths

### Attribution

- `first_touch_attribution` persisted to lead on creation
- `last_touch_attribution` updated when lead progresses to checkout
- Booking `attribution_snapshot` populated at booking creation time
- At least one confirmed booking queryable by `attribution_snapshot.traffic_source` in Supabase

### Revenue traceability

- A test booking from a UTM-tagged URL can be traced from GA4 → lead record → booking record → Stripe payment → Senzai event using a single `booking_id`
- `collected_revenue` metric computable from Supabase without requiring a GA4 or Stripe dashboard export

### Senzai

- Senzai receives at least `lead.created` and `booking.confirmed` with normalized source context
- Idempotency keys present and stable on Senzai-bound events
- At least one full end-to-end flow validated in a production-like Senzai environment

### If Meta Pixel is implemented

- Pixel fires confirmed in Meta Events Manager
- If CAPI is active: server-side event deduplication confirmed against browser pixel events
- Conversion event visible in Meta Ads Manager test events tool

### If Google Ads offline conversions are implemented

- Conversion upload confirmed as received in Google Ads conversion dashboard
- GCLID captured from the landing URL and stored on the lead record when present

---

## 16. Future Expansion — Reserved Sections

The following areas are not yet standardized in V1 but are reserved for future versions of this dictionary. Do not invent local standards for these topics in client projects. Wait for the canonical version or document explicitly that a temporary non-standard approach is in use.

### Call intelligence

- Canonical call tracking event vocabulary
- Lead attribution model for phone-originated leads
- Call outcome dictionary: `answered`, `missed`, `voicemail`, `converted`
- Integration pattern for call tracking platforms

### AI agent and chat attribution

- Attribution model for leads originated through AI assistants or chatbots
- Handoff event between AI conversation and human or booking flow
- Canonical `lead_channel` extension for conversational AI

### LTV cohorts

- Canonical LTV definition per client type
- Cohort grouping strategy by acquisition source
- Repeat customer segmentation for cross-client Senzai modeling

### Churn and loss scoring

- Canonical loss reason dictionary
- Inactivity thresholds by client type
- Predictive churn signal events

### Multi-touch attribution

- Canonical model for assigning credit across first touch, last touch, and assisted touches
- Standard for persisting assisted touches to the lead record
- Senzai event extensions for multi-touch context

### Predictive lead scoring

- Feature definitions for scoring models
- Score persistence model in the app database
- Canonical event for `lead.score_updated`

---

## 17. Final Standard

Future client projects should not invent their own tracking language.

The cost of custom naming per client is not a one-time setup cost. It is a permanent tax on every reporting query, every cross-client comparison, every Senzai intelligence operation, and every new team member who has to learn yet another set of project-specific conventions.

Naming is architecture. A `traffic_source` value of `google` across fifty clients is infrastructure. Fifty different labels for the same concept across fifty clients is debt.

The purpose of this dictionary is to eliminate that debt before it accumulates.

Every future system built on the Senzai architecture should inherit this vocabulary as a starting constraint, extend it deliberately when necessary, and never replace it casually.

The tracking language defined here is not a preference. It is the operating language of a shared intelligence layer.

---

## Recommended Repo Usage

This file should be referenced in the following contexts across all future client projects:

### New client onboarding

Reference this document during the client configuration phase (see `BLUEPRINT_CLIENT_IMPLEMENTATION.md` section 45). Use the canonical source dictionary to populate the marketing and tracking section of the client configuration matrix before implementation begins.

### GTM implementation

Use the event names in sections 8 and 9 as the canonical GTM custom event names. GTM triggers should listen for these exact event names from the dataLayer. Do not invent GTM-specific event names.

### GA4 configuration

Use the event names in section 8 as GA4 custom event names. Use the KPI definitions in section 11 to configure GA4 custom definitions, explorations, and conversion goals. The `traffic_source` and `traffic_medium` canonical values should be used as custom dimensions rather than relying on GA4's default channel groupings.

### Dashboard schema

When building reporting dashboards (Looker Studio, Metabase, or similar), use the normalized field names from section 10 as the primary reporting dimensions. Build queries against `attribution_snapshot.traffic_source`, not against raw `utm_source` strings.

### CRM and n8n field mapping

When mapping app database fields to CRM records or n8n automation payloads, use the canonical field names from section 10. Canonical values should be forwarded as-is, not reformatted.

### Ad integrations

When configuring Google Ads offline conversion uploads or Meta CAPI events, use the event names from section 9 as the conversion names. Use `traffic_source` and `traffic_medium` canonical values as the basis for campaign segment labeling in reports.

### Senzai ingestion logic

When building or reviewing Senzai event emission code, verify that:

- event names match the vocabulary in sections 6 and 9
- `refs` include the relevant entity identifiers from section 3
- `data` payloads include normalized acquisition context fields from section 10
- idempotency keys follow the pattern `entity:id:event_name`

### Quality assurance reviews

Use section 15 as the QA checklist for any tracking implementation before go-live. Items in this checklist are not optional; they define the minimum acceptable state for a blueprint-compliant tracking implementation.

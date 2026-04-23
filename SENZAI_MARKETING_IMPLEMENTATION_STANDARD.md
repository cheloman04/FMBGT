# Senzai Marketing Implementation Standard

> Companion document to `BLUEPRINT_CLIENT_IMPLEMENTATION.md` and `SENZAI_UNIVERSAL_TRACKING_DICTIONARY_V1.md`.
> Version: 1.0
>
> **Scope:** This document defines the marketing layer standard for all Senzai client implementations. It does not repeat core architecture (Blueprint) or tracking vocabulary (Tracking Dictionary). It governs how acquisition systems are built, how paid media is structured, how attribution data is managed, how performance is measured, and how cross-client marketing intelligence is produced inside Senzai.

---

## 1. Purpose of Marketing Layer

The client application converts visitors into customers.
The marketing system produces visitors worth converting.

These are not the same problem. Most client implementations get one right and ignore the other.

The Senzai marketing layer exists to ensure both problems are solved with the same rigor, and that the solution is not rebuilt from scratch for every new client.

**The marketing layer is responsible for:**

- Producing qualified acquisition traffic through paid and organic channels
- Capturing the source of every lead and booking with database-level fidelity
- Delivering clean, high-signal conversion data back to ad platforms for algorithm optimization
- Generating actionable performance reporting that connects spending to collected revenue
- Creating a data pipeline that feeds Senzai so cross-client intelligence compounds over time

**What this document does not cover:**

- Event naming vocabulary → see `SENZAI_UNIVERSAL_TRACKING_DICTIONARY_V1.md`
- App architecture, booking flows, payments, webhooks → see `BLUEPRINT_CLIENT_IMPLEMENTATION.md`
- Supabase schema, API route patterns, server-side event emission → see Blueprint

**What makes this document different:**

Every section is written to be reused. When a new Senzai client is onboarded, this document provides the default answer for every marketing infrastructure decision. Deviations require justification. The default is always this standard.

---

## 2. Multi-Client Standardization Philosophy

### 2.1 Why standardization is the moat

Senzai's long-term competitive advantage is not executing marketing well for one client.
It is accumulating normalized, cross-client marketing intelligence that no single client and no single agency can replicate.

That advantage compounds only if the data is comparable.

A `traffic_source: google` that means different things across five clients produces five isolated datasets. The same field meaning exactly the same thing across fifty clients produces a benchmark database that can answer questions no one client's data could answer alone.

**Standardization is not bureaucracy. It is the asset.**

### 2.2 The normalization contract

Every Senzai client marketing implementation must honor the following contract:

- **Same vocabulary.** Source, medium, campaign type, and lead stage values must use canonical controlled values from the Tracking Dictionary. No exceptions.
- **Same attribution logic.** First-touch and last-touch attribution must be captured, stored, and labeled identically. Attribution model choice may vary per client, but the data schema does not.
- **Same KPI definitions.** CVR, CPL, ROAS, and pipeline metrics must be calculated with the formulas defined in §12 of this document. Not approximations, not platform-reported substitutes.
- **Same lifecycle stages.** Visitor → Lead → Deposit Paid → Booking Confirmed → Service Delivered → Review Received must map to the same named stages across all clients, even if the business model uses different terminology.

### 2.3 Local adaptation within the standard

Industries differ. A guided tour client and a legal services client have different conversion values, funnel lengths, and traffic sources.

Local adaptation is permitted for:
- Campaign creative, messaging, and targeting
- Budget allocation across channels
- Platform selection based on where the audience exists
- Sales cycle length assumptions

Local adaptation is not permitted for:
- Event naming
- Source and medium taxonomy
- KPI formula definitions
- Attribution schema
- Senzai data pipeline field names

The principle: **what changes is the input; what never changes is the measurement framework.**

### 2.4 Long-term Senzai intelligence architecture

As client count grows, Senzai should be able to answer:

- Which acquisition channel produces the highest-value customers across all clients?
- Which funnel structure converts best for service businesses with a deposit model?
- What is the average time from first visit to booking across clients in the outdoor experience category?
- Which UTM campaign types produce customers who leave reviews at the highest rate?
- What CVR improvement predicts the most significant reduction in CPL?

None of these questions can be answered without standardization at the data layer.
This document is how Senzai builds that layer.

---

## 3. Acquisition Stack Standard

### 3.1 Mandatory stack for every client at launch

| Component | Tool | Purpose |
|---|---|---|
| Analytics platform | Google Analytics 4 | Behavioral tracking, funnel reporting, conversion signal |
| Tag management | Google Tag Manager | Future-ready ad platform tag deployment without code deploys |
| Paid search | Google Ads | Intent-based acquisition |
| Landing page | Client app (Next.js or equivalent) | Primary conversion surface |
| Database attribution | Supabase (leads + bookings tables) | Authoritative source-to-revenue join |
| Conversion API | GA4 Measurement Protocol (server-side) | Supplement client-side tracking after iOS restrictions |

### 3.2 Conditional stack additions

| Component | Tool | When to Add |
|---|---|---|
| Paid social | Meta Ads | When audience research confirms demand on social platforms |
| Meta Pixel + CAPI | Meta | Same trigger as above |
| Email marketing | Active Campaign / Klaviyo | When lead nurture sequence is part of the acquisition strategy |
| SMS follow-up | n8n + Twilio | When booking confirmation requires manual follow-up |
| Review acquisition | n8n automated review request | After first 5 confirmed bookings |
| Retargeting | Google Display + Meta | After 500+ monthly site visitors |
| YouTube Ads | Google Ads (video campaign) | When video assets exist and monthly budget exceeds $3,000 |

### 3.3 Stack sequencing rule

Launch with the minimum viable stack.
Add complexity only when the simpler layer is performing and producing reliable data.

A client with $500/month in ad budget does not need Meta CAPI on day one.
A client with $10,000/month and a 6-week sales cycle does.

Do not pre-build marketing infrastructure for channels that are not yet active.
Pre-built infrastructure with no traffic produces misleading baseline data and creates maintenance burden.

---

## 4. Google Ads Implementation Standard

### 4.1 Account structure

Every client Google Ads account must follow a consistent hierarchy:

```
Account
└── Campaign (by intent tier)
    └── Ad Group (by keyword theme)
        └── Ads (RSA format, minimum 3 per ad group)
```

**Intent tiers:**

| Tier | Campaign Name Format | Keyword Intent | Match Types |
|---|---|---|---|
| 1 — Brand | `[CLIENT] — Brand` | Client name + brand variants | Exact, Phrase |
| 2 — High intent | `[CLIENT] — [Service] — High Intent` | "book", "hire", "near me", "guided" | Exact, Phrase |
| 3 — Category | `[CLIENT] — [Category] — Informational` | Category terms without booking intent | Phrase, Broad (with Smart Bidding) |
| 4 — Competitor | `[CLIENT] — Competitor` | Competitor brand names | Exact only |

**Campaign naming convention:**
```
[CLIENT_CODE] — [CHANNEL] — [INTENT_TIER] — [LOCATION] — [DATE_LAUNCHED]

Example:
FMBGT — GSN — HighIntent — CentralFlorida — 2026Q2
```

### 4.2 Bidding strategy standard

| Phase | Condition | Recommended Strategy |
|---|---|---|
| Launch (0–30 days) | < 30 conversions/month | Maximize Clicks with CPC cap |
| Growth (30–90 days) | 30–80 conversions/month | Target CPA with conservative target |
| Scale (90+ days) | > 80 conversions/month, value data clean | Target ROAS |
| Mature | Stable revenue signal from database | Target ROAS with value-based bidding |

**Never launch Target ROAS before conversion value data is clean.**
A ROAS bid strategy trained on bad conversion values optimizes toward the wrong outcomes and degrades performance silently.

### 4.3 Conversion tracking standard

Every Google Ads account must configure conversions in this order of priority:

**Priority 1 — Revenue-linked conversions (import from GA4)**
- `booking_completed` → assigned conversion value = actual booking revenue
- `checkout_started` → secondary signal, value = average booking revenue × 0.6

**Priority 2 — Lead signals (import from GA4)**
- `lead_captured` → value = estimated lead value based on historical CVR × average revenue

**Priority 3 — Micro-conversions (observe only, do not bid on)**
- `booking_step_completed` (all steps) → for funnel analysis only
- `cta_clicked` → for creative quality analysis only

**Bidding must always optimize toward Priority 1 conversions.**
Never set a micro-conversion as a primary bidding signal. Doing so trains the algorithm to produce clicks, not revenue.

### 4.4 Conversion value rules

Conversion values passed to Google Ads must use collected revenue, not theoretical booking value.

| Conversion event | Value to pass | Source |
|---|---|---|
| `booking_completed` | `booking.deposit_amount` at minimum; `booking.total_price` preferred | App database |
| `checkout_started` | 0 (used as signal only, no value) | GA4 behavioral event |
| `lead_captured` | Estimated value based on rolling 30-day CVR × avg revenue | Calculated |

Revenue values must be passed in the currency configured in the Google Ads account.
Do not pass revenue in cents. Pass in dollars.

### 4.5 Google Ads connection to GA4

- Link Google Ads to GA4 via the Google Ads linked account connection
- Import GA4 conversion events as Google Ads conversions (do not create parallel Google Ads tags)
- Enable auto-tagging in Google Ads (GCLID appended to all URLs)
- Confirm GCLID is being passed through the booking funnel and is not stripped by redirects

### 4.6 Audience strategy

**Remarketing audiences (create at launch, use when volume allows):**

| Audience | Definition | Use |
|---|---|---|
| All site visitors (7 day) | Any session | Broad retargeting |
| Booking funnel — started | Fired `booking_started` | Strong retargeting |
| Booking funnel — abandoned | Fired `checkout_started` but not `booking_completed` | Highest intent retargeting |
| Converted customers | Fired `booking_completed` | Lookalike seed, exclusion from acquisition |

Exclude converted customers from all top-of-funnel acquisition campaigns.
Include them in upsell or repeat-booking campaigns if the business has that model.

---

## 5. Meta Ads Implementation Standard (Future-Ready)

### 5.1 When to activate Meta

Meta Ads should be activated when:

- Monthly Google Ads spend is stable and producing measurable revenue
- Creative assets (photos, video, testimonials) exist for the client
- Audience research confirms the target demographic is active on Instagram or Facebook
- Monthly budget allows at least $1,500 dedicated to Meta without pulling from Google

Do not activate Meta to "diversify" when Google is not yet optimized.
Meta requires creative production overhead. Premature activation splits attention before a single channel is proven.

### 5.2 Meta Pixel + CAPI standard

**Client-side Pixel:**
- Install via GTM using the standard Meta Pixel base code tag
- Fire `PageView` on all pages
- Fire `Lead` when `lead_captured` event fires
- Fire `InitiateCheckout` when `checkout_started` event fires
- Fire `Purchase` when `booking_completed` event fires with value and currency

**Conversions API (CAPI — server-side):**
- Implement CAPI for `Purchase` events via the n8n automation layer or direct API call from the Stripe webhook handler
- CAPI `Purchase` must be deduplicated using `event_id` matching the client-side Pixel `Purchase` event
- Use the SHA-256 hashed email, phone, and name from the booking record as user data for match rate

**Why CAPI is non-negotiable for purchases:**
iOS restrictions cause client-side Pixel to miss 20–40% of purchases depending on browser and user settings. CAPI closes that gap. Revenue attribution in Meta will be materially wrong without it.

### 5.3 Campaign structure standard

```
Account
└── Campaign (by objective and audience temperature)
    └── Ad Set (by audience targeting)
        └── Ads (by creative variant)
```

| Campaign Type | Objective | Audience Temperature |
|---|---|---|
| Prospecting | Sales or Leads | Cold (interest, lookalike) |
| Retargeting — engaged | Sales | Warm (site visitors, funnel starters) |
| Retargeting — abandoned | Sales | Hot (checkout started, not completed) |
| Lookalike | Sales | Warm-cold (LAL from converter seed) |

**Meta campaign naming convention:**
```
[CLIENT_CODE] — [OBJECTIVE] — [AUDIENCE_TEMP] — [CREATIVE_TYPE] — [DATE]

Example:
FMBGT — SALES — COLD — VideoTestimonial — 2026Q3
```

### 5.4 Meta conversion event mapping

| Meta standard event | Senzai canonical event | Trigger |
|---|---|---|
| `ViewContent` | `booking_step_view` (trail step) | First booking step viewed |
| `Lead` | `lead_captured` | Lead record created in DB |
| `InitiateCheckout` | `checkout_started` | Payment step validation passed |
| `Purchase` | `booking_completed` | Confirmation page load + CAPI from webhook |

### 5.5 Meta attribution window standard

- Reporting window: 7-day click, 1-day view
- Do not use 28-day click or 7-day view for primary reporting; they overcount
- Cross-reference Meta-reported revenue against database revenue monthly
- If Meta reports 2× more revenue than the database, CAPI deduplication is broken

---

## 6. GA4 + GTM Tracking Architecture

### 6.1 Layer responsibilities

The tracking architecture has three distinct layers. Each has a defined responsibility.

**Layer 1 — Direct GA4 (client-side, no GTM)**
Used for: core booking funnel events where precision and timing matter.

Events fired directly: `booking_started`, `booking_step_view`, `booking_step_completed`, `checkout_started`, `booking_completed`, `purchase`.

These events must not pass through GTM because GTM introduces timing variability and the funnel depends on them firing in the exact moment they occur.

**Layer 2 — GTM tags**
Used for: ad platform pixels (Meta, Google Ads remarketing), scroll depth, outbound link tracking, and any third-party tags that should not require code deployments.

GTM tags must not duplicate events already fired directly in Layer 1. GTM should listen for the GA4 events via the dataLayer and fire ad platform tags in response. GTM is the router, not the source.

**Layer 3 — Server-side (Senzai / GA4 Measurement Protocol)**
Used for: authoritative lifecycle events after Stripe webhook confirmation. `booking.confirmed`, `payment.deposit_succeeded`.

These are not behavioral signals. They are ground truth. They cannot be fired client-side because the client cannot be trusted to know when Stripe actually succeeded.

### 6.2 GTM container naming standard

```
GTM Container Name: [CLIENT_CODE] — [ENVIRONMENT]

Examples:
FMBGT — Production
FMBGT — Staging
```

### 6.3 GTM tag naming standard

All GTM tags must follow this naming convention:

```
[PLATFORM] — [EVENT_NAME] — [TRIGGER_CONDITION]

Examples:
GA4 — scroll_depth — 50pct reached
Meta Pixel — Lead — lead_captured GA4 event
Google Ads — Remarketing — all pages
Meta Pixel — Purchase — booking_completed GA4 event
```

### 6.4 GTM trigger naming standard

```
[TYPE] — [CONDITION]

Examples:
GA4 Event — booking_completed
DOM Ready — all pages
Click — CTA buttons
Timer — 30 seconds engaged
```

### 6.5 GA4 property configuration standard

The following must be configured in every GA4 property before campaigns launch:

**Admin settings:**
- Data retention: 14 months (default is 2 months — change this immediately)
- Enable Google Signals for remarketing audience building
- Link to Google Ads account
- Enable enhanced measurement (scroll, outbound clicks, video, file downloads)

**Conversion setup:**
- Mark `booking_completed` as a conversion event
- Mark `checkout_started` as a conversion event (secondary)
- Mark `lead_captured` as a conversion event (if lead capture step exists)
- Do not mark micro-conversions (step views, CTA clicks) as conversions

**Custom dimensions (register before campaign launch):**

| Dimension name | Scope | Senzai field |
|---|---|---|
| `booking_flow_variant` | Event | `booking_flow_variant` |
| `trail_type` | Event | `trail_type` |
| `location_name` | Event | `location_name` |
| `traffic_source` | Event | `traffic_source` |
| `traffic_medium` | Event | `traffic_medium` |
| `tenant_name` | Event | `tenant_name` |

**Why custom dimensions matter:**
GA4's built-in session source/medium tracking does not survive Stripe redirects. The Senzai `traffic_source` and `traffic_medium` fields, persisted via sessionStorage and attached to every event, are the mechanism that ensures source attribution is present on the `purchase` event even after the Stripe redirect round-trip.

---

## 7. Attribution Persistence Rules

Attribution is not a reporting feature. It is operational infrastructure. It must be persisted to the application database at lead creation, not reconstructed from platform reports later.

### 7.1 Mandatory attribution fields on lead record

When a lead is created (whether via lead capture form or first booking step), the following attribution fields must be written to the database:

| Field | Source | Required |
|---|---|---|
| `utm_source` | URL parameter (raw) | Yes |
| `utm_medium` | URL parameter (raw) | Yes |
| `utm_campaign` | URL parameter (raw) | Yes |
| `utm_term` | URL parameter (raw) | No (keyword-level optional) |
| `utm_content` | URL parameter (raw) | No |
| `traffic_source` | Normalized from `utm_source` | Yes |
| `traffic_medium` | Normalized from `utm_medium` | Yes |
| `referrer_url` | `document.referrer` | Yes |
| `landing_page_path` | `window.location.pathname + search` | Yes |
| `first_touch_attribution` | Captured at first session start | Yes |
| `last_touch_attribution` | Captured at lead creation | Yes |

### 7.2 Attribution capture timing

Attribution must be captured as early as possible in the session, before any navigation or redirect can destroy the URL parameters.

**Correct order:**
1. User lands on site with UTM parameters in URL
2. `captureAcquisitionContext()` fires on page load (landing page or booking entry)
3. UTMs are parsed, normalized, and stored in `sessionStorage` immediately
4. When lead is created, `getAcquisitionContext()` reads from sessionStorage
5. Attribution fields are written to the leads table

**Failure mode to prevent:**
User lands → clicks to a different page → UTMs are no longer in URL → lead is created → attribution is empty.

This is prevented by the sessionStorage persistence pattern. The raw URL is only available once. sessionStorage bridges it to the server call.

### 7.3 First-touch vs last-touch

Both must be stored. Neither should be discarded.

**First-touch:** the attribution context from the very first session that brought the visitor to the site. This is the channel that generated awareness. It is the most accurate signal for understanding what drove initial discovery.

**Last-touch:** the attribution context from the most recent session before lead creation. This is the channel that converted. It is the most useful signal for optimizing conversion campaigns.

When the two are the same (single-session conversion), store the same value in both fields.

**Which to use for reporting:**

| Question | Attribution model | Field |
|---|---|---|
| Which channels generate awareness? | First-touch | `first_touch_attribution` |
| Which campaigns produce conversions? | Last-touch | `last_touch_attribution` |
| What drove the revenue? | Data-driven (platform) or weighted | Both, combined |
| How do I bid in Google Ads? | Last-touch (platform default) | `last_touch_attribution` |
| How do I evaluate a new channel? | First-touch | `first_touch_attribution` |

### 7.4 Attribution on booking record

When a booking is created (checkout session initiated), a snapshot of the lead's attribution context must be written to the booking record as a JSONB field `attribution_snapshot`.

This ensures that:
- Source-to-revenue joins are possible at the booking level
- Attribution is frozen at booking time and not retroactively modified
- Revenue reports do not require joining back through the leads table

---

## 8. Lead Source Truth Rules

Platform-reported attribution and database attribution will disagree. This is expected. The rules below determine which source wins in each context.

### 8.1 The hierarchy of source truth

```
1. App database (leads.traffic_source, bookings.attribution_snapshot)
   → Most authoritative for revenue reporting

2. GA4 session source/medium (session-scoped, pre-redirect)
   → Authoritative for funnel behavior reporting

3. Google Ads / Meta Ads platform dashboard
   → Self-reported, modeled; use for channel-level spend management only
```

**Never use platform-reported revenue as the number of record.**
Platform dashboards inflate conversion counts due to attribution window overlaps, view-through claims, and modeled conversion fill-in.

### 8.2 When database attribution is empty

If `leads.traffic_source` is null or `direct`, apply the following investigation sequence:

1. Check `referrer_url` — if a referrer is present, the UTM was missing from the campaign URL (tagging error)
2. Check the session time against campaign activity — if the campaign was running, this is a UTM tagging gap
3. Do not backfill with platform data — backfilled attribution is not the same as captured attribution

**Root cause for empty attribution is almost always a campaign UTM tagging error.**
UTM tagging discipline at the campaign creation stage is the prevention.

### 8.3 Direct traffic rules

`traffic_source: direct` does not always mean the user typed the URL.
It means the referrer was empty and no UTM parameters were present.

Direct traffic is inflated by:
- Links in apps (mobile apps strip referrers)
- HTTPS to HTTP redirects (referrer is stripped)
- Email clients (many strip referrers)
- Shortened URLs without UTMs
- Shared links from messaging apps

When direct traffic is high (> 30% of leads), investigate UTM tagging coverage before drawing channel conclusions.

### 8.4 Source conflict resolution

When GA4 and the database disagree on the source of a booking:

| Scenario | Action |
|---|---|
| Database says `google`, GA4 says `(direct)` | Trust database; GA4 session was likely from Stripe redirect |
| Database says `direct`, GA4 says `google` | Check if UTM tagging was added to the campaign after the session |
| Database says `meta`, Google Ads claims the conversion | Normal overlap; database is revenue truth, platform claims are platform truth |
| Both empty | UTM tagging gap; log and investigate campaign URL configuration |

---

## 9. Revenue by Source Rules

Source-to-revenue joins are the most important query type in the Senzai marketing intelligence stack. They must be built correctly and consistently across all clients.

### 9.1 The canonical revenue by source query

Revenue by source is always computed at the booking level, not the lead level and not the platform level.

```sql
SELECT
  b.attribution_snapshot->>'traffic_source'       AS source,
  b.attribution_snapshot->>'traffic_medium'        AS medium,
  b.attribution_snapshot->>'utm_campaign'          AS campaign,
  COUNT(*)                                          AS bookings,
  SUM(b.deposit_amount) / 100.0                    AS deposit_revenue,
  SUM(b.total_price) / 100.0                       AS total_booked_revenue,
  SUM(CASE WHEN b.remaining_charged_at IS NOT NULL
       THEN b.total_price ELSE b.deposit_amount END) / 100.0 AS collected_revenue
FROM bookings b
WHERE b.status = 'confirmed'
  AND b.created_at >= [date_range_start]
  AND b.created_at < [date_range_end]
GROUP BY 1, 2, 3
ORDER BY collected_revenue DESC;
```

**Use `collected_revenue` as the primary revenue metric.** Not `total_booked_revenue`. Booked revenue includes future obligations not yet collected. Collected revenue is money in the bank.

### 9.2 The spend-to-revenue bridge

The full revenue by source picture requires joining app database revenue to ad platform spend.

This join is manual for now (platform spend is exported or pulled via API; app revenue is queried from the database).

The bridge table should contain:

| Field | Source |
|---|---|
| `date` | Calendar date |
| `traffic_source` | Canonical value |
| `campaign_name` | Ad platform export |
| `impressions` | Ad platform |
| `clicks` | Ad platform |
| `spend` | Ad platform |
| `leads` | App database count |
| `bookings` | App database count |
| `collected_revenue` | App database sum |

**Derived metrics from this table:**

| Metric | Formula |
|---|---|
| CPL (Cost per Lead) | `spend / leads` |
| CPA (Cost per Acquisition/Booking) | `spend / bookings` |
| ROAS (Return on Ad Spend) | `collected_revenue / spend` |
| Lead-to-Booking CVR | `bookings / leads` |
| Revenue per Lead | `collected_revenue / leads` |

### 9.3 ROAS calculation standard

ROAS must always be calculated using collected revenue from the app database, not platform-reported conversion value.

Platform-reported ROAS is directionally useful but not the number of record.

| ROAS type | Definition | Use |
|---|---|---|
| Platform ROAS | Platform-reported conversions × value / spend | Bidding optimization signal only |
| Database ROAS | Collected revenue from DB / spend | Revenue reporting truth |

Report both. Manage bids with platform ROAS. Make decisions with database ROAS.

---

## 10. Landing Page Conversion Standards

### 10.1 Page structure standard

Every Senzai client landing page must contain these sections in this order:

```
1. Navigation (sticky)
   — Logo, primary CTA button
   — Mobile hamburger

2. Hero
   — Headline (what you get, not who we are)
   — Subheadline (specificity: location, service, differentiator)
   — Primary CTA button
   — Trust signal (reviews badge, years in business, booking count)

3. Problem / Social proof
   — 3–4 value propositions (icons + short copy)
   — OR testimonials block immediately below hero

4. Service offers
   — Primary service card with CTA
   — Secondary service card with CTA

5. How it works
   — 3-step process (simple, reduces friction)

6. Proof
   — Reviews, photos, video
   — Specificity over superlatives

7. Guide / Team (for service businesses)
   — Human face, credentials, personality
   — Secondary CTA

8. FAQ
   — 5–8 questions that address the most common objections
   — Each answer should move toward conversion

9. Final CTA
   — Strong, direct, with urgency if appropriate

10. Footer
    — Contact info, legal links, social
    — Booking link
```

### 10.2 CTA standards

| Rule | Correct | Incorrect |
|---|---|---|
| CTA text | Action-oriented ("Book a Guide", "Reserve Your Spot") | Brand-forward ("Learn More About Us") |
| CTA frequency | Minimum 3 on page (hero, mid, footer) | Single CTA at top only |
| CTA destination | Direct to booking funnel | Contact form or phone number only |
| CTA tracking | Every CTA click tracked with `cta_location` | No click tracking |
| Mobile CTA | Sticky bottom bar on mobile | Buried below fold |

### 10.3 Page speed standard

- Largest Contentful Paint (LCP): < 2.5 seconds on mobile
- First Input Delay (FID) / INP: < 200ms
- Cumulative Layout Shift (CLS): < 0.1
- Mobile PageSpeed score: > 70

Page speed is an acquisition asset. A 1-second delay in LCP reduces conversions by 7% on average.
Do not let creative or image quality decisions compromise core web vitals.

### 10.4 Trust signals required before paid traffic is sent

The following must exist before spending ad budget:

- [ ] Minimum 3 customer reviews (Google Business preferred)
- [ ] Real photos (not stock)
- [ ] Clear business name, location, and contact method
- [ ] Explicit price range or pricing transparency
- [ ] Secure checkout indicator (SSL, payment logos)
- [ ] Refund or cancellation policy visible

Do not send paid traffic to a page without these signals.
Ad spend is wasted when trust is absent. Conversion rates below 1% on qualified traffic almost always indicate a trust deficit, not a traffic problem.

---

## 11. Funnel Optimization Standards

### 11.1 What triggers an optimization action

Optimization should be triggered by data, not intuition. The following thresholds define when to act.

| Metric | Review threshold | Action threshold |
|---|---|---|
| Funnel step drop-off | > 40% leaving any single step | Investigate and test within 7 days |
| Booking funnel CVR | < 15% of funnel starters completing | Immediate CRO investigation |
| Landing page bounce | > 70% (for paid traffic) | Page audit within 14 days |
| CPA trend | > 25% increase week-over-week | Campaign review within 48 hours |
| ROAS (database) | < 2.0 sustained for 14 days | Budget reallocation or pause |
| Lead quality (CVR from lead to booking) | < 20% | Review targeting and messaging alignment |

### 11.2 Funnel step optimization priority

When the funnel has multiple steps, optimize in this order:

1. **Entry step (trail/service selection)** — highest leverage; affects all downstream steps
2. **Payment step** — closest to revenue; even small CVR gains compound
3. **Date/time selection** — often high drop-off; UX issues are common here
4. **Waiver / compliance step** — friction point; simplify or reposition expectation
5. **Middle steps (skill, location, duration)** — optimize last; lower leverage

### 11.3 A/B testing protocol

Before running any A/B test:

- Define the single variable being tested
- Define success metric and minimum detectable effect
- Estimate required sample size before starting (minimum 100 conversions per variant)
- Document the hypothesis in writing before launching

After the test:

- Implement the winner only if statistical significance is reached (p < 0.05)
- Document the result in the Cross-Client Learnings Framework (§16)
- If not significant, extend the test — do not declare a winner early

**Never run more than one A/B test on the same step simultaneously.**

### 11.4 Iteration cadence

| Activity | Frequency |
|---|---|
| Campaign performance review | Weekly |
| Funnel metrics review | Weekly |
| Creative refresh (paid social) | Every 4–6 weeks or when CTR drops > 20% |
| Landing page copy test | Quarterly minimum |
| KPI benchmark comparison vs previous period | Monthly |
| Cross-client benchmark review | Quarterly |

---

## 12. KPI Definitions

All KPI calculations across all Senzai clients must use these exact formulas. No variations.

### 12.1 Acquisition KPIs

| KPI | Formula | Good range (service business) | Notes |
|---|---|---|---|
| CTR (paid search) | `clicks / impressions` | 5–12% | Below 3% = messaging or keyword mismatch |
| CPL (Cost per Lead) | `ad_spend / leads_created` | Varies by ACV; target < 20% of ACV | |
| CPA (Cost per Booking) | `ad_spend / bookings_confirmed` | Target < 30% of average booking value | |
| ROAS (database) | `collected_revenue / ad_spend` | > 3.0 for established campaigns | Break-even depends on margin |
| Lead-to-booking CVR | `bookings / leads` | 25–45% for qualified service leads | |
| Paid traffic CVR | `bookings / paid_sessions` | 2–6% for warm-intent traffic | |

### 12.2 Funnel KPIs

| KPI | Formula | Good range | Notes |
|---|---|---|---|
| Funnel start-to-complete CVR | `booking_completed / booking_started` | 20–40% | Below 15% = significant friction |
| Step-level drop-off | `users leaving step N / users entering step N` | < 30% per step | > 50% = UX or messaging issue |
| Time to convert | `avg time from first_visit to booking_completed` | < 24 hours for impulse; < 7 days for considered | |
| Cart abandonment rate | `checkout_started - booking_completed / checkout_started` | < 40% | High = pricing, trust, or UX issue |

### 12.3 Revenue KPIs

| KPI | Formula | Notes |
|---|---|---|
| Revenue per lead | `collected_revenue / leads_created` | Key metric for scaling spend |
| Average booking value (ABV) | `SUM(collected_revenue) / COUNT(bookings)` | Must use collected, not booked |
| Customer Acquisition Cost (CAC) | `total_ad_spend / bookings_confirmed` | Include all channels, not just one |
| LTV (Lifetime Value) | `ABV × avg_bookings_per_customer` | Requires repeat booking data |
| ROAS (target) | `LTV / CAC` | Should be > 3.0 for sustainable paid acquisition |

### 12.4 Quality KPIs

| KPI | Formula | Good range |
|---|---|---|
| Review acquisition rate | `reviews_received / bookings_completed` | > 20% |
| Referral rate | `bookings with referral source / total bookings` | > 10% after 6 months |
| Repeat booking rate | `customers with 2+ bookings / total customers` | > 15% after 12 months |

---

## 13. Client Onboarding Marketing Checklist

This checklist is executed for every new Senzai client in this order. Do not skip steps or reorder.

### Phase 1 — Foundation (Week 1)

- [ ] Google Analytics 4 property created and linked to domain
- [ ] GA4 data stream configured with enhanced measurement
- [ ] Data retention set to 14 months
- [ ] Google Tag Manager container created, published to site
- [ ] GA4 base tag deployed via GTM (if not using direct snippet)
- [ ] GA4 custom dimensions registered (§6.5)
- [ ] Core booking funnel events verified firing in GA4 DebugView
- [ ] `booking_completed` marked as conversion in GA4
- [ ] `checkout_started` marked as conversion in GA4
- [ ] Google Ads account created or linked
- [ ] Google Ads linked to GA4
- [ ] Auto-tagging enabled in Google Ads
- [ ] UTM tagging template defined for all campaigns

### Phase 2 — Attribution Infrastructure (Week 1–2)

- [ ] `leads` table contains all attribution fields (§7.1)
- [ ] `bookings` table contains `attribution_snapshot` JSONB field
- [ ] `captureAcquisitionContext()` fires on landing page load
- [ ] `captureAcquisitionContext()` fires on booking page entry
- [ ] Attribution fields verified written to database on lead creation
- [ ] Source-to-revenue query tested against sample data
- [ ] UTM parameter passthrough verified through booking funnel (survives Stripe redirect)

### Phase 3 — Paid Acquisition Launch (Week 2–3)

- [ ] Google Ads brand campaign created (captures existing demand immediately)
- [ ] Google Ads high-intent campaign created with minimum 3 RSAs per ad group
- [ ] GA4 conversions imported into Google Ads
- [ ] Bidding strategy set to Maximize Clicks with CPC cap (launch phase)
- [ ] Negative keyword list created (irrelevant terms, competitor name if not targeting)
- [ ] Conversion tracking verified in Google Ads (test conversion recorded)
- [ ] Remarketing audiences created (§4.6)
- [ ] Converted customers excluded from acquisition campaigns
- [ ] Landing page trust signals verified (§10.4)
- [ ] Mobile page speed verified (§10.3)
- [ ] Initial budget allocated by intent tier

### Phase 4 — Reporting Infrastructure (Week 3–4)

- [ ] GA4 funnel exploration report created
- [ ] Revenue by source query documented and tested
- [ ] KPI baseline established for all §12 metrics
- [ ] First weekly performance review scheduled
- [ ] First monthly optimization SOP scheduled (§14)

### Phase 5 — Meta Ads (When conditions in §5.1 are met)

- [ ] Meta Business Manager account configured
- [ ] Meta Pixel installed via GTM
- [ ] Pixel events mapped to Senzai canonical events (§5.4)
- [ ] CAPI integration implemented for `Purchase` events
- [ ] Deduplication verified (`event_id` matching between Pixel and CAPI)
- [ ] Meta ad account linked to Pixel
- [ ] First prospecting campaign launched with creative approved

---

## 14. Monthly Optimization SOP

This SOP is executed once per month for every active client. It is not optional and is not skipped for "stable" accounts.

### Week 1 of month — Data review

**Revenue bridge:**
- Pull app database collected revenue by source for the prior month
- Pull ad platform spend by campaign for the prior month
- Calculate database ROAS by channel
- Compare to platform-reported ROAS
- Document the gap

**Funnel review:**
- Pull booking_started → booking_completed CVR for the month
- Pull step-level drop-off for each funnel step
- Identify the highest drop-off step
- Note any change vs prior month

**Lead quality review:**
- Pull lead-to-booking CVR by source
- Flag any source with CVR below 15%

### Week 2 of month — Decisions

**Campaign decisions:**
- Increase budget for campaigns with database ROAS > 3.0 and volume headroom
- Decrease budget for campaigns with database ROAS < 2.0 sustained for 2+ weeks
- Pause ad groups with CTR < 2% and 30+ days of data
- Add negative keywords from search term report (weekly for first 60 days)

**Funnel decisions:**
- If one step has > 40% drop-off, log for A/B test within 30 days
- If funnel CVR dropped > 15% vs prior month, investigate cause before spending more on acquisition

**Creative decisions:**
- If click-through rate on primary ad creative dropped > 20% vs prior month, queue creative refresh

### Week 3 of month — Execution

- Implement approved budget and bid changes
- Launch any approved A/B tests
- Update negative keyword lists
- Refresh any creatives approved for update

### Week 4 of month — Documentation

- Update cross-client learnings log with any findings from this month (§16)
- Document any anomalies or unexplained changes
- Prepare monthly summary for client (if client-facing reporting is part of engagement)

---

## 15. Data Flow Into Senzai

This section describes the pipeline by which client marketing data reaches the Senzai intelligence layer. Current implementations use the data at the client level. The Senzai layer aggregates across clients.

### 15.1 Current state (per-client)

Each client's app database contains:
- Attribution fields at the lead and booking level
- Revenue fields at the booking level
- Event history in GA4 (behavioral, not authoritative)
- Authoritative lifecycle events emitted from webhook handlers

These are available for per-client analysis but not yet aggregated across clients.

### 15.2 Target state (cross-client Senzai)

The Senzai v1 intelligence layer will ingest, normalize, and aggregate events from all client implementations.

The pipeline for marketing-layer data:

```
Client App DB (per client)
    → Senzai Ingest API
        → Senzai normalized event store
            → Cross-client analytics layer
                → Benchmark database
                    → Growth intelligence reports
```

### 15.3 Data contract for Senzai ingestion

For marketing data to be consumable by Senzai, every client must produce events with the following fields present and populated:

| Field | Type | Required |
|---|---|---|
| `tenant_name` | string | Yes — identifies the client |
| `event_name` | string | Yes — canonical name from Tracking Dictionary |
| `traffic_source` | string | Yes — canonical controlled value |
| `traffic_medium` | string | Yes — canonical controlled value |
| `utm_campaign` | string | No |
| `funnel_name` | string | Yes — identifies the funnel type |
| `booking_flow_variant` | string | Yes — identifies the flow path |
| `trail_type` / `service_type` | string | Yes — industry-specific service dimension |
| `value` | number | Yes for revenue events — in dollars |
| `currency` | string | Yes for revenue events |
| `timestamp` | ISO 8601 | Yes |

Missing any required field makes the event non-joinable in the cross-client layer.
Clients with incomplete events are excluded from cross-client benchmarks.

### 15.4 Normalization before ingestion

Raw data is never ingested without normalization. The following transformations are applied before events reach Senzai:

- `utm_source` raw value → `traffic_source` canonical value
- `utm_medium` raw value → `traffic_medium` canonical value
- Revenue values → verified against `booking.status = 'confirmed'`
- Duplicate events → deduplicated by `booking_id` + `event_name`

This normalization is the responsibility of the client implementation layer, not the Senzai ingest layer.
Senzai trusts that canonical values are correct when received.

---

## 16. Cross-Client Learnings Framework

### 16.1 What gets logged

Every time a campaign, funnel test, or optimization produces a result — positive or negative — it must be logged in the cross-client learnings registry.

**Log entries must include:**

| Field | Description |
|---|---|
| `date` | When the experiment concluded |
| `client` | Client code (not client name for internal log) |
| `industry` | e.g., outdoor_experience, legal_services, fitness |
| `channel` | e.g., google_paid_search, meta_prospecting |
| `hypothesis` | What was tested and what was expected |
| `result` | What actually happened (quantified) |
| `transferability` | High / Medium / Low — can this apply to other clients? |
| `notes` | Any context needed to apply the learning |

### 16.2 Transferability classification

**High transferability:** The finding is likely to apply across different clients in the same or adjacent industries. Example: "Removing the bike rental selection step for paved tours increased funnel CVR by 18%. Any booking funnel with more than 8 steps should be audited for step reduction opportunity."

**Medium transferability:** The finding applies within the same industry or business model. Example: "Google Ads brand campaigns for local outdoor experience operators average 8:1 database ROAS. Use this as a benchmark when projecting brand campaign value."

**Low transferability:** The finding is highly specific to the client's market, audience, or offer. Example: "Adding 'manatee viewing' to ad copy increased CTR 40% for FMBGT during November–March. Seasonal wildlife events are a hyper-local CTR lever."

### 16.3 Applying learnings to new clients

When a new client is onboarded, the cross-client learnings registry should be reviewed for:

- Same industry findings → apply directly as hypotheses for the first 90 days
- Adjacent industry findings → note and test in months 2–4
- High-transferability findings across industries → apply as defaults unless evidence contradicts

The learnings registry transforms each client engagement from an isolated project into a compounding asset for all future clients.

---

## 17. Industry Benchmarking Model

### 17.1 Why benchmarks matter

Without benchmarks, every new client starts from zero knowledge.
With benchmarks, every new client starts with expectations, targets, and thresholds calibrated by real data.

A client asking "is 3% CVR good?" cannot be answered without knowing what 3% means in their industry, channel, and funnel structure.

### 17.2 Benchmark dimensions

Senzai benchmarks are maintained along these dimensions:

| Dimension | Examples |
|---|---|
| Industry category | outdoor_experience, legal_services, fitness, food_service |
| Business model | deposit_model, full_payment, subscription |
| Average contract value | < $200, $200–$500, $500–$2000, $2000+ |
| Funnel type | multi-step_booking, lead_capture_only, direct_purchase |
| Primary channel | google_paid_search, meta_paid_social, organic_search |

### 17.3 Benchmark metric standard

For each client, these baseline metrics are captured at the 90-day mark and entered into the Senzai benchmark database:

| Metric | Collection timing |
|---|---|
| Landing page CVR (sessions to funnel start) | 90-day mark |
| Funnel CVR (funnel start to completion) | 90-day mark |
| Google Ads CTR (high intent campaign) | 90-day mark |
| Google Ads CPA (database) | 90-day mark |
| Google Ads database ROAS | 90-day mark |
| Lead-to-booking CVR | 90-day mark |
| Average booking value | 90-day mark |
| Time from first visit to booking | 90-day mark |

At 12 months, an updated set is captured to measure maturation.

### 17.4 Cross-industry normalization

Industries differ in absolute KPI values but often share structural patterns.

Normalized for comparison:
- CVR ratios (funnel step drop-off as percentages) → comparable across industries
- ROAS expressed as multiples → comparable across industries
- Time-to-convert as a fraction of sales cycle length → comparable across industries

Not normalized (industry-specific):
- Absolute CPA values
- Absolute booking values
- Seasonal traffic patterns

The goal is not to claim that a tour company and a law firm have identical benchmarks. The goal is to identify structural patterns — funnel geometry, attribution behavior, creative decay rates — that transfer across the Senzai client base regardless of industry.

---

## 18. Anti-Patterns To Avoid

These patterns appear frequently in marketing implementations. They degrade data quality, waste budget, or create technical debt that is expensive to unwind.

### 18.1 Attribution anti-patterns

| Anti-pattern | Problem | Correct approach |
|---|---|---|
| Capturing UTMs only in GA4 | Platform data is lost after 14 months; cannot join to revenue | Persist to app database at lead creation |
| Using session source/medium from GA4 for revenue attribution | Stripe redirect destroys session source | Use sessionStorage-persisted canonical source |
| Relying on platform-reported ROAS for decisions | Meta and Google both overclaim attribution | Always verify against database ROAS |
| Normalizing attribution at query time | Inconsistent results; raw UTMs are unreliable | Normalize on capture; store canonical values |
| Single-touch attribution model only | Misses channel contribution at different funnel stages | Always store both first-touch and last-touch |

### 18.2 Paid media anti-patterns

| Anti-pattern | Problem | Correct approach |
|---|---|---|
| Optimizing for micro-conversions (page views, CTA clicks) | Trains algorithm to produce engagement, not revenue | Bid on `booking_completed` with revenue value |
| Launching broad match before Smart Bidding has data | Broad match requires conversion signal to work; without it, burns budget | Launch with exact and phrase match; add broad after 50+ conversions/month |
| Running ROAS bidding before 80 monthly conversions | Insufficient data causes algorithm instability | Use Target CPA or Maximize Conversions first |
| Sending paid traffic to a page without trust signals | Conversion rate will be < 1% regardless of traffic quality | Complete the landing page standard (§10.4) before spending |
| Setting up Meta Ads before Google Ads is stable | Divides budget and attention before a single channel is proven | Prove one channel first |
| Pausing campaigns for 2+ weeks then restarting | Destroys Smart Bidding learning; resets to learning mode | Reduce budget vs pause; or pause for a full reset if strategic |

### 18.3 Tracking anti-patterns

| Anti-pattern | Problem | Correct approach |
|---|---|---|
| Different event names across clients | Cross-client Senzai analysis is broken | Use canonical vocabulary from Tracking Dictionary — no exceptions |
| Firing `purchase` on redirect URL arrival | Stripe checkout can complete without redirect (e.g., server webhook only) | Fire `purchase` on confirmation page load after booking data is verified from DB |
| Duplicate GA4 tags (direct snippet + GTM tag) | Doubles all event counts | One tag per environment; never both simultaneously |
| Testing with production GA4 property | Pollutes conversion data; confuses algorithm learning | Use debug mode or a separate data stream |
| No server-side conversion for Meta | 20–40% of purchases invisible to Meta algorithm | Implement CAPI before scaling Meta spend |
| UTM parameters on internal links | Resets session source mid-funnel | UTM parameters are for external entry only |

### 18.4 Reporting anti-patterns

| Anti-pattern | Problem | Correct approach |
|---|---|---|
| Using platform revenue as primary revenue metric | Self-reported; systematically inflated | Always anchor to database collected revenue |
| Reporting on sessions instead of qualified traffic | Sessions include bots, internal, and irrelevant traffic | Segment to paid + organic search sessions only for acquisition reporting |
| Week-over-week comparison without seasonality context | Misleads decision-making | Compare same period prior year or rolling 4-week average |
| Reporting ROAS without separating brand from non-brand | Brand campaigns inflate overall ROAS; non-brand is the acquisition signal | Always segment brand vs non-brand campaigns in ROAS reporting |

---

## 19. Launch Checklist

This checklist confirms the marketing layer is production-ready before meaningful ad spend begins. It supplements the Client Onboarding Checklist (§13), which covers setup sequencing. This checklist covers go-live readiness.

### 19.1 Tracking readiness

- [ ] Core funnel events verified in GA4 DebugView (booking_started → booking_completed)
- [ ] `purchase` event fires with correct revenue value in GA4
- [ ] `purchase` event survives Stripe redirect (confirmed in GA4 realtime)
- [ ] Attribution fields verified written to Supabase leads table on lead creation
- [ ] `attribution_snapshot` written to bookings table on checkout initiation
- [ ] Source-to-revenue query returns expected results against test bookings
- [ ] GA4 custom dimensions registered and populated (not empty in events)

### 19.2 Google Ads readiness

- [ ] Brand campaign live and receiving impressions
- [ ] High-intent campaign live with minimum 3 ad groups
- [ ] GA4 conversions imported and showing in Google Ads conversion column
- [ ] At least 1 test conversion recorded in Google Ads (verified in conversion history)
- [ ] Auto-tagging enabled (GCLID passing through to booking confirmation)
- [ ] Remarketing audiences defined (even if not yet used for campaigns)
- [ ] Converted customers excluded from acquisition campaigns
- [ ] Negative keyword list applied

### 19.3 Landing page readiness

- [ ] Mobile PageSpeed LCP < 2.5 seconds
- [ ] All trust signals present (§10.4)
- [ ] CTA buttons tracked with `cta_location` in GA4
- [ ] Primary CTA links directly to booking funnel
- [ ] `captureAcquisitionContext()` fires on page load

### 19.4 Meta Ads readiness (if activating)

- [ ] Pixel verified firing PageView on all pages
- [ ] Pixel verified firing `Purchase` event with value on confirmation page
- [ ] CAPI integration verified (test Purchase event in Meta Events Manager shows both Pixel and server events)
- [ ] Event deduplication confirmed (not double-counting in Meta Events Manager)

### 19.5 Reporting readiness

- [ ] Weekly review calendar event created
- [ ] Monthly optimization SOP scheduled
- [ ] KPI baseline document created (pre-launch state documented)
- [ ] Revenue by source report accessible

---

## 20. Final Operating Philosophy

### The three questions every marketing decision must answer

Before launching a campaign, changing a budget, running a test, or declaring a result, three questions must have clear answers:

**1. Will this produce data we can learn from?**
If the action will not generate enough volume to measure, do not take it yet. An underpowered test is not a test — it is noise.

**2. Will the result be comparable across clients?**
If the measurement approach, event naming, or attribution method is bespoke to this client, the result cannot compound into Senzai intelligence. Standardize before experimenting.

**3. Is the measurement connected to collected revenue?**
Engagement metrics are symptoms. Conversion metrics are indicators. Collected revenue is the outcome. Every marketing action should ultimately trace to its effect on money in the bank, not clicks, impressions, or GA4 sessions.

### Marketing infrastructure as a long-term moat

Most agencies optimize individual client accounts in isolation. The work disappears when the engagement ends.

Senzai is building something different: a cross-client growth intelligence layer where every client engagement produces data that makes the next engagement better.

That only works if the data is comparable.
Comparable data requires standardized measurement.
Standardized measurement requires this document to be followed, not consulted.

The marketing standard is not a guideline. It is the operating system.

### The compounding value of consistency

Year 1: One client with clean, standardized marketing data.
Year 2: Five clients. Cross-client benchmarks become possible. New client onboarding uses real benchmarks instead of industry estimates.
Year 3: Twenty clients. Winning campaign structures transfer across industries. Funnel optimization insights replicate in days instead of months.
Year 5: Senzai can predict the likely ROAS for a new client based on industry, funnel type, and market size — before the first dollar is spent.

That prediction is the moat.
This document is how it gets built.

---

*SENZAI_MARKETING_IMPLEMENTATION_STANDARD.md — Version 1.0*
*Companion documents: `BLUEPRINT_CLIENT_IMPLEMENTATION.md`, `SENZAI_UNIVERSAL_TRACKING_DICTIONARY_V1.md`*
*Classification: Internal — Senzai Growth Operating System*

# Florida Mountain Bike Trail Guided Tours — Project Reference

> MVP booking platform for guided bike tours. Built to be embedded externally from a Carrd.co main website.
> Last updated: March 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [User Booking Flow](#4-user-booking-flow)
5. [Database Schema](#5-database-schema)
6. [Pricing Logic](#6-pricing-logic)
7. [Inventory Logic](#7-inventory-logic)
8. [API Routes](#8-api-routes)
9. [Third-Party Integrations](#9-third-party-integrations)
10. [Environment Variables](#10-environment-variables)
11. [Local Development](#11-local-development)
12. [Deployment (Vercel)](#12-deployment-vercel)
13. [Known Gotchas](#13-known-gotchas)
14. [Future Improvements](#14-future-improvements)

---

## 1. Project Overview

A multi-step booking system for Florida Mountain Bike Trail Guided Tours. Users flow through 9 steps to configure and pay for a guided tour. The platform handles:

- Trail type and skill-level selection
- Location filtering based on trail type + skill
- Bike rental (standard or electric, limited inventory)
- Date/time availability via Cal.com
- Duration selection with dynamic pricing
- Optional add-ons (GoPro, Pickup/Dropoff, Electric Upgrade)
- Legal liability waiver acceptance
- Stripe Checkout for payment
- Post-payment automation via n8n webhooks

**The UI is intentionally minimal (MVP).** A Gemini AI pass is planned to upgrade the design system after the functional foundation is stable.

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.1.6 |
| Language | TypeScript | ^5 |
| Styling | TailwindCSS | ^4 |
| UI Components | shadcn/ui | ^4 (base-ui) |
| Database | Supabase (PostgreSQL) | ^2.99 |
| Payments | Stripe Checkout | ^20.4 |
| Scheduling | Cal.com API | v1 |
| Automation | n8n (webhooks) | — |
| Validation | Zod | ^4 |
| State Management | React Context + useReducer | — |
| Deployment | Vercel | — |

---

## 3. Project Structure

```
/
├── app/
│   ├── layout.tsx                    # Root layout
│   ├── page.tsx                      # Redirects → /booking
│   ├── booking/
│   │   ├── layout.tsx                # Wraps all steps in BookingProvider
│   │   ├── page.tsx                  # Redirects → /booking/step1-trail
│   │   ├── step1-trail/page.tsx      # Choose: Paved or MTB
│   │   ├── step2-skill/page.tsx      # Choose: Skill level (MTB only)
│   │   ├── step3-location/
│   │   │   ├── page.tsx              # Server component — fetches locations
│   │   │   └── client.tsx            # Client component — renders filtered list
│   │   ├── step4-bike/page.tsx       # Bike rental + rider height
│   │   ├── step5-datetime/page.tsx   # Date picker + time slot (Cal.com)
│   │   ├── step6-duration/page.tsx   # 2 / 3 / 4 hours
│   │   ├── step7-addons/page.tsx     # GoPro, Pickup, Electric Upgrade
│   │   ├── step8-waiver/page.tsx     # Liability waiver checkbox
│   │   ├── step9-payment/page.tsx    # Customer details → Stripe redirect
│   │   └── confirmation/page.tsx     # Post-payment thank you
│   └── api/
│       ├── create-checkout/route.ts  # POST — validates + creates Stripe session
│       ├── validate-inventory/route.ts # POST — checks date availability
│       ├── availability/route.ts     # GET — Cal.com slots (mock fallback)
│       └── webhooks/
│           └── stripe/route.ts       # POST — handles Stripe events + n8n
│
├── components/
│   ├── BookingStepper.tsx            # Progress bar + step labels
│   ├── PriceSummary.tsx              # Live price breakdown panel
│   └── ui/                           # shadcn/ui primitives (auto-generated)
│
├── context/
│   └── BookingContext.tsx            # Global booking state (9-step reducer)
│
├── lib/
│   ├── pricing.ts                    # Price calculation logic (server-side truth)
│   ├── inventory.ts                  # Electric bike / GoPro availability checks
│   ├── supabase.ts                   # Supabase client + admin client + helpers
│   ├── stripe.ts                     # Checkout session creation + webhook verify
│   ├── cal.ts                        # Cal.com availability fetch + mock data
│   └── utils.ts                      # cn() utility (clsx + tailwind-merge)
│
├── types/
│   ├── booking.ts                    # All TypeScript types and interfaces
│   └── index.ts                      # Re-exports
│
├── supabase/
│   └── schema.sql                    # Full PostgreSQL schema + seed data
│
├── .env.local                        # Local secrets (git-ignored)
├── .env.example                      # Template — safe to commit
├── README.md                         # Quick-start guide
└── PROJECT.md                        # This file — full project reference
```

---

## 4. User Booking Flow

```
Step 1 → Trail Type
         ├── Paved Trail ──────────────────────────────► Step 3
         └── Mountain Bike Trail ──────────────────────► Step 2

Step 2 → Skill Level (MTB only)
         First Time Rider | Beginner | Intermediate | Advanced
                                                      ▼
Step 3 → Location
         Filtered by: trail_type + skill_level
         Examples: Blue Springs, Markham Woods, Santos Trailhead...
                                                      ▼
Step 4 → Bike Rental
         None (own bike) | Standard Rental | Electric Rental
         → If rental: ask rider height for bike sizing
                                                      ▼
Step 5 → Date & Time
         Calendar grid pulled from Cal.com API
         Mock data used in dev when CAL_API_KEY is unset
                                                      ▼
Step 6 → Duration
         2 hours (base) | 3 hours (+$50) | 4 hours (+$100)
                                                      ▼
Step 7 → Add-ons
         ☐ GoPro Package             +$49
         ☐ Pickup + Dropoff          +$75
         ☐ Electric Bike Upgrade     +$25  (hidden if already renting electric)
                                                      ▼
Step 8 → Liability Waiver
         Must accept to proceed
                                                      ▼
Step 9 → Payment
         Collect: name, email, phone
         POST /api/create-checkout → server validates + builds Stripe session
         Redirect → Stripe Checkout
                                                      ▼
Confirmation Page
         Stripe redirects back with ?session_id=&booking_id=
         n8n webhook fires → sends email, calendar invite, Slack notification
```

**Navigation rules:**
- Paved trail skips Step 2 (no skill level needed)
- Changing trail type resets: skill level, location, and all downstream state
- Changing skill level resets: location

---

## 5. Database Schema

All tables live in Supabase (PostgreSQL). Run `supabase/schema.sql` to initialize.

### `customers`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | auto |
| name | TEXT | required |
| email | TEXT | unique |
| phone | TEXT | optional |
| height_inches | INTEGER | for bike sizing |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | auto-updated via trigger |

### `locations`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | TEXT | e.g. "Blue Springs" |
| tour_type | TEXT | `paved` or `mtb` |
| skill_levels | TEXT[] | NULL = all levels; e.g. `['beginner','intermediate']` |
| active | BOOLEAN | soft delete |

**Seed data (11 locations):**

| Location | Type | Skill Levels |
|---|---|---|
| Blue Springs | paved | all |
| Sanford | paved | all |
| Mount Dora | paved | all |
| Spruce Creek | paved | all |
| Orlando MTB Park | mtb | beginner, intermediate, advanced |
| Soldiers Creek | mtb | first_time, beginner, intermediate |
| Markham Woods | mtb | intermediate, advanced |
| Snow Hill | mtb | beginner, intermediate |
| Riverbend | mtb | first_time, beginner |
| Santos Trailhead | mtb | intermediate, advanced |
| Graham Swamp | mtb | advanced |

### `tours`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | TEXT | |
| type | TEXT | `paved` or `mtb` |
| base_duration_hours | INTEGER | 2 |
| base_price_no_bike | INTEGER | cents (8900 = $89) |
| base_price_with_bike | INTEGER | cents (18900 = $189) |
| additional_hour_price | INTEGER | cents (5000 = $50) |
| active | BOOLEAN | |

### `bookings`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| customer_id | UUID FK | → customers |
| tour_id | UUID FK | → tours |
| location_id | UUID FK | → locations |
| trail_type | TEXT | `paved` / `mtb` |
| skill_level | TEXT | nullable for paved |
| date | DATE | |
| time_slot | TEXT | e.g. `"09:00"` |
| duration_hours | INTEGER | 2, 3, or 4 |
| bike_rental | TEXT | `none` / `standard` / `electric` |
| rider_height_inches | INTEGER | nullable |
| addons | JSONB | `{"gopro": true, "pickup_dropoff": false, ...}` |
| base_price | INTEGER | cents |
| addons_price | INTEGER | cents |
| total_price | INTEGER | cents |
| stripe_session_id | TEXT | |
| stripe_payment_intent_id | TEXT | |
| cal_booking_uid | TEXT | from Cal.com |
| status | TEXT | `pending` / `confirmed` / `cancelled` / `refunded` |
| waiver_accepted | BOOLEAN | |
| waiver_accepted_at | TIMESTAMPTZ | |
| webhook_sent | BOOLEAN | n8n delivery flag |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | auto |

### `inventory`
| item | quantity |
|---|---|
| electric_bike | 2 |
| gopro | 3 |
| standard_bike | 10 |

### `addon_pricing`
| addon_key | name | price (cents) | limited_by_inventory |
|---|---|---|---|
| gopro | GoPro Package | 4900 | gopro |
| pickup_dropoff | Pickup + Dropoff | 7500 | NULL |
| electric_upgrade | Electric Bike Upgrade | 2500 | electric_bike |

**Row Level Security** is enabled on all tables. Public read is allowed on `locations`, `tours`, and `addon_pricing`. All write operations use the service role key (server-side only).

---

## 6. Pricing Logic

> **Important:** All pricing is calculated server-side in `/api/create-checkout`. Client-side calculations are display-only and are never trusted.

Source of truth: `lib/pricing.ts`

### Price Formula

```
total = base_price + duration_surcharge + addons_price
```

| Component | Calculation |
|---|---|
| `base_price` | `$89` if no bike rental; `$189` if standard or electric rental |
| `duration_surcharge` | `(hours - 2) × $50` |
| `addons_price` | sum of selected add-on prices |

### Examples

| Config | Calculation | Total |
|---|---|---|
| No bike, 2hr, no addons | $89 + $0 + $0 | **$89** |
| Standard bike, 2hr, no addons | $189 + $0 + $0 | **$189** |
| Standard bike, 3hr, GoPro | $189 + $50 + $49 | **$288** |
| Electric bike, 4hr, Pickup | $189 + $100 + $25 + $75 | **$389** |

---

## 7. Inventory Logic

Source of truth: `lib/inventory.ts`

**Limited items:**
- Electric bikes: **2 units**
- GoPros: **3 units**

**Check logic** (runs on every `/api/create-checkout` call):
1. Count bookings on the same date with `status IN ('pending', 'confirmed')`
2. Compare against total inventory quantity
3. If `available <= 0` → return `409 Conflict` with user-facing error

The client also calls `/api/validate-inventory` when the user selects a date to disable unavailable options in the UI before they reach checkout.

---

## 8. API Routes

### `POST /api/create-checkout`

The main checkout endpoint. Runs server-side only.

**Flow:**
1. Validate request body with Zod schema
2. Check waiver was accepted
3. Validate inventory for the requested date
4. **Recalculate price server-side** (ignores any client price)
5. Upsert customer record in Supabase
6. Create `pending` booking in Supabase
7. Create Stripe Checkout session with line items
8. Update booking with `stripe_session_id`
9. Return `{ checkout_url, session_id }`

**Request body:**
```json
{
  "booking_state": {
    "trail_type": "mtb",
    "skill_level": "intermediate",
    "location_id": "uuid",
    "location_name": "Markham Woods",
    "bike_rental": "standard",
    "rider_height_inches": 70,
    "date": "2026-04-15",
    "time_slot": "09:00",
    "duration_hours": 3,
    "addons": { "gopro": true },
    "waiver_accepted": true,
    "customer": {
      "name": "Jane Smith",
      "email": "jane@example.com",
      "phone": "555-1234"
    }
  }
}
```

---

### `POST /api/validate-inventory`

**Request:**
```json
{
  "date": "2026-04-15",
  "bike_rental": "electric",
  "addons": { "gopro": true }
}
```

**Response:**
```json
{
  "valid": true,
  "errors": [],
  "inventory": {
    "electric_bike": { "item": "electric_bike", "quantity": 2, "available": 1 },
    "gopro": { "item": "gopro", "quantity": 3, "available": 2 }
  }
}
```

---

### `GET /api/availability?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD`

Fetches available time slots from Cal.com. Returns mock data if `CAL_API_KEY` is not set.

**Response:**
```json
{
  "slots": [
    { "date": "2026-04-15", "time": "09:00", "available": true },
    { "date": "2026-04-15", "time": "13:00", "available": false }
  ]
}
```

---

### `POST /api/webhooks/stripe`

Handles Stripe payment lifecycle events.

| Event | Action |
|---|---|
| `checkout.session.completed` | Set booking `status = 'confirmed'`, store payment intent ID, trigger n8n |
| `checkout.session.expired` | Set booking `status = 'cancelled'` (if still pending) |
| `charge.refunded` | Set booking `status = 'refunded'` |

**n8n Payload (on `booking_confirmed`):**
```json
{
  "event": "booking_confirmed",
  "data": {
    "booking_id": "uuid",
    "session_id": "cs_...",
    "customer_email": "jane@example.com",
    "customer_name": "Jane Smith",
    "amount_total": 28800,
    "location": "Markham Woods",
    "date": "2026-04-15",
    "time": "09:00"
  },
  "timestamp": "2026-04-10T14:32:00.000Z"
}
```

---

## 9. Third-Party Integrations

### Stripe

- **Mode:** Checkout (hosted payment page)
- **API version:** `2026-02-25.clover`
- **Webhook events to register:**
  - `checkout.session.completed`
  - `checkout.session.expired`
  - `charge.refunded`
- **Webhook endpoint:** `https://yourdomain.com/api/webhooks/stripe`
- **Test cards:** `4242 4242 4242 4242` (any future date, any CVC)

### Cal.com

- **API version:** v1
- **Endpoint used:** `GET /availability`
- **Required vars:** `CAL_API_KEY`, `CAL_EVENT_TYPE_ID`
- **Fallback:** Mock data is returned automatically when keys are not set
- **Transform:** `lib/cal.ts → transformCalResponse()` — adjust if Cal.com API response shape changes
- **Cache:** Slots are cached 5 minutes (`next: { revalidate: 300 }`)

### n8n

- **Trigger:** HTTP POST to `N8N_WEBHOOK_URL` after `checkout.session.completed`
- **Use cases:** Confirmation email, calendar invite, Slack notification, CRM update
- **Failure handling:** n8n errors are logged but do NOT fail the Stripe webhook response (fire-and-forget)

### Supabase

- **Client key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`): Used client-side for public reads (locations, tours, addon pricing)
- **Service role key** (`SUPABASE_SERVICE_ROLE_KEY`): Used server-side only for all writes. Never exposed to the browser.
- **RLS:** Enabled on all tables. Public read on reference tables. Service role for all mutations.

---

## 10. Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Stripe
STRIPE_SECRET_KEY=sk_live_...          # sk_test_ for development
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...        # From Stripe dashboard webhook settings

# Cal.com
CAL_API_KEY=cal_live_...
CAL_EVENT_TYPE_ID=12345

# App
NEXT_PUBLIC_APP_URL=https://booking.yourdomain.com   # No trailing slash

# n8n
N8N_WEBHOOK_URL=https://your-n8n.com/webhook/xxxxx
```

**Development without third-party keys:**
- Supabase: Required. Set up a free project at supabase.com
- Stripe: Use test keys (`sk_test_`, `pk_test_`)
- Cal.com: Optional. Mock data is used automatically
- n8n: Optional. Webhook skips silently with a console warning

---

## 11. Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in environment variables
cp .env.example .env.local

# 3. Run Supabase schema
# → Go to supabase.com → SQL Editor → paste contents of supabase/schema.sql → Run

# 4. Start development server
npm run dev

# 5. Open in browser
# http://localhost:3000  → redirects to /booking/step1-trail
```

**Stripe webhook testing locally:**
```bash
# Install Stripe CLI
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger a test event
stripe trigger checkout.session.completed
```

---

## 12. Deployment (Vercel)

```bash
# Deploy via Vercel CLI
vercel

# Or connect GitHub repo to Vercel dashboard for auto-deploy
```

**Vercel environment variables:** Set all `.env.local` values in the Vercel project dashboard under Settings → Environment Variables.

**After deploying:**
1. Update `NEXT_PUBLIC_APP_URL` to your production URL
2. Register the Stripe production webhook at `https://yourdomain.com/api/webhooks/stripe`
3. Replace `sk_test_` / `pk_test_` Stripe keys with live keys
4. Update Cal.com event type to the production event

---

## 13. Known Gotchas

| Issue | Details |
|---|---|
| **Supabase v2.99 types** | `Database` type requires `Relationships: []` on every table definition. Using app-level types directly in `createClient<Database>` causes build errors. |
| **Supabase lazy singleton** | Do not initialize the Supabase client at module level — it reads env vars at import time, which breaks the Next.js build. Use a lazy getter function. |
| **shadcn/ui v4 Button** | v4 uses `@base-ui/react` under the hood and does not support the `asChild` prop. Use `buttonVariants()` applied directly to `<Link>` or `<a>` tags instead. |
| **`useSearchParams()` in Next.js 16** | Must be wrapped in a `<Suspense>` boundary or the build will fail with a static generation error. See `app/booking/confirmation/page.tsx`. |
| **Stripe API version** | v20 of the stripe npm package requires API version `'2026-02-25.clover'` — not the older `'2024-06-20'` string. |
| **Paved trail skips Step 2** | When user selects "Paved Trail" in Step 1, the router pushes directly to `/step3-location`, bypassing `/step2-skill`. The `skill_level` field remains `undefined` in state, which is valid for paved tours. |
| **Price on client vs server** | Client shows a live price preview for UX, but the server recalculates independently in `/api/create-checkout`. The Stripe line items are built from the server calculation only. |

---

## 14. Future Improvements

### High Priority (pre-launch)
- [ ] Admin dashboard — view/manage bookings, override inventory
- [ ] Email confirmation — implement in n8n (Resend or SendGrid)
- [ ] Calendar invite — send `.ics` file via n8n on booking confirmed
- [ ] Booking lookup page — customer enters email to view their booking
- [ ] Rate limiting on API routes — prevent checkout spam

### Post-MVP
- [ ] Recurring customer profiles — login with magic link (Supabase Auth)
- [ ] Gift cards / promo codes — Stripe coupon integration
- [ ] Group bookings — multiple riders per booking, bulk pricing
- [ ] Cancellation / rescheduling flow — customer self-service
- [ ] Analytics dashboard — revenue, popular locations, conversion funnel
- [ ] SMS reminders — via n8n + Twilio
- [ ] Waitlist — when dates are fully booked
- [ ] Dynamic pricing — peak/off-peak by day of week
- [ ] Internationalization — if expanding beyond English
- [ ] UI redesign — Gemini AI pass for design system upgrade

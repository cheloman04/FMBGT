# Florida Mountain Bike Trail Guided Tours — Project Reference

> Full-stack booking platform + marketing landing page for guided bike tours.
> Last updated: March 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Landing Page](#4-landing-page)
5. [User Booking Flow](#5-user-booking-flow)
6. [Step Engine](#6-step-engine)
7. [Database Schema](#7-database-schema)
8. [Pricing Logic](#8-pricing-logic)
9. [Inventory Logic](#9-inventory-logic)
10. [API Routes](#10-api-routes)
11. [Third-Party Integrations](#11-third-party-integrations)
12. [Environment Variables](#12-environment-variables)
13. [Local Development](#13-local-development)
14. [Deployment (Vercel)](#14-deployment-vercel)
15. [Known Gotchas](#15-known-gotchas)
16. [Future Improvements](#16-future-improvements)

---

## 1. Project Overview

The project has two distinct surfaces:

**1. Marketing landing page (`/`)** — a premium, animated marketing page for Florida Mountain Bike Guides. Features hero, tours, interactive Leaflet map, guides, rental fleet, photo gallery, CTA, and contact sections. Built with Framer Motion animations and a warm Florida sandy-green design system.

**2. Booking platform (`/booking`)** — a multi-step booking wizard. Users flow through up to 9 steps (some skipped dynamically based on selections) to configure and pay for a guided tour. Handles:

- Trail type and skill-level selection
- Location filtering based on trail type + skill
- Multi-participant group bookings (up to 6 riders per booking)
- Per-rider bike rental selection (standard or electric, limited inventory)
- Date/time availability via Cal.com
- Duration selection with dynamic pricing
- Optional add-ons (GoPro, Pickup/Dropoff)
- Legal liability waiver acceptance covering all participants
- Stripe Checkout for payment
- Post-payment automation via n8n webhooks
- Admin dashboard for booking management
- Dark/light mode with system preference detection

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.1.6 |
| Language | TypeScript | ^5 |
| Styling | TailwindCSS | ^4 |
| UI Components | shadcn/ui | ^4 (base-ui) |
| Animation | Framer Motion | latest |
| Map | React Leaflet + Leaflet | latest |
| Database | Supabase (PostgreSQL) | ^2.99 |
| Payments | Stripe Checkout | ^20.4 |
| Scheduling | Cal.com API | v1 |
| Automation | n8n (webhooks) | — |
| Validation | Zod | ^4 |
| State Management | React Context + useReducer | — |
| Theme | next-themes | — |
| Deployment | Vercel | — |

---

## 3. Project Structure

```
/
├── app/
│   ├── layout.tsx                        # Root layout — wraps in ThemeProvider
│   ├── page.tsx                          # Renders FloridaMountainBikeGuidesLanding (marketing home)
│   ├── not-found.tsx                     # Custom 404 page
│   ├── booking/
│   │   ├── layout.tsx                    # Wraps all booking routes in BookingProvider
│   │   ├── page.tsx                      # Single dynamic step renderer (reads currentStepId)
│   │   ├── error.tsx                     # Error boundary for the booking flow
│   │   ├── lookup/
│   │   │   └── page.tsx                  # Customer booking lookup (email + booking ID)
│   │   └── confirmation/
│   │       ├── page.tsx                  # Server Component — fetches booking data from Supabase
│   │       └── ConfirmationClient.tsx    # Client Component — handles reset + UI
│   ├── admin/
│   │   ├── page.tsx                      # Server Component — fetches bookings + stats (cookie auth)
│   │   ├── login/
│   │   │   └── page.tsx                  # Branded login page — password form, client logo
│   │   └── AdminClient.tsx               # Client Component — mobile cards + desktop table, filters, sign-out
│   └── api/
│       ├── create-checkout/route.ts      # POST — validates + creates Stripe session
│       ├── validate-inventory/route.ts   # POST — checks item availability for a date
│       ├── availability/route.ts         # GET — Cal.com slots (mock fallback)
│       ├── booking-lookup/route.ts       # GET — verifies email → customer → booking ownership
│       ├── admin/
│       │   ├── login/route.ts            # POST (set session cookie) + DELETE (logout)
│       │   └── update-booking/route.ts   # POST — admin status override (requires admin_session cookie)
│       └── webhooks/
│           └── stripe/route.ts           # POST — handles Stripe events + triggers n8n
│
├── components/
│   ├── landing/
│   │   ├── FloridaMountainBikeGuidesLanding.jsx  # Full marketing landing page ('use client', framer-motion)
│   │   └── sections/                             # Stub section components — ready to extract
│   │       ├── HeroSection.jsx
│   │       ├── ToursSection.jsx
│   │       ├── MapSection.jsx
│   │       ├── GuidesSection.jsx
│   │       ├── TrailsSection.jsx
│   │       ├── FleetSection.jsx
│   │       ├── GallerySection.jsx
│   │       ├── CTASection.jsx
│   │       └── ContactSection.jsx
│   ├── map/
│   │   └── InteractiveTrailMap.jsx       # React Leaflet map — 5 pins, pulsing icons, popups, mobile toggle
│   ├── BookingStepper.tsx                # Progress bar + step labels (context-driven)
│   ├── PriceSummary.tsx                  # Live price breakdown panel (multi-participant aware)
│   ├── ThemeProvider.tsx                 # next-themes wrapper (attribute="class")
│   ├── ThemeToggle.tsx                   # Moon/Sun toggle button (mounted guard)
│   ├── steps/                            # One component per booking step
│   │   ├── StepTrail.tsx                 # Step: Choose trail type
│   │   ├── StepSkill.tsx                 # Step: Choose skill level (MTB only)
│   │   ├── StepLocation.tsx              # Step: Choose location (fetches from Supabase)
│   │   ├── StepBike.tsx                  # Step: Participant count + per-rider bike/height
│   │   ├── StepDateTime.tsx              # Step: Date picker + time slot (Cal.com)
│   │   ├── StepDuration.tsx              # Step: 2 / 3 / 4 hours
│   │   ├── StepAddons.tsx                # Step: GoPro, Pickup/Dropoff
│   │   ├── StepWaiver.tsx                # Step: Liability waiver — covers all participants
│   │   └── StepPayment.tsx               # Step: Customer details → Stripe redirect
│   └── ui/                               # shadcn/ui primitives + extracted landing UI components
│       ├── CTAButton.jsx                 # Primary/secondary CTA anchor button (landing)
│       ├── SectionHeading.jsx            # Eyebrow + h2 + description (landing)
│       ├── StatCard.jsx                  # Frosted-glass stat card (landing hero)
│       └── [shadcn primitives...]        # button, card, input, select, etc.
│
├── data/
│   └── landing.ts                        # Extracted data constants for landing page sections
│                                         # (tours, guides, mapLocations, trailHighlights, etc.)
│
├── context/
│   └── BookingContext.tsx                # Global booking state + step navigation engine
│
├── lib/
│   ├── animations.ts                     # Shared Framer Motion variants (fadeUp, stagger)
│   ├── steps.ts                          # Step engine: IDs, skip/complete logic, nav helpers
│   ├── pricing.ts                        # Price calculation logic (server-side truth)
│   ├── inventory.ts                      # Electric bike / GoPro availability checks
│   ├── supabase.ts                       # Supabase client + admin client + helpers
│   ├── stripe.ts                         # Checkout session creation + webhook verify
│   ├── cal.ts                            # Cal.com availability fetch + mock data
│   └── utils.ts                          # cn() utility (clsx + tailwind-merge)
│
├── types/
│   ├── booking.ts                        # All TypeScript types and interfaces
│   └── index.ts                          # Re-exports
│
├── supabase/
│   ├── schema.sql                        # Full PostgreSQL schema + seed data
│   └── migrations/
│       ├── 001_inventory_constraint.sql  # DB trigger: enforce_inventory_on_booking (FOR UPDATE lock)
│       ├── 002_participant_columns.sql   # ALTER TABLE bookings: participant_count + participant_info
│       ├── 003_fix_electric_trigger.sql  # Replaces trigger to count electric across participant_info JSONB
│       ├── 004_update_location_names.sql # Renames all location rows to match new trail names
│       ├── 005_add_zip_marketing.sql     # ALTER TABLE bookings: zip_code + marketing_source columns
│       ├── 006_fix_participant_info.sql  # Fixes participant_info JSONB extraction for electric trigger
│       └── 007_indexes.sql              # Partial index on stripe_payment_intent_id (refund query perf)
│
├── public/
│   ├── trails/                           # SVG illustrations for Trail Type + Skill Level cards
│   │   ├── paved-trail.svg
│   │   ├── mountain-bike-trail.svg
│   │   ├── skill-first-time.svg
│   │   ├── skill-beginner.svg
│   │   ├── skill-intermediate.svg
│   │   └── skill-advanced.svg
│   ├── locations/                        # SVG illustrations for Location cards
│   │   ├── blue-spring-state-park.svg
│   │   ├── sanford-historic-downtown.svg
│   │   └── location-placeholder.svg
│   └── images/                           # Real photography — replace placeholders in landing
│       ├── gallery/                      # 6 gallery slots (GallerySection)
│       ├── guides/                       # Guide profile photos (GuidesSection)
│       ├── trails/                       # Trail photography
│       └── fleet/                        # Bike fleet photos
├── .env.local                            # Local secrets (git-ignored)
├── .env.example                          # Template — safe to commit
├── README.md                             # Quick-start guide
└── PROJECT.md                            # This file — full project reference
```

---

## 4. Landing Page

The marketing home page lives at `/` and is rendered by `app/page.tsx` importing `FloridaMountainBikeGuidesLanding`.

### Sections

| Section | Description |
|---|---|
| **Header** | Sticky nav with logo, links (Tours, Map, Guides, Fleet, Contact), CTA button |
| **Hero** | Animated headline, subtext, dual CTA, 3 stat cards, feature card widget |
| **Value Props** | 4 icon cards (trailhead gear, skill levels, booking simplicity, pickup) |
| **Tours** | Two tour cards: Mountain Bike Tours (Signature) + Scenic Paved Trail Tours (Relaxed) |
| **Map** | Interactive React Leaflet map — 5 location pins with pulsing animation and popups |
| **Trails** | 3 highlight cards: Central Florida Trails, Sunshine State scenery, Ride-ready logistics |
| **Guides** | 3 guide profile cards (image placeholder + bio) |
| **Fleet** | Rental fleet section + Bicikleta Bike Shop partnership details |
| **Gallery** | 6-card photo grid (gradient placeholders — replace with real photos) |
| **CTA** | Full-width dark green banner with Book a Tour + Meet Our Guides buttons |
| **Contact** | Contact info cards + inquiry form |
| **Footer** | Copyright + nav links |

### Architecture

```
components/landing/FloridaMountainBikeGuidesLanding.jsx   ← main component ('use client')
  imports:
    - framer-motion (fadeUp + stagger variants from lib/animations.ts)
    - next/dynamic → InteractiveTrailMap (ssr: false — Leaflet requires browser)
    - @/components/ui/CTAButton
    - @/components/ui/SectionHeading
    - @/components/ui/StatCard

components/map/InteractiveTrailMap.jsx                    ← Leaflet map ('use client')
  - CartoDB Voyager tile layer (no API key required)
  - Custom pulsing DivIcons with per-location colors
  - Popup per pin: type badge, name, description, difficulty, "Book Tour" → /booking
  - Mobile: card list view (default) with "Map View" toggle
  - Desktop: map + card list side-by-side (xl:grid-cols-[1.1fr_0.9fr])
  - SSR guard: mounted state — map only renders after useEffect
```

### Design Tokens (landing palette)

| Token | Value | Usage |
|---|---|---|
| `bg-page` | `#f6f1e7` | Page background |
| `text-dark` | `#10261d` | Headings |
| `brand-green` | `#1f5a43` | Primary CTA, links, icons |
| `text-muted` | `#4d5d56` / `#5b6b64` | Body copy |
| `card-border` | `#ddd2be` | Card borders |
| `card-bg` | `#faf7f1` / `white/70` | Card backgrounds |
| `badge-bg` | `#efe4cf` | Eyebrow badges |
| `badge-text` | `#7b5a2e` | Eyebrow text |

### Adding Real Photos

Drop photos into `public/images/` subfolders and update the corresponding section component:

- `public/images/gallery/` → replace gradient divs in `GallerySection` with `<Image>` from `next/image`
- `public/images/guides/` → replace `h-56` gradient div in `GuidesSection` guide cards
- `public/images/fleet/` → replace right-column placeholder in `FleetSection`

### Leaflet SSR Notes

React Leaflet accesses browser globals (`window`, `document`) at import time. The `InteractiveTrailMap` component uses:

1. A `mounted` state guard — `MapContainer` is only rendered after `useEffect` fires
2. `dynamic(() => import(...), { ssr: false })` in the landing page — prevents the module from being bundled on the server

Do **not** remove the `dynamic()` wrapper or the `mounted` check — both are required.

---

## 5. User Booking Flow

```
Step 1 → Trail Type
         ├── Paved Trail ──────────────────────────────► Step 3 (skill skipped)
         │     Auto-sets: bike_rental='standard', duration_hours=2
         └── Mountain Bike Trail ──────────────────────► Step 2

Step 2 → Skill Level (MTB only — dynamically included)
         First Time Rider | Beginner | Intermediate | Advanced
         First Time → duration locked to 2 hours
                                                      ▼
Step 3 → Location
         Paved: Spring to Spring Trail Tour – Blue Spring State Park | Sanford Historic Riverfront Tour
         MTB: filtered by skill_level (see table below)
                                                      ▼
Step 4 → Bike / Rider Info  ← MULTI-PARTICIPANT STEP
         "How many riders?" pill selector (1 to max for location)

         Paved — Blue Spring (max 4 riders):
           → Height collection only (bike always included, no electric)

         Paved — Sanford (max 6 riders, fleet: 4 standard + 2 e-bikes):
           → Per-rider Standard | E-Bike toggle
           → Live counter: X/4 standard, X/2 e-bike
           → Standard button disables when 4 assigned; E-Bike when 2 assigned
           → Height collected per rider

         MTB (max 6 riders, all locations, fleet: 4 standard + 2 e-bikes):
           → Per-rider: BYOB | Standard Rental | Electric Rental
           → Live counter: X/4 standard, X/2 e-bike (same cap as Sanford)
           → Standard button disables when 4 assigned; E-Bike when 2 assigned
           → Height collected if renting a bike
                                                      ▼
Step 5 → Date & Time
         Calendar grid pulled from Cal.com API
         Mock data used in dev when CAL_API_KEY is unset
         Minimum 24h lead time enforced in UI and API
                                                      ▼
Step 6 → Duration  [MTB only — skipped for paved and first_time riders]
         2 hours (base) | 3 hours (+$50/rider) | 4 hours (+$100/rider)
                                                      ▼
Step 7 → Add-ons
         ☐ GoPro Package             +$49/rider  (shows availability: "X left")
         ☐ Pickup + Dropoff          +$75/rider
         Electric upgrade NOT shown here — selected per-rider in Step 4
                                                      ▼
Step 8 → Liability Waiver
         Shows participant list when group > 1
         Checkbox covers lead booker + all named participants
                                                      ▼
Step 9 → Payment
         Collect: name, email, phone (client-side validated)
         Shows "N riders" in booking summary when count > 1
         POST /api/create-checkout → server validates + builds Stripe session
         Redirect → Stripe Checkout
                                                      ▼
Confirmation Page (/booking/confirmation?booking_id=&session_id=)
         Server fetches booking from Supabase — shows full details
         n8n webhook fires → sends email, calendar invite, Slack notification
         Booking state is reset from localStorage on page unmount
```

**MTB location assignments by skill level:**

| Location | Skill Levels |
|---|---|
| Lake Druid Park, Orlando | first_time |
| Soldiers Creek Park, Longwood (First Time) | first_time |
| Markham Woods Trail, Lake Mary | beginner |
| Little Big Econ Jones East – Snow Hill Rd, Chuluota | beginner |
| Soldiers Creek Park, Longwood | beginner |
| Mount Dora Mountain Bike Trail, Mount Dora | intermediate |
| Chuck Lennon Mountain Bike Trailhead, DeLeon Springs | intermediate |
| River Bend, Ormond Beach | intermediate |
| Doris Leeper Spruce Creek MTB Trailhead, Port Orange | intermediate |
| Santos Trailhead, Ocala | advanced |
| Graham Swamp East Trailhead MTB, Palm Coast | advanced |

**Navigation rules:**
- Paved trail skips Step 2 (skill level) and Step 6 (duration) — handled by the step engine
- Selecting paved auto-sets `bike_rental: 'standard'` and `duration_hours: 2` in the reducer
- First-time MTB riders skip Step 6 (duration locked to 2 hours)
- Changing trail type resets: skill level, location, and all downstream state
- Changing skill level resets: location
- All step navigation is context-driven (`goNext()` / `goPrev()`) — no URL routing between steps
- State is persisted to `localStorage` (`fmtg_booking_v1`) so page refresh restores progress

---

## 6. Step Engine

The booking flow is a single route (`/booking`) with a dynamic step renderer. Steps are defined in `lib/steps.ts` as a config array and rendered by `app/booking/page.tsx`.

### Step Definition

```typescript
// lib/steps.ts
interface StepDef {
  id: StepId;           // 'trail' | 'skill' | 'location' | ...
  label: string;        // shown in the progress stepper
  shouldSkip: (state: BookingState) => boolean;  // dynamic exclusion
  isComplete: (state: BookingState) => boolean;  // drives stepper UI
}
```

### Adding a New Step

1. Add an entry to `STEPS` in `lib/steps.ts` with the appropriate `shouldSkip` condition
2. Create the step component in `components/steps/`
3. Register it in the `STEP_COMPONENTS` map in `app/booking/page.tsx`

No routing changes needed — the engine handles it automatically.

### Context Navigation

`BookingContext` exposes:

```typescript
currentStepId: StepId                       // which step is currently rendered
goNext(stateOverride?: BookingState): void  // advance to next active step
goPrev(): void                              // go back to previous active step
```

`goNext()` accepts an optional `stateOverride` — callers that dispatch an action and immediately call `goNext` should pass the new state directly to avoid the stale closure problem (React batches dispatches, so `state` in the closure may not yet reflect the just-dispatched action).

**Steps with conditional skip logic:**
- `skill` — `shouldSkip: s => s.trail_type !== 'mtb'` (paved trails skip this)
- `duration` — `shouldSkip: s => s.trail_type === 'paved' || s.skill_level === 'first_time'`

When paved is selected, the `SET_TRAIL_TYPE` reducer auto-sets `bike_rental: 'standard'` and `duration_hours: 2`. When first_time MTB is selected, the `SET_SKILL_LEVEL` reducer auto-sets `duration_hours: 2`.

### localStorage Persistence

State is stored in `localStorage` under the key `fmtg_booking_v1`. The persisted object is:

```json
{
  "booking": { ...BookingState minus price_breakdown },
  "stepId": "location"
}
```

`price_breakdown` is excluded because it's derived and always recalculated. On `reset()`, the localStorage key is removed.

---

## 7. Database Schema

All tables live in Supabase (PostgreSQL). Run `supabase/schema.sql` to initialize, then run any files in `supabase/migrations/` in numeric order.

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
| name | TEXT | e.g. "Blue Spring State Park" |
| tour_type | TEXT | `paved` or `mtb` |
| skill_levels | TEXT[] | NULL = all levels; e.g. `['beginner','intermediate']` |
| active | BOOLEAN | soft delete |

**Seed data:**

| Location | Type | Skill Levels |
|---|---|---|
| Sanford Historic Riverfront Tour | paved | all |
| Spring to Spring Trail Tour – Blue Spring State Park | paved | all |
| Lake Druid Park, Orlando | mtb | first_time |
| Soldiers Creek Park, Longwood (First Time) | mtb | first_time |
| Markham Woods Trail, Lake Mary | mtb | beginner |
| Little Big Econ Jones East – Snow Hill Rd, Chuluota | mtb | beginner |
| Soldiers Creek Park, Longwood | mtb | beginner |
| Mount Dora Mountain Bike Trail, Mount Dora | mtb | intermediate |
| Chuck Lennon Mountain Bike Trailhead, DeLeon Springs | mtb | intermediate |
| River Bend, Ormond Beach | mtb | intermediate |
| Doris Leeper Spruce Creek MTB Trailhead, Port Orange | mtb | intermediate |
| Santos Trailhead, Ocala | mtb | advanced |
| Graham Swamp East Trailhead MTB, Palm Coast | mtb | advanced |

Migration `004_update_location_names.sql` renames all existing rows to match the names above. Migration `007_indexes.sql` adds a partial index on `stripe_payment_intent_id` used by the `charge.refunded` webhook handler.

**Capacity limits (enforced at UI and API level):**
- Blue Spring State Park: max 4 riders
- Sanford Historic Downtown: max 6 riders (fleet: 4 standard + 2 e-bikes)
- All MTB locations: max 6 riders

**Electric bike restrictions:**
- Blue Spring State Park: no electric bikes allowed
- Sanford Historic Downtown: max 2 e-bikes per booking (fleet: 4 standard + 2 e-bike)
- MTB locations: max 2 e-bikes per booking (same fleet constraint: 4 standard + 2 e-bike)

### `tours`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | TEXT | |
| type | TEXT | `paved` or `mtb` |
| base_duration_hours | INTEGER | 2 |
| base_price_no_bike | INTEGER | cents (8900 = $89 MTB BYOB; 11500 = $115 paved flat) |
| base_price_with_bike | INTEGER | cents (18900 = $189 MTB with bike) |
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
| bike_rental | TEXT | `none` / `standard` / `electric` — lead rider (Rider 1) |
| rider_height_inches | INTEGER | nullable — lead rider |
| addons | JSONB | `{"gopro": true, "pickup_dropoff": false}` |
| participant_count | INTEGER | total riders incl. lead (default 1) |
| participant_info | JSONB | additional riders 2–N as array (see below) |
| base_price | INTEGER | cents — sum across all riders |
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

**`participant_info` shape** (riders 2–N):
```json
[
  { "name": "Jane Smith", "bike_rental": "standard", "height_inches": 66 },
  { "name": "Carlos Rivera", "bike_rental": "electric", "height_inches": 70 }
]
```
- `bike_rental` is set for MTB; for paved it reflects the per-rider Standard/E-Bike choice
- `height_inches` is present if the rider is renting a bike (or for all paved riders)

Migration: `supabase/migrations/002_participant_columns.sql` — adds `participant_count` and `participant_info` to the `bookings` table.

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

## 8. Pricing Logic

> **Important:** All pricing is calculated server-side in `/api/create-checkout`. Client-side calculations are display-only and are never trusted.

Source of truth: `lib/pricing.ts`

### Two Pricing Paths

**Paved Tours (flat rate per rider):**
```
total = ($115 × participant_count) + addons_price
```
- Bike is always included — no bike rental upcharge
- Duration is always 2 hours — no surcharge
- E-bike upgrade ($25) charged per rider who chose electric (Sanford only)
- GoPro and Pickup/Dropoff multiply by participant_count

**Mountain Bike Tours (per rider):**
```
rider_prices  = base(rider1.bike) + Σ base(riderN.bike)
duration_cost = (duration_hours - 2) × $50 × participant_count
gopro_cost    = gopro ? $49 × participant_count : 0
pickup_cost   = pickup_dropoff ? $75 × participant_count : 0
electric_cost = count(riders with bike='electric') × $25

total = rider_prices + duration_cost + gopro_cost + pickup_cost + electric_cost
```

**MTB base prices per rider:**
| Bike choice | Price |
|---|---|
| BYOB (no rental) | $89 |
| Standard rental | $189 |
| Electric rental | $189 + $25 upgrade |

### MTB Examples (single rider)

| Config | Calculation | Total |
|---|---|---|
| No bike, 2hr, no addons | $89 + $0 + $0 | **$89** |
| Standard bike, 2hr, no addons | $189 + $0 + $0 | **$189** |
| Standard bike, 3hr, GoPro | $189 + $50 + $49 | **$288** |
| Electric bike, 4hr, Pickup | $189 + $100 + $25 + $75 | **$389** |

### MTB Examples (group)

| Config | Calculation | Total |
|---|---|---|
| 2 riders, both standard, 2hr | ($189 × 2) + $0 | **$378** |
| 3 riders: standard/none/electric, 2hr | $189 + $89 + $189 + $25 | **$492** |
| 2 riders, standard, 3hr, GoPro | ($189 × 2) + ($50 × 2) + ($49 × 2) | **$576** |

### Paved Examples (Sanford)

| Config | Calculation | Total |
|---|---|---|
| 1 rider, standard, no addons | $115 | **$115** |
| 3 riders (2 std, 1 e-bike) | ($115 × 3) + ($25 × 1) | **$370** |
| 6 riders (4 std, 2 e-bike), GoPro | ($115 × 6) + ($25 × 2) + ($49 × 6) | **$1,034** |

### Server-Side Overrides in `/api/create-checkout`

- `effectiveDuration`: always `2` for paved (ignores client value)
- `effectiveBike`: forced to `'standard'` only for **Blue Spring** (no electric). For Sanford, rider 1's actual `bike_rental` choice is used.

---

## 9. Inventory Logic

Source of truth: `lib/inventory.ts`

**Limited items:**
- Electric bikes: **2 units**
- GoPros: **3 units**

**Check logic** (two layers):

1. **Application-level** (fast UX feedback): `/api/validate-inventory` is called when the add-ons step mounts. Counts bookings on the same date with `status IN ('pending', 'confirmed')`, compares against inventory quantity, disables unavailable options. Remaining counts ("X left") are displayed inline.

2. **Database-level** (correctness guarantee): The trigger `enforce_inventory_on_booking` (replaced by `supabase/migrations/003_fix_electric_trigger.sql`) runs `BEFORE INSERT` on the `bookings` table. It issues `SELECT ... FOR UPDATE` on the matching inventory row, serializing concurrent inserts. If `available <= 0` it raises `RAISE EXCEPTION 'inventory_exhausted:electric_bike'` (or `gopro`). `/api/create-checkout` catches PostgreSQL error code `P0001` and decodes the message to return `409 Conflict`.

This two-layer approach gives instant UI feedback (application check) and prevents oversell under concurrent load (DB trigger).

**Multi-rider electric counting:** Both the application-level check (`lib/inventory.ts`) and the DB trigger count electric bikes across ALL riders in a booking — not just the lead rider's `bike_rental` column. Additional riders' electric choices are stored in `participant_info` JSONB and are summed during the availability check. This prevents oversell when a group books multiple electric bikes across `participant_info`.

---

## 10. API Routes

### `POST /api/create-checkout`

The main checkout endpoint. Runs server-side only.

**Request hardening (runs before Zod validation):**
- `Content-Type: application/json` required — returns `415` otherwise
- `Origin` header must match `NEXT_PUBLIC_APP_URL` — returns `403` otherwise
- Customer email is normalized: `toLowerCase().trim()`
- Date must be ≥ tomorrow (24h lead time) — returns `400` otherwise
- Participant count validated against location capacity limit
- Electric bike rejected if location is Blue Spring State Park
- Sanford: electric rider count across all participants capped at 2

**Flow:**
1. Validate request body with Zod schema
2. Check waiver was accepted
3. Apply paved overrides: `effectiveDuration=2`; `effectiveBike='standard'` only for Blue Spring
4. Validate inventory for the requested date (application-level)
5. **Recalculate price server-side** using `trailType` + all participants (ignores any client price)
6. Upsert customer record in Supabase (by normalized email)
7. Create `pending` booking in Supabase with `participant_count` + `participant_info` JSON
8. If DB trigger raises `inventory_exhausted:*` → return `409 Conflict`
9. Create Stripe Checkout session with line items (broken down per group)
10. Update booking with `stripe_session_id`
11. Return `{ checkout_url, session_id }`

**Success URL:** `{APP_URL}/booking/confirmation?booking_id={id}&session_id={CHECKOUT_SESSION_ID}`
**Cancel URL:** `{APP_URL}/booking`

**Request body:**
```json
{
  "booking_state": {
    "trail_type": "mtb",
    "skill_level": "intermediate",
    "location_id": "uuid",
    "location_name": "Markham Woods Park",
    "bike_rental": "standard",
    "rider_height_inches": 70,
    "participant_count": 2,
    "additional_participants": [
      { "name": "Jane Smith", "bike_rental": "none", "height_inches": null }
    ],
    "date": "2026-04-15",
    "time_slot": "09:00",
    "duration_hours": 3,
    "addons": { "gopro": true },
    "waiver_accepted": true,
    "customer": {
      "name": "Carlos Rivera",
      "email": "carlos@example.com",
      "phone": "555-1234"
    }
  }
}
```

---

### `POST /api/validate-inventory`

Called by Step 7 (add-ons) on mount to check availability before the user selects. Requires `Content-Type: application/json` (returns `415` otherwise).

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
Cached server-side for 5 minutes. Minimum date is tomorrow (24h lead time enforced).

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
| `checkout.session.completed` | Set booking `status = 'confirmed'`, store payment intent ID, trigger n8n, set `webhook_sent = true` only if n8n POST succeeds |
| `checkout.session.expired` | Set booking `status = 'cancelled'` (if still pending) |
| `charge.refunded` | Set booking `status = 'refunded'` |

**Reliability features:**
- **Idempotency:** Fetches booking before processing; skips `confirmed` state if already set (safe to replay)
- **Structured logging:** `[stripe-webhook] {type} | {id} | {timestamp}` on every event
- **Error checking:** All `.update()` calls are checked; errors are logged without failing the 200 response to Stripe
- **n8n flag:** `webhook_sent` is set to `true` only after n8n HTTP POST succeeds; placeholder URL check prevents accidental firing in dev

**n8n Payload (on `booking_confirmed`):**
```json
{
  "event": "booking_confirmed",
  "data": {
    "booking_id": "uuid",
    "session_id": "cs_...",
    "customer_email": "carlos@example.com",
    "customer_name": "Carlos Rivera",
    "amount_total": 28800,
    "location": "Markham Woods Park",
    "date": "2026-04-15",
    "time": "09:00"
  },
  "timestamp": "2026-04-10T14:32:00.000Z"
}
```

---

### `GET /api/booking-lookup?email=...&booking_id=...`

Customer-facing booking lookup. Verifies the email → customer → booking ownership chain before returning booking data. Returns `404` if no matching customer or if the booking doesn't belong to that customer.

**UI:** `app/booking/lookup/page.tsx` — form with email + booking ID fields, renders booking summary on success.

---

### `POST /api/admin/update-booking`

Updates the status of a booking. Requires a valid `admin_session` httpOnly cookie (set by `/api/admin/login`).

**Request:**
```json
{
  "booking_id": "uuid",
  "status": "confirmed"
}
```

### `POST /api/admin/login`

Sets the `admin_session` httpOnly cookie (8 hours, secure in production). Used by the admin login page.

**Request:** `{ "secret": "your_admin_password" }`

**`DELETE /api/admin/login`** — clears the session cookie (logout).

---

## 11. Third-Party Integrations

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
- **Endpoint used:** `GET /slots` (params: `startTime`, `endTime` as ISO strings, `username`, `eventTypeId`)
- **Required vars:** `CAL_API_KEY`, `CAL_EVENT_TYPE_ID`, `CAL_USERNAME` (username slug, e.g. `floridamountainbikeguides`)
- **Fallback:** Mock data is returned automatically when any of the three keys are not set
- **Transform:** `lib/cal.ts → transformCalResponse()` — extracts `HH:MM` from ISO time, converts to `America/New_York`
- **Cache:** Slots are cached 5 minutes (`next: { revalidate: 300 }`)
- **Booking creation:** `createCalBooking()` in `lib/cal.ts` is implemented. Called from Stripe webhook after `checkout.session.completed`. Stores `cal_booking_uid` on the booking record. Skips gracefully when `CAL_API_KEY` not set.

### n8n

- **Trigger:** HTTP POST to `N8N_WEBHOOK_URL` after `checkout.session.completed`
- **Use cases:** Confirmation email, calendar invite, Slack notification, CRM update
- **Failure handling:** n8n errors are logged but do NOT fail the Stripe webhook response (fire-and-forget)

### Supabase

- **Client key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`): Used client-side for public reads (locations)
- **Service role key** (`SUPABASE_SERVICE_ROLE_KEY`): Used server-side only for all writes. Never exposed to the browser.
- **RLS:** Enabled on all tables. Public read on reference tables. Service role for all mutations.

### Admin Dashboard

- **Login URL:** `/admin/login` — branded password form; redirects to `/admin` on success
- **Auth:** Cookie-based session (`admin_session` httpOnly, 8-hour expiry) checked against `ADMIN_SECRET` env var
- **Features:** Booking stats, full table with filters, inline status update, Sign Out button
- **Status options:** `pending` → `confirmed` → `cancelled` → `refunded`

---

## 12. Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Stripe
STRIPE_SECRET_KEY=sk_live_...          # sk_test_ for development
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...        # From Stripe dashboard webhook settings

# Cal.com (optional — mock data used if any var is unset)
CAL_API_KEY=cal_live_...
CAL_EVENT_TYPE_ID=12345
CAL_USERNAME=floridamountainbikeguides    # Cal.com username slug — required for /slots endpoint

# App
NEXT_PUBLIC_APP_URL=https://booking.yourdomain.com   # No trailing slash

# n8n (optional — skips silently if unset)
N8N_WEBHOOK_URL=https://your-n8n.com/webhook/xxxxx

# Admin dashboard
ADMIN_SECRET=choose_a_strong_random_secret

# Upstash Redis — rate limiting on /api/create-checkout (optional — skips if unset)
# Create a free database at upstash.com → copy REST URL and token
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
```

**Development without third-party keys:**
- Supabase: Required. Set up a free project at supabase.com
- Stripe: Use test keys (`sk_test_`, `pk_test_`)
- Cal.com: Optional. Mock data is used automatically
- n8n: Optional. Webhook skips silently with a console warning
- Admin: Set `ADMIN_SECRET` to any value for local testing

---

## 13. Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in environment variables
cp .env.example .env.local

# 3. Run Supabase schema
# → Go to supabase.com → SQL Editor → paste contents of supabase/schema.sql → Run
# → Then run supabase/migrations/001_inventory_constraint.sql
# → Then run supabase/migrations/002_participant_columns.sql
# → Then run supabase/migrations/003_fix_electric_trigger.sql
# → Then run supabase/migrations/004_update_location_names.sql
# → Then run supabase/migrations/005_add_zip_marketing.sql
# → Then run supabase/migrations/006_fix_participant_info.sql
# → Then run supabase/migrations/007_indexes.sql

# 4. Start development server
npm run dev

# 5. Open in browser
# http://localhost:3000         → landing page (marketing home)
# http://localhost:3000/booking → booking wizard
```

**Stripe webhook testing locally:**
```bash
# Install Stripe CLI
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger a test event
stripe trigger checkout.session.completed
```

**Admin dashboard locally:**
```
http://localhost:3000/admin/login
# Enter the value of ADMIN_SECRET to sign in
```

---

## 14. Deployment (Vercel)

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
5. Set `ADMIN_SECRET` to a strong random value in Vercel env vars

---

## 15. Known Gotchas

| Issue | Details |
|---|---|
| **Leaflet + Next.js SSR** | `react-leaflet` and `leaflet` access `window`/`document` at import time. `InteractiveTrailMap` uses a `mounted` guard and must always be imported via `next/dynamic` with `ssr: false`. Removing either guard causes `ReferenceError: window is not defined` during Vercel build. |
| **Single booking route** | The entire booking wizard lives at `/booking`. There are no individual step URLs. Step routing is driven by `currentStepId` in `BookingContext`, not by the URL. Deep-linking to a specific step is not supported by design. |
| **Supabase v2.99 types** | `Database` type requires `Relationships: []` on every table definition. Using app-level types directly in `createClient<Database>` causes build errors. |
| **Supabase lazy singleton** | Do not initialize the Supabase client at module level — it reads env vars at import time, which breaks the Next.js build. Use the lazy getter `getSupabaseClient()`. |
| **shadcn/ui v4 Button** | v4 uses `@base-ui/react` under the hood and does not support the `asChild` prop. Use `buttonVariants()` applied directly to `<Link>` or `<a>` tags instead. |
| **Server Components + `buttonVariants`** | `buttonVariants` is a client function. Pages that use it (e.g. `not-found.tsx`) must include `'use client'` at the top. |
| **Confirmation page is a Server Component** | `app/booking/confirmation/page.tsx` is a Server Component that fetches booking data with the admin Supabase client. The interactive part (`ConfirmationClient.tsx`) is a separate Client Component. The `Suspense` wrapper is still required for the client child. |
| **`searchParams` is async in Next.js 16** | `searchParams` in Server Component page props must be `await`-ed: `const { booking_id } = await searchParams`. |
| **Stripe API version** | v20 of the stripe npm package requires API version `'2026-02-25.clover'` — not the older `'2024-06-20'` string. |
| **Stripe success URL** | `{CHECKOUT_SESSION_ID}` in the success URL is a Stripe placeholder — it is NOT a JavaScript template literal. It must be written exactly as shown and will be replaced by Stripe at redirect time. |
| **Paved trail skips Step 2** | When user selects "Paved Trail", `goNext()` computes `getActiveSteps(state)` which filters out the `skill` step (its `shouldSkip` returns `true` for `trail_type !== 'mtb'`). The `skill_level` field remains `undefined` in state, which is valid for paved tours. |
| **Stale closure in `goNext`** | React batches state updates — if you dispatch an action and immediately call `goNext()`, the `state` in the closure may not yet reflect the dispatch. Solution: pass the known new state as `goNext(newState)`. See `StepTrail.tsx` for the canonical example. |
| **Hydration mismatch in `BookingPage`** | Server renders without localStorage data (step 1), client hydrates from localStorage (possibly a later step), causing a React hydration error. Fixed by a `mounted` state guard: renders `<div className="min-h-[400px]" />` until after the first `useEffect` fires. |
| **Hydration mismatch in `BookingStepper`** | Same root cause. Fixed by `mounted` guard rendering `<div className="w-full h-[72px]" />` before hydration. |
| **ThemeToggle hydration** | `useTheme()` returns `undefined` on the server. `ThemeToggle` uses a `mounted` guard to render nothing until after hydration, then shows the correct Moon/Sun icon. |
| **Price on client vs server** | Client shows a live price preview for UX, but the server recalculates independently in `/api/create-checkout`. The Stripe line items are built from the server calculation only. |
| **`effectiveBike` override is location-specific** | For paved tours, Blue Spring forces `bike_rental = 'standard'` server-side (no electric allowed). Sanford uses the actual rider 1 choice because electric is available there. Do not blindly override all paved to `'standard'`. |
| **Electric upgrade not in StepAddons for paved** | For paved tours, e-bike selection is done per-rider in StepBike. The `electric_upgrade` addon is hidden in StepAddons when `trail_type === 'paved'` to avoid double-charging. |
| **Fleet constraint UI (Sanford + MTB)** | `isStandardDisabled(currentBike)` and `isElectricDisabled(currentBike)` are computed from current rider assignments. Fleet cap (4 standard + 2 e-bikes) applies to **both** Sanford paved bookings and **all MTB locations**. A rider who already selected a type can always change their own selection. The `hasFleetCap` flag is `isSanford \|\| !isPaved`. |
| **localStorage key versioning** | The persistence key is `fmtg_booking_v1`. If the `BookingState` shape changes in a breaking way, increment this key so stale persisted state is ignored. |
| **Admin auth** | The admin dashboard uses cookie-based session auth. Visit `/admin/login`, enter `ADMIN_SECRET`, receive an `httpOnly` 8-hour cookie. For production, consider replacing with Supabase Auth or a proper RBAC system. |
| **Stripe `success_url` — no double params** | `successUrl` passed into `createCheckoutSession()` already includes `?booking_id=...&session_id={CHECKOUT_SESSION_ID}`. Do NOT append these again inside `lib/stripe.ts` or Stripe will receive duplicate query parameters. |

---

## 16. Future Improvements

### High Priority (pre-launch)
- [x] Wire Cal.com booking creation — done (`createCalBooking()` in `lib/cal.ts`; called from Stripe webhook after `checkout.session.completed`; uses `GET /slots` endpoint; requires `CAL_API_KEY` + `CAL_EVENT_TYPE_ID` + `CAL_USERNAME`; skips gracefully when any var is unset)
- [ ] Email confirmation — implement in n8n (Resend or SendGrid)
- [ ] Calendar invite — send `.ics` file via n8n on booking confirmed
- [x] Rate limiting on API routes — done (`/api/create-checkout` limited to 10 req/IP/hour via Upstash Redis; skips gracefully when `UPSTASH_REDIS_REST_URL`/`TOKEN` not set; uses `@upstash/redis` HTTP API — compatible with Vercel serverless)
- [ ] Run DB migrations 001–007 in production Supabase before go-live
- [x] Booking lookup page — done (`app/booking/lookup`, `/api/booking-lookup`)
- [x] Inventory race condition — done (PostgreSQL trigger with `FOR UPDATE`; updated by migration 003 to count all electric riders)
- [x] Multi-participant group bookings — done (per-rider bike/height in StepBike, waiver covers all, pricing per rider)
- [x] Fleet constraint (Sanford + all MTB) — done (4 standard + 2 e-bike cap enforced in UI and API for both trail types)
- [x] Multi-rider electric inventory counting — done (`lib/inventory.ts` and DB trigger now count electric across `participant_info` JSONB)
- [x] Dark/light mode — done (next-themes with system preference, semantic Tailwind color classes throughout, including lookup/error/not-found pages)
- [x] Confirmation page dark mode + participant display — done (`ConfirmationClient.tsx` uses semantic classes; shows rider count and names)
- [x] Admin login page — done (`/admin/login` with client logo + title; cookie-based session; Sign Out button)
- [x] Stability audit — done (webhook_sent reliability, waiver state on back-nav, inventory multi-rider count, Cal.com JSON parse safety, base_price column fix, silent location fallback removed)

### Post-MVP
- [ ] Recurring customer profiles — login with magic link (Supabase Auth)
- [ ] Gift cards / promo codes — Stripe coupon integration
- [ ] Cancellation / rescheduling flow — customer self-service with refund policy enforcement
- [ ] Analytics dashboard — revenue, popular locations, conversion funnel
- [ ] SMS reminders — via n8n + Twilio
- [ ] Waitlist — when dates are fully booked
- [ ] Dynamic pricing — peak/off-peak by day of week
- [ ] Internationalization — if expanding beyond English
- [x] Marketing landing page — done (framer-motion animations, interactive Leaflet map, mobile-responsive, sandy-green palette)
- [x] Interactive trail map — done (React Leaflet, 5 pins, pulsing DivIcons, popups with Book Tour, mobile card/map toggle)
- [x] Admin dashboard mobile layout — done (card view on mobile, table on desktop, header flex-wrap)
- [ ] Replace gallery image placeholders with real client photography (`public/images/gallery/`)
- [ ] Replace guide profile image placeholders with real photos (`public/images/guides/`)
- [ ] Wire contact form to server action or n8n webhook
- [ ] UI redesign — booking flow design pass (landing page design is complete)
- [ ] Admin: inventory override panel (adjust quantities without DB edits)
- [ ] Admin: block specific dates from accepting bookings

# Florida Mountain Bike Trail Guided Tours — Booking Platform

MVP booking system for guided bike tours.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, TailwindCSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth)
- **Payments**: Stripe Checkout
- **Scheduling**: Cal.com API
- **Automation**: n8n webhooks
- **Deployment**: Vercel

## Setup

1. Clone the repo
2. Copy `.env.example` to `.env.local` and fill in your keys
3. Run the SQL schema in `supabase/schema.sql` via the Supabase dashboard
4. Install dependencies: `npm install`
5. Run dev server: `npm run dev`

## Environment Variables

See `.env.example` for all required variables.

## Booking Flow

1. Choose Trail Type (Paved / MTB)
2. Choose Skill Level (MTB only)
3. Choose Location
4. Select Bike Rental
5. Select Date & Time (from Cal.com)
6. Choose Duration
7. Select Add-ons
8. Accept Waiver
9. Payment (Stripe Checkout)
10. Confirmation

## Pricing

| Option | Price |
|--------|-------|
| Base tour (no bike, 2hr) | $89 |
| Base tour (with bike, 2hr) | $189 |
| Additional hour | $50/hr |
| GoPro Package | $49 |
| Pickup + Dropoff | $75 |
| Electric Bike Upgrade | $25 |

## Supabase Setup

Run `supabase/schema.sql` in the Supabase SQL editor. This creates:
- `customers` — rider profiles
- `locations` — trail locations by type/skill
- `tours` — tour definitions
- `bookings` — all booking records
- `inventory` — limited items (electric bikes, GoPros)
- `addon_pricing` — add-on prices and availability

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/create-checkout` | POST | Creates Stripe checkout session |
| `/api/validate-inventory` | POST | Validates item availability for a date |
| `/api/availability` | GET | Fetches Cal.com availability slots |
| `/api/webhooks/stripe` | POST | Handles Stripe payment events |

## Integrations

### Stripe
- Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
- Register webhook endpoint: `https://yourdomain.com/api/webhooks/stripe`
- Events to handle: `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`

### Cal.com
- Set `CAL_API_KEY` and `CAL_EVENT_TYPE_ID`
- Create an event type in Cal.com for the tours
- Mock data is returned when keys are not set

### n8n
- Set `N8N_WEBHOOK_URL` to your n8n webhook trigger URL
- Triggered on `booking_confirmed` with full booking data
- Use n8n to send confirmation emails, calendar invites, Slack notifications, etc.

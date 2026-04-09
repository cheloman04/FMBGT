-- Migration 011: Lead capture funnel
-- Creates the leads table for early lead capture and funnel tracking.
-- Adds lead_id FK to bookings so leads can be converted after deposit payment.

-- ── Leads table ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leads (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contact (collected at lead capture step)
  full_name             TEXT        NOT NULL,
  email                 TEXT        NOT NULL,
  phone                 TEXT,
  zip_code              TEXT,
  heard_about_us        TEXT,

  -- Trail intent
  selected_trail_type   TEXT,

  -- Funnel progress (updated as user advances)
  selected_location_name  TEXT,
  selected_bike           TEXT,
  selected_date           TEXT,
  selected_time_slot      TEXT,
  selected_duration_hours INTEGER,

  -- UTM attribution (captured silently from URL params)
  utm_source            TEXT,
  utm_medium            TEXT,
  utm_campaign          TEXT,
  utm_content           TEXT,
  utm_term              TEXT,

  -- Funnel tracking
  last_step_completed   TEXT,
  last_activity_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Lifecycle
  source                TEXT        NOT NULL DEFAULT 'booking_platform',
  status                TEXT        NOT NULL DEFAULT 'lead'
                        CHECK (status IN ('lead', 'converted', 'archived')),

  -- Linked booking (set after deposit payment converts the lead)
  booking_id            UUID        REFERENCES bookings(id) ON DELETE SET NULL,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast admin queries
CREATE INDEX IF NOT EXISTS leads_status_idx          ON leads(status);
CREATE INDEX IF NOT EXISTS leads_email_idx           ON leads(email);
CREATE INDEX IF NOT EXISTS leads_created_at_idx      ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS leads_last_activity_idx   ON leads(last_activity_at DESC);

-- ── Link bookings → leads ─────────────────────────────────────────────────────

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS bookings_lead_id_idx ON bookings(lead_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Service role (used by server-side code) bypasses RLS automatically.
-- Public access is intentionally denied; all lead operations go through API routes.

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- No public policies: access requires service_role key (server only).

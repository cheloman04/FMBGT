-- Migration 012: Lead booking sessions
-- Adds a session model so abandonment is tied to a specific booking session,
-- not to initial lead capture.

CREATE TABLE IF NOT EXISTS lead_booking_sessions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id                   UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status                    TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'checkout_started', 'converted', 'abandoned')),
  started_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  exited_at                 TIMESTAMPTZ,
  checkout_started_at       TIMESTAMPTZ,
  converted_at              TIMESTAMPTZ,
  abandonment_confirmed_at  TIMESTAMPTZ,
  abandoned_alert_sent_at   TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_booking_sessions_lead_id_idx
  ON lead_booking_sessions(lead_id);

CREATE INDEX IF NOT EXISTS lead_booking_sessions_status_idx
  ON lead_booking_sessions(status);

CREATE INDEX IF NOT EXISTS lead_booking_sessions_last_activity_idx
  ON lead_booking_sessions(last_activity_at DESC);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS booking_session_id UUID REFERENCES lead_booking_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS bookings_booking_session_id_idx
  ON bookings(booking_session_id);

ALTER TABLE lead_booking_sessions ENABLE ROW LEVEL SECURITY;

-- No public policies: access requires service_role key (server only).

-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 008: Waiver records
--
-- Setup required BEFORE running this migration:
--   1. In Supabase Dashboard → Storage → New Bucket
--      Name: "waivers"
--      Public: NO (private)
--
-- This creates:
--   waiver_records   — one row per signer per booking
--   bookings         — add waiver_session_id column
-- ─────────────────────────────────────────────────────────────────────────────

-- Add waiver_session_id to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS waiver_session_id UUID;

-- Waiver records table
CREATE TABLE IF NOT EXISTS waiver_records (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID        NOT NULL,            -- pre-booking session, links to Stripe metadata
  booking_id            UUID        REFERENCES bookings(id) ON DELETE SET NULL,
  signer_name           TEXT        NOT NULL,
  signer_email          TEXT,
  signer_role           TEXT        NOT NULL CHECK (signer_role IN ('participant', 'guardian')),
  guardian_relationship TEXT,
  participants_covered  TEXT[]      NOT NULL DEFAULT '{}',
  agreed_at             TIMESTAMPTZ NOT NULL,
  ip_address            TEXT,
  user_agent            TEXT,
  waiver_version        TEXT        NOT NULL DEFAULT '1.0',
  tour_type             TEXT,
  location_name         TEXT,
  tour_date             TEXT,
  signature_url         TEXT,       -- Supabase Storage URL
  pdf_url               TEXT,       -- Supabase Storage URL
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS waiver_records_session_idx  ON waiver_records(session_id);
CREATE INDEX IF NOT EXISTS waiver_records_booking_idx  ON waiver_records(booking_id);

ALTER TABLE waiver_records ENABLE ROW LEVEL SECURITY;
-- Only service role (API routes) can read/write
CREATE POLICY "Service role only" ON waiver_records
  USING (false) WITH CHECK (false);

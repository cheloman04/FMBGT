-- Migration 018: Store communication consent on leads
-- TCPA/CAN-SPAM: record explicit opt-in with timestamp and consent text version.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS communication_consent      BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS communication_consent_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS communication_consent_text TEXT;

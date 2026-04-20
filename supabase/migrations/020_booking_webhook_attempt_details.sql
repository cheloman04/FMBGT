-- Migration 020: Persist the latest n8n confirmation webhook attempt outcome on bookings.
-- Helps admin diagnose missing confirmation emails without relying on external logs.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS webhook_last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS webhook_last_status_code INTEGER,
  ADD COLUMN IF NOT EXISTS webhook_last_error TEXT;

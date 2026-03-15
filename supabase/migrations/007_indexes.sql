-- Migration 007: Performance indexes
--
-- Adds an index on stripe_payment_intent_id so the charge.refunded webhook
-- handler doesn't do a full table scan on every refund event.
--
-- Run after migrations 001–006.

CREATE INDEX IF NOT EXISTS bookings_payment_intent_idx
  ON bookings (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

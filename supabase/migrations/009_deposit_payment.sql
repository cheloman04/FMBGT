-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 009: 50% deposit + saved payment method for remaining balance
--
-- Adds:
--   customers.stripe_customer_id       — Stripe Customer object ID
--   bookings.deposit_amount            — 50% of total (cents)
--   bookings.remaining_balance_amount  — 50% of total (cents)
--   bookings.remaining_balance_due_at  — when to charge the second payment
--   bookings.deposit_payment_status    — pending | paid | failed
--   bookings.remaining_balance_status  — pending | paid | failed | waived
--   bookings.stripe_customer_id        — Stripe Customer ID (denorm for fast lookup)
--   bookings.stripe_payment_method_id  — saved card for off-session charge
--   bookings.deposit_payment_intent_id — PI ID for the deposit charge
--   bookings.remaining_balance_payment_intent_id — PI ID for the second charge
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Stripe customer ID on the customer record (for reuse across bookings)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- 2. Deposit / payment split columns on bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS deposit_amount                       INTEGER,
  ADD COLUMN IF NOT EXISTS remaining_balance_amount             INTEGER,
  ADD COLUMN IF NOT EXISTS remaining_balance_due_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deposit_payment_status               TEXT NOT NULL DEFAULT 'pending'
    CHECK (deposit_payment_status IN ('pending', 'paid', 'failed')),
  ADD COLUMN IF NOT EXISTS remaining_balance_status             TEXT NOT NULL DEFAULT 'pending'
    CHECK (remaining_balance_status IN ('pending', 'paid', 'failed', 'waived')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id                   TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id             TEXT,
  ADD COLUMN IF NOT EXISTS deposit_payment_intent_id            TEXT,
  ADD COLUMN IF NOT EXISTS remaining_balance_payment_intent_id  TEXT;

-- 3. Indexes for the cron job query
CREATE INDEX IF NOT EXISTS bookings_remaining_balance_due_idx
  ON bookings (remaining_balance_due_at, remaining_balance_status)
  WHERE remaining_balance_status = 'pending';

CREATE INDEX IF NOT EXISTS bookings_stripe_pm_idx
  ON bookings (stripe_payment_method_id)
  WHERE stripe_payment_method_id IS NOT NULL;

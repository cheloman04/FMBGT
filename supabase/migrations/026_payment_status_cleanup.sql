-- Migration 026: Separate calculated pricing from confirmed payment
--
-- Problems fixed:
--   1. deposit_amount is a calculated field (what to charge), not proof of payment.
--      Added deposit_paid_cents to track the actual confirmed amount from Stripe.
--   2. deposit_payment_status / remaining_balance_status CHECK constraints did not
--      include 'cancelled', so expired checkout sessions could not be marked
--      cancelled without a constraint violation — they stayed 'pending' forever,
--      making cancelled bookings look like real pending-payment bookings.
--
-- Changes:
--   bookings.deposit_paid_cents            — actual amount confirmed by Stripe (cents)
--   bookings.deposit_payment_status        — adds 'cancelled' to allowed values
--   bookings.remaining_balance_status      — adds 'cancelled' to allowed values

-- 1. Add deposit_paid_cents (actual confirmed amount; 0 until Stripe webhook fires)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS deposit_paid_cents INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN bookings.deposit_amount IS
  'Calculated deposit target (50% of total, set at booking creation). NOT proof of payment.';
COMMENT ON COLUMN bookings.deposit_paid_cents IS
  'Actual amount confirmed by Stripe checkout.session.completed. 0 until deposit is paid.';

-- 2. Expand deposit_payment_status to allow 'cancelled'
--    Drop the old constraint and replace it.
ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_deposit_payment_status_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_deposit_payment_status_check
    CHECK (deposit_payment_status IN ('pending', 'paid', 'failed', 'cancelled'));

-- 3. Expand remaining_balance_status to allow 'cancelled'
ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_remaining_balance_status_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_remaining_balance_status_check
    CHECK (remaining_balance_status IN ('pending', 'paid', 'failed', 'waived', 'cancelled'));

-- 4. Back-fill: any booking with status = 'cancelled' or status = 'pending'
--    that has deposit_payment_status = 'pending' and no payment intent
--    was never paid — mark its payment statuses as 'cancelled' to match reality.
UPDATE bookings
SET
  deposit_payment_status   = 'cancelled',
  remaining_balance_status = 'cancelled'
WHERE
  status IN ('cancelled', 'pending')
  AND deposit_payment_status = 'pending'
  AND deposit_payment_intent_id IS NULL;

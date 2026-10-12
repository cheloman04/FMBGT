-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 034: money moved after the original deposit / balance
--
-- Editing a booking can change its price after it was paid. The admin then
-- either collects the difference or refunds it, and those movements need a home
-- next to the existing deposit / remaining-balance columns:
--
--   bookings.extra_paid_cents — collected after the original deposit and balance:
--                               an extra charge to the saved card, or cash /
--                               Zelle / Venmo recorded by the admin
--   bookings.refunded_cents   — refunded so far (to the card or in cash),
--                               including partial refunds made in Stripe
--
-- Net collected = deposit_paid_cents
--               + remaining_balance_amount (only when remaining_balance_status = 'paid')
--               + extra_paid_cents − refunded_cents
-- (see lib/booking-money.ts). Every movement is also logged in financial_event_logs.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS extra_paid_cents INTEGER NOT NULL DEFAULT 0
    CHECK (extra_paid_cents >= 0),
  ADD COLUMN IF NOT EXISTS refunded_cents   INTEGER NOT NULL DEFAULT 0
    CHECK (refunded_cents >= 0);

COMMENT ON COLUMN bookings.extra_paid_cents IS
  'Collected after the original deposit + balance (extra card charge or off-platform payment after an edit).';
COMMENT ON COLUMN bookings.refunded_cents IS
  'Refunded so far — card refunds (admin or Stripe dashboard, partial) and cash refunds.';

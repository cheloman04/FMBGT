-- Discount support for bookings.
-- Stores the applied discount code, label, percentage, and pre/post amounts.
-- All existing bookings default to no discount (discount_amount_cents = 0).

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS discount_code          TEXT,
  ADD COLUMN IF NOT EXISTS discount_label         TEXT,
  ADD COLUMN IF NOT EXISTS discount_percentage    NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS discount_amount_cents  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal_before_discount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS total_after_discount_cents     INTEGER;

COMMENT ON COLUMN bookings.discount_code         IS 'friends_family_20 | partnership_15 | null';
COMMENT ON COLUMN bookings.discount_percentage   IS 'Resolved server-side from discount_code — never trusted from client';
COMMENT ON COLUMN bookings.discount_amount_cents IS 'Reduction in cents applied to the booking total';
COMMENT ON COLUMN bookings.subtotal_before_discount_cents IS 'Total price before any discount (includes tax)';
COMMENT ON COLUMN bookings.total_after_discount_cents     IS 'Final price after discount applied (basis for deposit/remaining split)';

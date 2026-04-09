-- Allow admin and operational flows to mark bookings as completed.
-- The original status check only allowed pending/confirmed/cancelled/refunded.

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'refunded'));

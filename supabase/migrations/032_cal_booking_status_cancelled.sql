-- Migration 032: allow cal_booking_status = 'cancelled'.
--
-- When an admin cancels / refunds / deletes a booking we now cancel its Cal.com
-- event too, so the slot opens up again for online booking. 'cancelled' records
-- that the calendar event was released (vs 'failed' = never created).

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_cal_booking_status_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_cal_booking_status_check
    CHECK (cal_booking_status IN ('pending', 'created', 'failed', 'cancelled'));

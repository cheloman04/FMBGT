-- Migration 019: Operational status columns for Cal.com and n8n webhook on bookings.
-- Allows admin to identify confirmed bookings with no calendar event or failed confirmation email.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS cal_booking_status  TEXT NOT NULL DEFAULT 'pending'
    CHECK (cal_booking_status IN ('pending', 'created', 'failed')),
  ADD COLUMN IF NOT EXISTS webhook_sent        BOOLEAN NOT NULL DEFAULT FALSE;

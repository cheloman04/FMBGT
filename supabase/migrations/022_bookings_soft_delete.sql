-- Soft-delete audit columns for bookings.
-- When an admin archives a booking that has payment history,
-- the row is kept (status set to 'cancelled') and these fields are stamped.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by  TEXT;

COMMENT ON COLUMN bookings.deleted_at IS 'Set when an admin archives/soft-deletes a booking with financial history';
COMMENT ON COLUMN bookings.deleted_by IS 'Admin email that performed the soft-delete';

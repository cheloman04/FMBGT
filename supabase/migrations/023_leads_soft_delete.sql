-- Soft-delete audit columns for leads.
-- When an admin archives a lead linked to a booking with financial history,
-- the row is kept and these fields are stamped.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by  TEXT;

COMMENT ON COLUMN leads.deleted_at IS 'Set when an admin archives/soft-deletes a lead';
COMMENT ON COLUMN leads.deleted_by IS 'Admin email that performed the soft-delete';

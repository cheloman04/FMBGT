-- Deduplicates admin abandon alerts at the lead level.
-- Previously, each booking session could fire its own alert to Dustin if the user
-- opened and closed the wizard multiple times. Now a single flag per lead ensures
-- only one notification is sent regardless of session count.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS dustin_alert_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN leads.dustin_alert_sent_at IS 'Timestamp of the first abandon alert sent to Dustin for this lead. NULL means no alert has been sent yet. Set atomically to prevent duplicate notifications across multiple booking sessions.';

-- Customer email through Kigaru (phase 6 of the Kigaru plan, hub contract §5).
--
-- The app composes every customer email (subject, HTML, text) and hands it to the
-- Kigaru hub with POST /api/channels/email; the hub queues it, sends it from
-- Kigaru's Resend account with FMBGT's domain, tracks delivery and applies
-- unsubscribes. This table is the app's side of that hand-off: the INTENT to send.
-- A row is written before calling the hub, so a hub outage delays an email but
-- never loses it. `idempotency_key` is what the hub dedupes on
-- (`<email_type>:<entity id>`), so retrying a row can never send it twice.
--
-- Apply this migration BEFORE deploying the code that writes to it.

CREATE TABLE IF NOT EXISTS email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE CHECK (char_length(idempotency_key) BETWEEN 1 AND 120),
  email_type text NOT NULL CHECK (email_type ~ '^[a-z][a-z0-9_]{0,63}$'),
  category text NOT NULL CHECK (category IN ('transactional', 'marketing')),
  to_email text NOT NULL,
  subject text NOT NULL,
  html text NOT NULL,
  text_body text,
  entity_type text,
  entity_id uuid,
  -- pending: waiting for its first (or next) attempt · processing: claimed by a worker ·
  -- sent: the hub accepted it (202, or 200 duplicate) · rejected: the hub said no for
  -- good (422 suppressed / not_configured / invalid, 409, 401, 403) · failed: gave up
  -- after the last retry · skipped: never offered to the hub (a non-test address
  -- outside production).
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'rejected', 'failed', 'skipped')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz,
  last_status_code integer,
  last_error text,
  -- The hub's id and status for this email: what /admin/emails reads back.
  hub_email_id uuid,
  hub_status text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_due
  ON email_outbox (next_attempt_at, created_at)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_email_outbox_entity
  ON email_outbox (entity_id, email_type)
  WHERE entity_id IS NOT NULL;

ALTER TABLE email_outbox ENABLE ROW LEVEL SECURITY;

-- Claims due rows for one worker (FOR UPDATE SKIP LOCKED), like
-- claim_analytics_deliveries. A row stuck in `processing` for 15 minutes (a worker
-- that died mid-call) is claimed again: the hub's idempotency key makes that safe.
--
-- p_only_test = true claims only rows addressed to *@resend.dev: previews and local
-- dev share this database, and must never send a real customer's email.
CREATE OR REPLACE FUNCTION claim_email_outbox(
  p_limit integer DEFAULT 20,
  p_keys text[] DEFAULT NULL,
  p_only_test boolean DEFAULT true
)
RETURNS SETOF email_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM email_outbox
    WHERE next_attempt_at <= now()
      AND (
        status = 'pending'
        OR (status = 'processing' AND last_attempt_at < now() - interval '15 minutes')
      )
      AND (p_keys IS NULL OR idempotency_key = ANY (p_keys))
      AND (NOT p_only_test OR lower(to_email) LIKE '%@resend.dev')
    ORDER BY next_attempt_at, created_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
  )
  UPDATE email_outbox AS outbox
  SET status = 'processing',
      attempt_count = outbox.attempt_count + 1,
      last_attempt_at = now(),
      updated_at = now()
  FROM candidates
  WHERE outbox.id = candidates.id
  RETURNING outbox.*;
END;
$$;

REVOKE ALL ON FUNCTION claim_email_outbox(integer, text[], boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_email_outbox(integer, text[], boolean) TO service_role;

COMMENT ON TABLE email_outbox IS
  'Customer emails handed to the Kigaru hub (POST /api/channels/email). idempotency_key is the hub''s dedupe key; the body is kept for retries and cleared 30 days after the row settles.';

NOTIFY pgrst, 'reload schema';

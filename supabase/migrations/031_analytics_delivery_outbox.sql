-- Durable, idempotent delivery queue for GA4, Meta CAPI, and Senzai Hub.
-- Apply locally/staging first. This migration is intentionally not applied remotely here.

CREATE TABLE IF NOT EXISTS analytics_delivery_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_key text NOT NULL UNIQUE,
  destination text NOT NULL CHECK (destination IN ('ga4', 'meta', 'senzai')),
  event_name text NOT NULL,
  source_event_id text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'failed', 'delivered')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_delivery_outbox_due
  ON analytics_delivery_outbox (next_attempt_at, created_at)
  WHERE delivered_at IS NULL;

ALTER TABLE analytics_delivery_outbox ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION claim_analytics_deliveries(
  p_limit integer DEFAULT 25,
  p_delivery_keys text[] DEFAULT NULL
)
RETURNS SETOF analytics_delivery_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM analytics_delivery_outbox
    WHERE delivered_at IS NULL
      AND next_attempt_at <= now()
      AND (
        status IN ('pending', 'failed')
        OR (status = 'processing' AND last_attempt_at < now() - interval '15 minutes')
      )
      AND (p_delivery_keys IS NULL OR delivery_key = ANY (p_delivery_keys))
    ORDER BY next_attempt_at, created_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
  )
  UPDATE analytics_delivery_outbox AS outbox
  SET status = 'processing',
      attempt_count = outbox.attempt_count + 1,
      last_attempt_at = now(),
      updated_at = now()
  FROM candidates
  WHERE outbox.id = candidates.id
  RETURNING outbox.*;
END;
$$;

REVOKE ALL ON FUNCTION claim_analytics_deliveries(integer, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_analytics_deliveries(integer, text[]) TO service_role;

COMMENT ON TABLE analytics_delivery_outbox IS
  'Server-side analytics/Hub outbox. delivery_key prevents duplicate logical deliveries; external IDs dedupe crash-after-send replays.';

NOTIFY pgrst, 'reload schema';

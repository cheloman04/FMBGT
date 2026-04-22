-- Migration 021: Append-only financial event log for payments, reconciliation,
-- and operator-facing support incidents.

CREATE TABLE IF NOT EXISTS financial_event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  event_category TEXT NOT NULL DEFAULT 'payment',
  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  stripe_session_id TEXT,
  payment_intent_id TEXT,
  amount INTEGER,
  currency TEXT,
  status TEXT,
  requires_attention BOOLEAN NOT NULL DEFAULT FALSE,
  message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS financial_event_logs_created_at_idx
  ON financial_event_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS financial_event_logs_occurred_at_idx
  ON financial_event_logs(occurred_at DESC);

CREATE INDEX IF NOT EXISTS financial_event_logs_booking_id_idx
  ON financial_event_logs(booking_id);

CREATE INDEX IF NOT EXISTS financial_event_logs_event_name_idx
  ON financial_event_logs(event_name);

CREATE INDEX IF NOT EXISTS financial_event_logs_requires_attention_idx
  ON financial_event_logs(requires_attention, created_at DESC);

ALTER TABLE financial_event_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON financial_event_logs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

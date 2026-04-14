-- Migration 013: Lead follow-up enrollments + steps
-- Manual follow-up is started from the admin dashboard. Supabase remains the
-- source of truth for enrollment, eligibility, conversion, and lost-state data.

ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE leads
  ADD CONSTRAINT leads_status_check
  CHECK (status IN ('lead', 'converted', 'lost', 'archived'));

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lost_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS lead_followup_enrollments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id              UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  trail_type           TEXT NOT NULL CHECK (trail_type IN ('paved', 'mtb')),
  sequence_key         TEXT NOT NULL DEFAULT 'default_lead_recovery',
  status               TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'completed', 'cancelled', 'lost')),
  enrolled_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_step_due_at     TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  cancelled_at         TIMESTAMPTZ,
  lost_at              TIMESTAMPTZ,
  stop_reason          TEXT,
  webhook_triggered_at TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_followup_enrollments_lead_id_idx
  ON lead_followup_enrollments(lead_id);

CREATE INDEX IF NOT EXISTS lead_followup_enrollments_status_idx
  ON lead_followup_enrollments(status);

CREATE UNIQUE INDEX IF NOT EXISTS lead_followup_enrollments_one_active_per_lead_idx
  ON lead_followup_enrollments(lead_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS lead_followup_steps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES lead_followup_enrollments(id) ON DELETE CASCADE,
  step_number   INTEGER NOT NULL CHECK (step_number BETWEEN 1 AND 3),
  step_key      TEXT NOT NULL CHECK (step_key IN ('1_hour', '1_day', '1_week')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at       TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'sent', 'skipped', 'cancelled')),
  channel       TEXT NOT NULL DEFAULT 'email',
  template_key  TEXT NOT NULL,
  skipped_at    TIMESTAMPTZ,
  cancelled_at  TIMESTAMPTZ,
  skip_reason   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS lead_followup_steps_unique_step_idx
  ON lead_followup_steps(enrollment_id, step_key);

CREATE INDEX IF NOT EXISTS lead_followup_steps_status_idx
  ON lead_followup_steps(status);

CREATE INDEX IF NOT EXISTS lead_followup_steps_scheduled_for_idx
  ON lead_followup_steps(scheduled_for);

ALTER TABLE lead_followup_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_followup_steps ENABLE ROW LEVEL SECURITY;

-- No public policies: access requires service_role key (server only).

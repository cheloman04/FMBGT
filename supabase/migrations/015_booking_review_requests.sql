-- Booking review request enrollments and steps
-- Triggered when an admin marks a booking as completed.

CREATE TABLE IF NOT EXISTS booking_review_request_enrollments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id            UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  customer_id           UUID REFERENCES customers(id) ON DELETE SET NULL,
  trail_type            TEXT NOT NULL CHECK (trail_type IN ('paved', 'mtb')),
  location_name         TEXT,
  full_name             TEXT,
  email                 TEXT,
  sequence_key          TEXT NOT NULL DEFAULT 'completed_service_review_request',
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'reviewed', 'cancelled', 'completed')),
  enrolled_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_step_due_at      TIMESTAMPTZ,
  review_left_at        TIMESTAMPTZ,
  review_platform       TEXT,
  completed_at          TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  stop_reason           TEXT,
  webhook_triggered_at  TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_review_request_enrollments_booking_id_idx
  ON booking_review_request_enrollments(booking_id);

CREATE INDEX IF NOT EXISTS booking_review_request_enrollments_status_idx
  ON booking_review_request_enrollments(status);

CREATE UNIQUE INDEX IF NOT EXISTS booking_review_request_enrollments_one_active_per_booking_idx
  ON booking_review_request_enrollments(booking_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS booking_review_request_steps (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id  UUID NOT NULL REFERENCES booking_review_request_enrollments(id) ON DELETE CASCADE,
  step_number    INTEGER NOT NULL CHECK (step_number >= 1),
  step_key       TEXT NOT NULL CHECK (step_key IN ('same_day', '1_day', '1_week')),
  scheduled_for  TIMESTAMPTZ NOT NULL,
  sent_at        TIMESTAMPTZ,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'skipped', 'cancelled')),
  channel        TEXT NOT NULL DEFAULT 'email',
  template_key   TEXT NOT NULL,
  skipped_at     TIMESTAMPTZ,
  cancelled_at   TIMESTAMPTZ,
  skip_reason    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, step_key)
);

CREATE INDEX IF NOT EXISTS booking_review_request_steps_enrollment_id_idx
  ON booking_review_request_steps(enrollment_id);

CREATE INDEX IF NOT EXISTS booking_review_request_steps_status_scheduled_for_idx
  ON booking_review_request_steps(status, scheduled_for);

ALTER TABLE booking_review_request_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_review_request_steps ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE booking_review_request_enrollments IS
  'Review request sequences for completed bookings. Access requires service_role.';
COMMENT ON TABLE booking_review_request_steps IS
  'Scheduled review request touches for completed bookings. Access requires service_role.';

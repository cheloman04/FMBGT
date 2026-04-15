-- Migration 017: Email attribution snapshots for leads and bookings

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS first_touch_attribution JSONB,
  ADD COLUMN IF NOT EXISTS last_touch_attribution JSONB,
  ADD COLUMN IF NOT EXISTS attribution_updated_at TIMESTAMPTZ;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS attribution_snapshot JSONB;
